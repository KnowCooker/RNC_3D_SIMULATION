import * as THREE from 'three';
import type { FieldFrame, Vec3 } from '../../shared/lab-contracts';
import { createFieldSliceTopology, type SliceAxis } from './field-slices';
import { displayEnergy, packFieldVolume, pressureColors, reductionColors, type FieldQuantity } from './field-display-data';

// A genuine queried grid is reconstructed continuously in the shader. No synthetic lobes/noise.
const paletteShader = `
  uniform vec3 palette[5]; uniform vec2 valueRange; uniform int quantity;
  vec3 colour(float value) {
    float p=clamp((value-valueRange.x)/(valueRange.y-valueRange.x),0.,1.)*4.;
    int a=min(3,int(floor(p)));return mix(palette[a],palette[a+1],p-float(a));
  }
  float pressure(vec2 energy) {
    vec2 db=vec2(60.)+10.*log(max(energy,vec2(1.e-30)))/log(10.);
    return quantity==2?db.x-db.y:quantity==0?db.x:db.y;
  }
`;

export function createFieldDisplay(points: readonly Vec3[], linearFloat: boolean) {
  const group = new THREE.Group(); group.name = 'continuous-acoustic-field';
  const uniforms = {
    palette: { value: pressureColors.map(c => new THREE.Color(c)) },
    valueRange: { value: new THREE.Vector2(30, 80) }, quantity: { value: 1 },
    opacity: { value: .95 }, clip: { value: new THREE.Vector4() }, clipped: { value: 0 },
  };
  let requestedOpacity=.95, showingVolume=true;
  const sliceOpacity={value:.6};
  const data = new Float32Array(560);
  const texture = new THREE.Data3DTexture(data, 7, 5, 8);
  texture.format = THREE.RGFormat; texture.type = THREE.FloatType;
  texture.minFilter = texture.magFilter = linearFloat ? THREE.LinearFilter : THREE.NearestFilter;
  texture.unpackAlignment = 1; texture.needsUpdate = true;
  const volumeUniforms = { ...uniforms, samples: { value: texture },
    lower: { value: new THREE.Vector3() }, extent: { value: new THREE.Vector3() } };
  const volumeMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: volumeUniforms, defines: linearFloat ? {} : { MANUAL_FILTER: 1 },
    side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: `out vec3 rayOrigin;out vec3 rayEnd;
      void main(){rayOrigin=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz;rayEnd=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `precision highp sampler3D;
      in vec3 rayOrigin;in vec3 rayEnd;out vec4 result;
      uniform sampler3D samples;uniform vec3 lower;uniform vec3 extent;
      uniform vec4 clip;uniform int clipped;uniform float opacity;
      ${paletteShader}
      vec2 energyAt(vec3 uv){
        vec3 p=clamp(uv,0.,1.)*vec3(6.,4.,7.);
        #ifdef MANUAL_FILTER
          ivec3 a=ivec3(floor(p)),b=min(a+ivec3(1),ivec3(6,4,7));vec3 f=fract(p);
          return mix(mix(mix(texelFetch(samples,a,0).rg,texelFetch(samples,ivec3(b.x,a.yz),0).rg,f.x),
            mix(texelFetch(samples,ivec3(a.x,b.y,a.z),0).rg,texelFetch(samples,ivec3(b.xy,a.z),0).rg,f.x),f.y),
            mix(mix(texelFetch(samples,ivec3(a.xy,b.z),0).rg,texelFetch(samples,ivec3(b.x,a.y,b.z),0).rg,f.x),
            mix(texelFetch(samples,ivec3(a.x,b.yz),0).rg,texelFetch(samples,b,0).rg,f.x),f.y),f.z);
        #else
          return texture(samples,(p+.5)/vec3(7.,5.,8.)).rg;
        #endif
      }
      void main(){
        vec3 dir=normalize(rayEnd-rayOrigin);vec3 safeDir=sign(dir)*max(abs(dir),vec3(.000001));
        safeDir+=vec3(equal(safeDir,vec3(0.)))*.000001;
        vec3 ta=(-.5-rayOrigin)/safeDir,tb=(.5-rayOrigin)/safeDir;
        vec3 lo=min(ta,tb),hi=max(ta,tb);
        float near=max(0.,max(lo.x,max(lo.y,lo.z))),far=min(hi.x,min(hi.y,hi.z));
        if(near>=far)discard;
        float stepSize=(far-near)/72.;vec4 sum=vec4(0.);
        for(int i=0;i<72;i++){
          vec3 p=rayOrigin+dir*(near+(float(i)+.5)*stepSize),uv=p+.5;
          vec3 world=lower+uv*extent;if(clipped==1&&dot(clip.xyz,world)+clip.w<0.)continue;
          vec3 edge=min(uv,1.-uv);float feather=smoothstep(0.,.055,min(edge.x,min(edge.y,edge.z)));
          float value=pressure(energyAt(uv));
          float density=quantity==2?1.+.5*clamp(abs(value)/max(valueRange.y,1.),0.,1.):1.;
          float alpha=(1.-exp(-stepSize*3.4*density))*feather*opacity;
          sum.rgb+=(1.-sum.a)*colour(value)*alpha;sum.a+=(1.-sum.a)*alpha;
        }
        if(sum.a<.005)discard;result=linearToOutputTexel(vec4(sum.rgb/max(sum.a,.001),sum.a));
      }`,
  });
  const volume = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), volumeMaterial);
  volume.name = 'sampled-field-volume'; volume.renderOrder = 4; group.add(volume);
  const slices = new Map<SliceAxis, { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; sampleIndices: number[]; texture: THREE.DataTexture }>();
  for (const axis of ['x', 'y', 'z'] as const) {
    const topology = createFieldSliceTopology(axis, points);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(topology.positions, 3));
    geometry.setIndex(topology.triangles);
    const uv = new Float32Array(topology.rows * topology.columns * 2);
    for (let r = 0; r < topology.rows; r++) for (let c = 0; c < topology.columns; c++) uv.set([c / (topology.columns - 1), r / (topology.rows - 1)], (r * topology.columns + c) * 2);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const map = new THREE.DataTexture(new Float32Array(topology.sampleIndices.length * 2), topology.columns, topology.rows, THREE.RGFormat, THREE.FloatType);
    map.minFilter = map.magFilter = linearFloat ? THREE.LinearFilter : THREE.NearestFilter;
    map.needsUpdate = true;
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: { ...uniforms, opacity:sliceOpacity, values: { value: map }, dimensions: { value: new THREE.Vector2(topology.columns, topology.rows) } },
      defines: linearFloat ? {} : { MANUAL_FILTER: 1 },
      side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      vertexShader: 'out vec2 sampleUv;out vec3 sampleWorld;void main(){sampleUv=uv;sampleWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `in vec2 sampleUv;in vec3 sampleWorld;out vec4 result;uniform vec4 clip;uniform int clipped;uniform sampler2D values;uniform vec2 dimensions;uniform float opacity;
        ${paletteShader}
        vec2 energyAt(vec2 uv){vec2 p=clamp(uv,0.,1.)*(dimensions-1.);
          #ifdef MANUAL_FILTER
            ivec2 a=ivec2(floor(p)),b=min(a+ivec2(1),ivec2(dimensions)-1);vec2 f=fract(p);
            return mix(mix(texelFetch(values,a,0).rg,texelFetch(values,ivec2(b.x,a.y),0).rg,f.x),mix(texelFetch(values,ivec2(a.x,b.y),0).rg,texelFetch(values,b,0).rg,f.x),f.y);
          #else
            return texture(values,(p+.5)/dimensions).rg;
          #endif
        }
        void main(){if(clipped==1&&dot(clip.xyz,sampleWorld)+clip.w<-.0001)discard;float value=pressure(energyAt(sampleUv));vec3 rgb=colour(value);
          float contour=abs(fract(value/3.+.5)-.5);float line=1.-smoothstep(.015,.015+max(fwidth(value/3.)*1.5,.018),contour);
          rgb=mix(rgb,rgb*.58,line*.32);result=linearToOutputTexel(vec4(rgb,opacity));
        }`,
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `sampled-field-slice-${axis}`; mesh.renderOrder = 5; mesh.visible = false; mesh.frustumCulled = false;
    group.add(mesh); slices.set(axis, { mesh, sampleIndices: topology.sampleIndices, texture: map });
  }
  function setPoints(next: readonly Vec3[]) {
    const box = new THREE.Box3().setFromPoints(next.map(p => new THREE.Vector3(...p)));
    box.getCenter(volume.position); box.getSize(volume.scale);
    volumeUniforms.lower.value.copy(box.min); volumeUniforms.extent.value.copy(volume.scale);
    for (const [axis, row] of slices) {
      const topology = createFieldSliceTopology(axis, next);
      (row.mesh.geometry.getAttribute('position').array as Float32Array).set(topology.positions);
      row.mesh.geometry.getAttribute('position').needsUpdate = true; row.mesh.geometry.computeBoundingSphere();
    }
  }
  setPoints(points);
  return { group, volume, slices, setPoints,
    update(frame: FieldFrame, quantity: FieldQuantity, slice: 'volume' | SliceAxis, range: readonly [number, number]) {
      packFieldVolume(frame, data); texture.needsUpdate = true;
      uniforms.quantity.value = quantity === 'primary' ? 0 : quantity === 'residual' ? 1 : 2;
      uniforms.valueRange.value.set(...range);
      uniforms.palette.value.forEach((c, i) => c.set((quantity === 'reduction' ? reductionColors : pressureColors)[i]));
      showingVolume=slice==='volume';volume.visible=showingVolume;uniforms.opacity.value=requestedOpacity*(showingVolume?.42:1);sliceOpacity.value=requestedOpacity*(showingVolume?.58:1);
      for (const [axis, row] of slices) {
        row.mesh.visible = slice === axis || showingVolume && (axis==='x'||axis==='y');
        const pixels = row.texture.image.data as Float32Array;
        row.sampleIndices.forEach((sample, i) => { pixels[i * 2] = displayEnergy(frame.primarySpl[sample]); pixels[i * 2 + 1] = displayEnergy(frame.residualSpl[sample]); });
        row.texture.needsUpdate = true;
      }
    },
    setClip(plane: THREE.Plane | null) { uniforms.clipped.value = plane ? 1 : 0; if (plane) uniforms.clip.value.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant); },
    setOpacity(value: number) { requestedOpacity=value;uniforms.opacity.value=value*(showingVolume?.42:1);sliceOpacity.value=value*(showingVolume?.58:1); },
    dispose() { texture.dispose(); volume.geometry.dispose(); volumeMaterial.dispose(); slices.forEach(row => { row.texture.dispose(); row.mesh.geometry.dispose(); row.mesh.material.dispose(); }); group.removeFromParent(); group.clear(); },
  };
}
