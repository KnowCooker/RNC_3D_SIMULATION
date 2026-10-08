import * as THREE from 'three';
import { createGalleryTerrainGeometry, galleryLandscapePlacements, GALLERY_LANDSCAPE_RADIUS, GALLERY_SHORE_INNER_RADIUS, GALLERY_WATER_LEVEL } from './gallery-landscape';
import type { GalleryEnvironment } from './champagne-gallery';

/** Continuous authored shore and receding foothills. Photography supplies the distant skyline. */
export function createScenicTerrain() {
  const group=new THREE.Group();group.name='scenic-terrain-360';
  const textureUrl=new URL('./assets/aerial_grass_rock_diff_2k.jpg',import.meta.url).href;
  const groundMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.94});
  const waterMaterial=new THREE.MeshPhysicalMaterial({color:'#537e7a',roughness:.25,metalness:.23,clearcoat:.75,clearcoatRoughness:.21,envMapIntensity:.8});
  const rockMaterial=new THREE.MeshStandardMaterial({color:'#aaa293',roughness:.95});
  const treeMaterial=new THREE.MeshStandardMaterial({color:'#60725a',roughness:1});
  const trunkMaterial=new THREE.MeshStandardMaterial({color:'#756956',roughness:1});
  const grassMaterial=new THREE.MeshStandardMaterial({color:'#93916b',roughness:1,side:THREE.DoubleSide});
  const panoramaUniforms:Record<string,THREE.IUniform>={
    galleryPrevious:{value:null},galleryNext:{value:null},galleryHasPrevious:{value:0},galleryHasNext:{value:0},galleryBlend:{value:1},
    galleryPreviousYaw:{value:0},galleryNextYaw:{value:0},galleryHaze:{value:0},galleryHorizon:{value:new THREE.Color('#c6d1cf')},galleryZenith:{value:new THREE.Color('#9dbbd0')},
  };
  // Blend to the same photo ray as the sky, after lighting/tone mapping and before
  // output encoding. Sharing uniforms also shares transitions and texture lifetime.
  const scenicMaterials=[groundMaterial,waterMaterial,rockMaterial,treeMaterial,trunkMaterial,grassMaterial];
  for(const material of scenicMaterials){
    material.fog=false;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,panoramaUniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGalleryWorld;').replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 galleryVertex=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          galleryVertex=instanceMatrix*galleryVertex;
        #endif
        vGalleryWorld=(modelMatrix*galleryVertex).xyz;
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vGalleryWorld;
        uniform sampler2D galleryPrevious,galleryNext;
        uniform float galleryHasPrevious,galleryHasNext,galleryBlend,galleryPreviousYaw,galleryNextYaw,galleryHaze;
        uniform vec3 galleryHorizon,galleryZenith;
        vec2 galleryPanoUV(vec3 d,float yaw){float c=cos(yaw),s=sin(yaw);d=vec3(c*d.x-s*d.z,d.y,s*d.x+c*d.z);return vec2(fract(atan(d.z,-d.x)/6.28318530718),asin(clamp(d.y,-1.,1.))/3.14159265359+.5);}
        vec3 galleryPanoSample(sampler2D image,vec2 uv){vec2 dx=dFdx(uv),dy=dFdy(uv);dx.x-=floor(dx.x+.5);dy.x-=floor(dy.x+.5);return texture2DGradEXT(image,uv,dx,dy).rgb;}
      `).replace('#include <colorspace_fragment>',`
        ${material===waterMaterial?`
        // The authored lake reflects the same panorama as the background. Its
        // normal map bends the reflected ray; grazing views carry more reflection.
        // This supplies distant reflections without a second full-scene render.
        if(galleryHasNext>.5){
          vec3 incident=normalize(vGalleryWorld-cameraPosition);
          vec3 worldNormal=inverseTransformDirection(normal,viewMatrix);
          vec3 reflected=reflect(incident,worldNormal);
          vec3 reflectedA=galleryHasPrevious>.5?galleryPanoSample(galleryPrevious,galleryPanoUV(reflected,galleryPreviousYaw)):galleryHorizon;
          vec3 reflectedB=galleryPanoSample(galleryNext,galleryPanoUV(reflected,galleryNextYaw));
          vec3 reflection=mix(reflectedA,reflectedB,galleryBlend);
          float fresnel=pow(1.-clamp(dot(-incident,worldNormal),0.,1.),5.);
          gl_FragColor.rgb=mix(gl_FragColor.rgb,reflection, .2+.65*fresnel);
        }
        `:''}
        float galleryFade=smoothstep(240.,590.,length(vGalleryWorld.xz));
        if(galleryHasNext>.5&&galleryFade>0.){
          vec3 d=normalize(vGalleryWorld-cameraPosition),fallback=mix(galleryHorizon,galleryZenith,smoothstep(0.,.8,d.y));
          vec3 a=galleryHasPrevious>.5?galleryPanoSample(galleryPrevious,galleryPanoUV(d,galleryPreviousYaw)):fallback;
          vec3 b=galleryPanoSample(galleryNext,galleryPanoUV(d,galleryNextYaw));
          vec3 photo=mix(a,b,galleryBlend);photo=mix(photo,galleryHorizon,galleryHaze*(1.-smoothstep(-.12,.16,d.y)));
          gl_FragColor.rgb=mix(gl_FragColor.rgb,photo,galleryFade);
        }
        #include <colorspace_fragment>
      `);
    };
    material.customProgramCacheKey=()=>material===waterMaterial?'gallery-photographic-water-v2':'gallery-photographic-distance-v1';
  }
  let disposed=false,texture:THREE.Texture|null=null,environment:GalleryEnvironment|null=null;
  function applyTexture(){groundMaterial.map=environment==='snow'||environment==='desert'?null:texture;groundMaterial.bumpMap=texture;groundMaterial.bumpScale=.07;groundMaterial.needsUpdate=true;rockMaterial.map=environment==='snow'?null:texture;rockMaterial.bumpMap=texture;rockMaterial.bumpScale=.14;rockMaterial.needsUpdate=true;}
  new THREE.TextureLoader().load(textureUrl,t=>{if(disposed){t.dispose();return;}texture=t;t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;applyTexture();});
  const terrain=new THREE.Mesh(new THREE.BufferGeometry(),groundMaterial);terrain.name='continuous-gallery-shore';terrain.receiveShadow=true;group.add(terrain);
  const waterG=new THREE.RingGeometry(GALLERY_SHORE_INNER_RADIUS,GALLERY_LANDSCAPE_RADIUS+20,256,1);waterG.rotateX(-Math.PI/2);
  const water=new THREE.Mesh(waterG,waterMaterial);water.name='level-gallery-lake';water.position.y=GALLERY_WATER_LEVEL;group.add(water);
  const waveData=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const a=x/128*Math.PI*2,b=y/128*Math.PI*2,i=(y*128+x)*4;let dx=0,dy=0;
    for(let k=0;k<9;k++){const fx=[7,13,-17,23,31,-37,41,47,-53][k],fy=[11,-5,19,-29,13,23,-37,41,17][k],w=9/(1+k*.4),c=Math.cos(a*fx+b*fy+k*1.7);dx+=w*c;dy+=w*Math.sin(a*fy-b*fx+k*.9);}
    waveData[i]=128+Math.round(dx);waveData[i+1]=128+Math.round(dy);waveData[i+2]=250;waveData[i+3]=255;
  }
  const wave=new THREE.DataTexture(waveData,128,128);wave.wrapS=wave.wrapT=THREE.RepeatWrapping;wave.generateMipmaps=true;wave.minFilter=THREE.LinearMipmapLinearFilter;wave.magFilter=THREE.LinearFilter;wave.anisotropy=8;wave.repeat.set(34,34);wave.needsUpdate=true;waterMaterial.normalMap=wave;waterMaterial.normalScale.set(.13,.08);
  const rockG=new THREE.IcosahedronGeometry(1,2),rp=rockG.getAttribute('position');
  for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),n=1+.10*Math.sin(x*9+y*3)+.07*Math.sin(z*13-y*5);rp.setXYZ(i,x*n,y*n,z*n);}rockG.computeVertexNormals();
  // Intersecting needle-bearing branch planes give porous crowns and real depth,
  // rather than stacking solid cones in front of the photographic horizon.
  const needleCanvas=document.createElement('canvas');needleCanvas.width=needleCanvas.height=128;const ctx=needleCanvas.getContext('2d')!;
  ctx.strokeStyle='#567b40';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(64,126);ctx.lineTo(64,4);ctx.stroke();
  for(let i=0;i<25;i++){const y=8+i*4.7,w=7+i*1.4;ctx.strokeStyle=i%2?'#90a878':'#516e3c';ctx.beginPath();ctx.moveTo(64,y+9);ctx.lineTo(64-w,y-3);ctx.moveTo(64,y+9);ctx.lineTo(64+w,y-3);ctx.stroke();}
  const needles=new THREE.CanvasTexture(needleCanvas);needles.colorSpace=THREE.SRGBColorSpace;treeMaterial.map=needles;treeMaterial.alphaTest=.25;treeMaterial.alphaToCoverage=true;treeMaterial.side=THREE.DoubleSide;
  const tv:number[]=[],tu:number[]=[],ti:number[]=[];
  for(let layer=0;layer<10;layer++)for(let branch=0;branch<9;branch++)for(let cross=0;cross<2;cross++){
    const a=branch*Math.PI*2/9+layer*.83,h=.08+layer*.089,length=.38*(1-h),radial=new THREE.Vector3(Math.sin(a),.19,Math.cos(a));
    const across=cross?new THREE.Vector3(0,1,0):new THREE.Vector3(Math.cos(a),0,-Math.sin(a));const base=new THREE.Vector3(0,h,0),n=tv.length/3;
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){tv.push(...base.clone().addScaledVector(radial,length*v).addScaledVector(across,(u-.5)*length*.66).toArray());tu.push(u,v);}ti.push(n,n+1,n+2,n,n+2,n+3);
  }
  const treeG=new THREE.BufferGeometry();treeG.setAttribute('position',new THREE.Float32BufferAttribute(tv,3));treeG.setAttribute('uv',new THREE.Float32BufferAttribute(tu,2));treeG.setIndex(ti);treeG.computeVertexNormals();
  const trunkG=new THREE.CylinderGeometry(.011,.025,.84,7);trunkG.translate(0,.37,0);
  const grassVertices:number[]=[],grassIndices:number[]=[];
  for(let blade=0;blade<9;blade++){
    const a=blade*2.399,h=.48+(blade%4)*.14,r=.04+(blade%3)*.07,start=grassVertices.length/3;
    for(let k=0;k<=3;k++)for(const sign of [-1,1]){const t=k/3,w=.03*(1-t);grassVertices.push(Math.sin(a)*(r+t*t*.26)+Math.cos(a)*w*sign,t*h,Math.cos(a)*(r+t*t*.26)-Math.sin(a)*w*sign);}
    for(let k=0;k<3;k++){const i=start+k*2;grassIndices.push(i,i+1,i+2,i+1,i+3,i+2);}
  }
  const grassG=new THREE.BufferGeometry();grassG.setAttribute('position',new THREE.Float32BufferAttribute(grassVertices,3));grassG.setIndex(grassIndices);grassG.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(rockG,rockMaterial,180),trees=new THREE.InstancedMesh(treeG,treeMaterial,240);
  const trunks=new THREE.InstancedMesh(trunkG,trunkMaterial,240),grasses=new THREE.InstancedMesh(grassG,grassMaterial,360);
  rocks.name='gallery-shore-rocks';trees.name='gallery-distant-crowns';trunks.name='gallery-distant-trunks';grasses.name='gallery-shore-grasses';
  for(const mesh of [rocks,trees,trunks,grasses]){mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  const dummy=new THREE.Object3D();
  function setEnvironment(env:GalleryEnvironment){
    if(environment===env)return;environment=env;
    terrain.geometry.dispose();terrain.geometry=createGalleryTerrainGeometry(env);
    water.visible=env==='coast'||env==='mountain';waterMaterial.color.set(env==='coast'?'#537e7a':'#426d71');
    rockMaterial.color.set(env==='desert'?'#bda17d':env==='snow'?'#c7d0cf':'#aaa293');treeMaterial.color.set(env==='snow'?'#929e91':'#60725a');grassMaterial.color.set(env==='snow'?'#b9b5a2':'#93916b');applyTexture();
    for(const [kind,mesh,count] of [['rock',rocks,180],['tree',trees,240],['grass',grasses,360]] as const){
      const rows=galleryLandscapePlacements(env,kind,count);mesh.count=rows.length;
      rows.forEach((row,i)=>{
        dummy.position.set(row.x,row.y+(kind==='rock'?row.scale*.03:-.025),row.z);
        // Trees stay upright; roots and rock bases enter the continuous terrain.
        dummy.rotation.set(0,row.angle,0);dummy.scale.set(row.scale,row.scale*(kind==='rock'?.55:1),row.scale*(kind==='rock'?.8:1));
        dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(kind==='tree')trunks.setMatrixAt(i,dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
      if(kind==='tree'){trunks.count=rows.length;trunks.instanceMatrix.needsUpdate=true;trunks.computeBoundingSphere();}
    }
    group.userData.environment=env;group.userData.coverageDegrees=360;group.userData.shoreRadius=GALLERY_SHORE_INNER_RADIUS;group.userData.waterLevel=GALLERY_WATER_LEVEL;
  }
  return {group,setEnvironment,
    connectPanorama(material:THREE.ShaderMaterial){
      for(const [local,source] of Object.entries({galleryPrevious:'previous',galleryNext:'next',galleryHasPrevious:'hasPrevious',galleryHasNext:'hasNext',galleryBlend:'blend',galleryPreviousYaw:'previousYaw',galleryNextYaw:'nextYaw',galleryHaze:'haze',galleryHorizon:'horizon',galleryZenith:'zenith'}))panoramaUniforms[local]=material.uniforms[source];
      scenicMaterials.forEach(material=>{material.needsUpdate=true;});
    },
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const instances of [rocks,trees,trunks,grasses])instances.dispose();texture?.dispose();wave.dispose();needles.dispose();terrain.geometry.dispose();waterG.dispose();rockG.dispose();treeG.dispose();trunkG.dispose();grassG.dispose();groundMaterial.dispose();waterMaterial.dispose();rockMaterial.dispose();treeMaterial.dispose();trunkMaterial.dispose();grassMaterial.dispose();}};
}
