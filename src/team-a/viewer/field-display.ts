import * as THREE from 'three';
import type { FieldFrame, Vec3 } from '../../shared/lab-contracts';
import { createFieldSliceTopology, type SliceAxis } from './field-slices';
import { gridForCount } from './field-grid';
import { displayEnergy, packFieldVolume, pressureColors, reductionColors, type FieldQuantity } from './field-display-data';

// A genuine queried grid is reconstructed continuously in the shader. No synthetic lobes/noise.
const paletteShader = `
  uniform vec3 pressurePalette[7]; uniform vec3 improvementPalette[7];
  uniform vec2 pressureRange; uniform vec2 improvementRange; uniform vec3 quantityWeights;
  vec3 colourAt(float value,vec2 range,bool improvement) {
    float p=clamp((value-range.x)/(range.y-range.x),0.,1.)*6.;
    int a=min(5,int(floor(p)));
    return improvement?mix(improvementPalette[a],improvementPalette[a+1],p-float(a))
      :mix(pressurePalette[a],pressurePalette[a+1],p-float(a));
  }
  vec3 levels(vec2 energy) {
    vec2 db=vec2(60.)+10.*log(max(energy,vec2(1.e-30)))/log(10.);
    return vec3(db,db.x-db.y);
  }
  vec3 colour(vec3 db) {
    // Crossfade rendered colours, never interpolate SPL and improvement as one physical unit.
    return colourAt(db.x,pressureRange,false)*quantityWeights.x
      +colourAt(db.y,pressureRange,false)*quantityWeights.y
      +colourAt(db.z,improvementRange,true)*quantityWeights.z;
  }
  float pressure(vec2 energy) { return dot(levels(energy),quantityWeights); }
`;

export function createFieldDisplay(points: readonly Vec3[], linearFloat: boolean) {
  const group = new THREE.Group(); group.name = 'continuous-acoustic-field';
  const uniforms = {
    pressurePalette: { value: pressureColors.map(c => new THREE.Color(c)) },
    improvementPalette: { value: reductionColors.map(c => new THREE.Color(c)) },
    pressureRange: { value: new THREE.Vector2(45, 85) }, improvementRange: { value: new THREE.Vector2(-10, 10) },
    quantityWeights: { value: new THREE.Vector3(0, 1, 0) },
    opacity: { value: .95 }, clip: { value: new THREE.Vector4() }, clipped: { value: 0 },
  };
  let requestedOpacity=.95;
  const sliceOpacity={value:.85};
  const grid = gridForCount(points.length);
  const data = new Float32Array(points.length * 2), previousData = data.slice();
  const texture = new THREE.Data3DTexture(data, grid.x, grid.y, grid.z);
  const previousTexture = new THREE.Data3DTexture(previousData, grid.x, grid.y, grid.z);
  for (const map of [texture, previousTexture]) {
    map.format = THREE.RGFormat; map.type = THREE.FloatType;
    map.minFilter = map.magFilter = linearFloat ? THREE.LinearFilter : THREE.NearestFilter;
    map.unpackAlignment = 1; map.needsUpdate = true;
  }
  const temporalMix = {value: 1};
  let lastFrame: FieldFrame | null = null, clock = 0, transitionStart = 0, transitionSeconds = .1;
  let quantityReady = false, quantityStart = 0;
  const quantityFrom = new THREE.Vector3(), quantityTarget = new THREE.Vector3(0, 1, 0);
  const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  const volumeUniforms = { ...uniforms, samples: { value: texture }, previousSamples: {value: previousTexture}, temporalMix, dimensions: {value: new THREE.Vector3(grid.x, grid.y, grid.z)},
    lower: { value: new THREE.Vector3() }, extent: { value: new THREE.Vector3() } };
  const volumeMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: volumeUniforms, defines: linearFloat ? {} : { MANUAL_FILTER: 1 },
    side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: `out vec3 rayOrigin;out vec3 rayEnd;
      void main(){rayOrigin=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz;rayEnd=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `precision highp sampler3D;
      in vec3 rayOrigin;in vec3 rayEnd;out vec4 result;
      uniform sampler3D samples;uniform sampler3D previousSamples;uniform float temporalMix;uniform vec3 dimensions;uniform vec3 lower;uniform vec3 extent;
      uniform vec4 clip;uniform int clipped;uniform float opacity;
      ${paletteShader}
      vec2 readEnergy(sampler3D source,vec3 uv){
        vec3 p=clamp(uv,0.,1.)*(dimensions-1.);
        #ifdef MANUAL_FILTER
          ivec3 a=ivec3(floor(p)),b=min(a+ivec3(1),(ivec3(dimensions)-1));vec3 f=fract(p);
          return mix(mix(mix(texelFetch(source,a,0).rg,texelFetch(source,ivec3(b.x,a.yz),0).rg,f.x),
            mix(texelFetch(source,ivec3(a.x,b.y,a.z),0).rg,texelFetch(source,ivec3(b.xy,a.z),0).rg,f.x),f.y),
            mix(mix(texelFetch(source,ivec3(a.xy,b.z),0).rg,texelFetch(source,ivec3(b.x,a.y,b.z),0).rg,f.x),
            mix(texelFetch(source,ivec3(a.x,b.yz),0).rg,texelFetch(source,b,0).rg,f.x),f.y),f.z);
        #else
          return texture(source,(p+.5)/dimensions).rg;
        #endif
      }
      vec2 energyAt(vec3 uv){return mix(readEnergy(previousSamples,uv),readEnergy(samples,uv),temporalMix);}
      void main(){
        vec3 dir=normalize(rayEnd-rayOrigin);vec3 safeDir=sign(dir)*max(abs(dir),vec3(.000001));
        safeDir+=vec3(equal(safeDir,vec3(0.)))*.000001;
        vec3 ta=(-.5-rayOrigin)/safeDir,tb=(.5-rayOrigin)/safeDir;
        vec3 lo=min(ta,tb),hi=max(ta,tb);
        float near=max(0.,max(lo.x,max(lo.y,lo.z))),far=min(hi.x,min(hi.y,hi.z));
        if(near>=far)discard;
        float stepSize=(far-near)/96.;vec4 sum=vec4(0.);
        for(int i=0;i<96;i++){
          vec3 p=rayOrigin+dir*(near+(float(i)+.5)*stepSize),uv=p+.5;
          vec3 world=lower+uv*extent;if(clipped==1&&dot(clip.xyz,world)+clip.w<0.)continue;
          vec3 edge=min(uv,1.-uv);float feather=smoothstep(0.,.055,min(edge.x,min(edge.y,edge.z)));
          vec2 energy=energyAt(uv);vec3 db=levels(energy);
          float value=dot(db,quantityWeights);
          // Curved iso-pressure shells and a translucent interior, never planar overlays.
          vec3 bands=abs(fract(db/3.)-.5)*2.;
          float shell=dot(vec3(1.)-smoothstep(vec3(.05),vec3(.23),bands),quantityWeights);
          vec3 significance=vec3(clamp((db.xy-pressureRange.x)/(pressureRange.y-pressureRange.x),0.,1.),
            clamp(abs(db.z)/max(improvementRange.y,1.),0.,1.));
          float density=.12+.35*dot(significance,quantityWeights)+2.8*shell;
          vec3 rgb=colour(db);
          if(shell>.15){
            vec3 h=1./dimensions;
            vec3 gradient=vec3(pressure(energyAt(uv+vec3(h.x,0.,0.)))-value,
              pressure(energyAt(uv+vec3(0.,h.y,0.)))-value,
              pressure(energyAt(uv+vec3(0.,0.,h.z)))-value);
            float light=.70+.30*abs(dot(normalize(gradient+vec3(.00001)),normalize(vec3(.45,.8,.35))));
            rgb*=light;
          }
          float alpha=(1.-exp(-stepSize*4.5*density))*feather*opacity;
          sum.rgb+=(1.-sum.a)*rgb*alpha;sum.a+=(1.-sum.a)*alpha;
          if(sum.a>.97)break;
        }
        if(sum.a<.005)discard;result=linearToOutputTexel(vec4(sum.rgb/max(sum.a,.001),sum.a));
      }`,
  });
  const volume = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), volumeMaterial);
  volume.name = 'sampled-field-volume'; volume.renderOrder = 4; group.add(volume);
  const slices = new Map<SliceAxis, { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; sampleIndices: number[]; texture: THREE.DataTexture; previousTexture: THREE.DataTexture }>();
  for (const axis of ['x', 'y', 'z'] as const) {
    const topology = createFieldSliceTopology(axis, points);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(topology.positions, 3));
    geometry.setIndex(topology.triangles);
    const uv = new Float32Array(topology.rows * topology.columns * 2);
    for (let r = 0; r < topology.rows; r++) for (let c = 0; c < topology.columns; c++) uv.set([c / (topology.columns - 1), r / (topology.rows - 1)], (r * topology.columns + c) * 2);
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const map = new THREE.DataTexture(new Float32Array(topology.sampleIndices.length * 2), topology.columns, topology.rows, THREE.RGFormat, THREE.FloatType);
    // Texture.clone shares its Source; independent storage is required for the two frames.
    const previousMap = new THREE.DataTexture(new Float32Array(topology.sampleIndices.length * 2), topology.columns, topology.rows, THREE.RGFormat, THREE.FloatType);
    for (const image of [map, previousMap]) {
      image.minFilter = image.magFilter = linearFloat ? THREE.LinearFilter : THREE.NearestFilter;
      image.needsUpdate = true;
    }
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: { ...uniforms, opacity:sliceOpacity, values: { value: map }, previousValues: {value: previousMap}, temporalMix, dimensions: { value: new THREE.Vector2(topology.columns, topology.rows) } },
      defines: linearFloat ? {} : { MANUAL_FILTER: 1 },
      side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      vertexShader: 'out vec2 sampleUv;out vec3 sampleWorld;void main(){sampleUv=uv;sampleWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `in vec2 sampleUv;in vec3 sampleWorld;out vec4 result;uniform vec4 clip;uniform int clipped;uniform sampler2D values;uniform sampler2D previousValues;uniform float temporalMix;uniform vec2 dimensions;uniform float opacity;
        ${paletteShader}
        vec2 readEnergy(sampler2D source,vec2 uv){vec2 p=clamp(uv,0.,1.)*(dimensions-1.);
          #ifdef MANUAL_FILTER
            ivec2 a=ivec2(floor(p)),b=min(a+ivec2(1),ivec2(dimensions)-1);vec2 f=fract(p);
            return mix(mix(texelFetch(source,a,0).rg,texelFetch(source,ivec2(b.x,a.y),0).rg,f.x),mix(texelFetch(source,ivec2(a.x,b.y),0).rg,texelFetch(source,b,0).rg,f.x),f.y);
          #else
            return texture(source,(p+.5)/dimensions).rg;
          #endif
        }
        void main(){if(clipped==1&&dot(clip.xyz,sampleWorld)+clip.w<-.0001)discard;
          vec3 db=levels(mix(readEnergy(previousValues,sampleUv),readEnergy(values,sampleUv),temporalMix));vec3 rgb=colour(db);
          vec3 contour=abs(fract(db/3.+.5)-.5);
          float line=dot(vec3(1.)-smoothstep(vec3(.015),vec3(.015)+max(fwidth(db/3.)*1.5,vec3(.018)),contour),quantityWeights);
          rgb=mix(rgb,rgb*.58,line*.32);result=linearToOutputTexel(vec4(rgb,opacity));
        }`,
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `sampled-field-slice-${axis}`; mesh.renderOrder = 5; mesh.visible = false; mesh.frustumCulled = false;
    group.add(mesh); slices.set(axis, { mesh, sampleIndices: topology.sampleIndices, texture: map, previousTexture: previousMap });
  }
  function setPoints(next: readonly Vec3[]) {
    lastFrame = null; temporalMix.value = 1; quantityReady = false;
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
    /** Overview uses the latest complete residual volume, independently of the lab inspection view. */
    renderSnapshot(render: () => void) {
      const oldMix=temporalMix.value,weights=uniforms.quantityWeights.value.clone(),range=uniforms.pressureRange.value.clone();
      const oldClip=uniforms.clipped.value,oldVolume=volume.visible,oldOpacity=uniforms.opacity.value;
      const visible=[...slices.values()].map(row=>row.mesh.visible);
      try {
        temporalMix.value=1;uniforms.quantityWeights.value.set(0,1,0);uniforms.pressureRange.value.set(45,85);
        uniforms.clipped.value=0;uniforms.opacity.value=.95;volume.visible=true;slices.forEach(row=>row.mesh.visible=false);
        render();
      } finally {
        temporalMix.value=oldMix;uniforms.quantityWeights.value.copy(weights);uniforms.pressureRange.value.copy(range);
        uniforms.clipped.value=oldClip;uniforms.opacity.value=oldOpacity;volume.visible=oldVolume;
        [...slices.values()].forEach((row,i)=>row.mesh.visible=visible[i]);
      }
    },
    get blend() { return temporalMix.value; },
    advance(time: number, playing: boolean, presentationTime = time) {
      clock = presentationTime;
      temporalMix.value = !playing ? 1 : smooth((clock-transitionStart)/transitionSeconds);
      uniforms.quantityWeights.value.lerpVectors(quantityFrom, quantityTarget, smooth((clock-quantityStart)/.28));
    },
    clear() { lastFrame = null; temporalMix.value = 1; quantityReady = false; },
    update(frame: FieldFrame, quantity: FieldQuantity, slice: 'volume' | SliceAxis, range: readonly [number, number], animate = false) {
      if (frame !== lastFrame) {
        const compatible = animate && lastFrame && frame.time > lastFrame.time && frame.layoutId === lastFrame.layoutId && frame.weighting === lastFrame.weighting;
        const mix = temporalMix.value;
        for (let i=0;i<data.length;i++) previousData[i] += (data[i]-previousData[i])*mix;
        packFieldVolume(frame, data);
        if (!compatible) previousData.set(data);
        // Match the physical frame cadence instead of spending most of a slow frame frozen.
        // Interrupted arrivals start from the visible energy; there is no extrapolation.
        transitionSeconds = compatible ? Math.max(.08, Math.min(2, frame.time-lastFrame!.time)) : .1;
        temporalMix.value = compatible ? 0 : 1; transitionStart = clock;
        texture.needsUpdate = previousTexture.needsUpdate = true;
        for (const row of slices.values()) {
          const pixels = row.texture.image.data as Float32Array, previous = row.previousTexture.image.data as Float32Array;
          for (let i = 0; i < pixels.length; i++) previous[i] += (pixels[i] - previous[i]) * mix;
          row.sampleIndices.forEach((sample, i) => { pixels[i * 2] = displayEnergy(frame.primarySpl[sample]); pixels[i * 2 + 1] = displayEnergy(frame.residualSpl[sample]); });
          if (!compatible) previous.set(pixels);
          row.texture.needsUpdate = row.previousTexture.needsUpdate = true;
        }
        if (!compatible) quantityReady = false;
        lastFrame = frame;
      }
      const nextQuantity = new THREE.Vector3(quantity === 'primary' ? 1 : 0, quantity === 'residual' ? 1 : 0, quantity === 'reduction' ? 1 : 0);
      if (!quantityReady || !nextQuantity.equals(quantityTarget)) {
        quantityFrom.copy(quantityReady ? uniforms.quantityWeights.value : nextQuantity);
        quantityTarget.copy(nextQuantity); quantityStart = clock;
        if (!quantityReady) uniforms.quantityWeights.value.copy(nextQuantity);
        quantityReady = true;
      }
      (quantity === 'reduction' ? uniforms.improvementRange : uniforms.pressureRange).value.set(...range);
      volume.visible=slice==='volume';uniforms.opacity.value=requestedOpacity;sliceOpacity.value=requestedOpacity;
      for (const [axis, row] of slices) row.mesh.visible = slice === axis;
    },
    setClip(plane: THREE.Plane | null) { uniforms.clipped.value = plane ? 1 : 0; if (plane) uniforms.clip.value.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant); },
    setOpacity(value: number) { requestedOpacity=value;uniforms.opacity.value=value;sliceOpacity.value=value; },
    dispose() { texture.dispose(); previousTexture.dispose(); volume.geometry.dispose(); volumeMaterial.dispose(); slices.forEach(row => { row.texture.dispose(); row.previousTexture.dispose(); row.mesh.geometry.dispose(); row.mesh.material.dispose(); }); group.removeFromParent(); group.clear(); },
  };
}
