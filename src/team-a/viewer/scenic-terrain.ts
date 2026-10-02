import * as THREE from 'three';
import type { GalleryEnvironment } from './champagne-gallery';

/** Original procedural terrain surrounding the pavilion; the HDR is only the
 * distant sky/light source. Every azimuth has actual lit, depth-tested geometry. */
export function createScenicTerrain() {
  const group=new THREE.Group();group.name='scenic-terrain-360';
  const textureUrl=new URL('./assets/aerial_grass_rock_diff_2k.jpg',import.meta.url).href;
  const groundMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.92});
  const waterMaterial=new THREE.MeshPhysicalMaterial({color:'#254f5a',roughness:.30,metalness:.48,clearcoat:.35,clearcoatRoughness:.19});
  const rockMaterial=new THREE.MeshStandardMaterial({color:'#929082',roughness:.95});
  const treeMaterial=new THREE.MeshStandardMaterial({color:'#405843',roughness:1});
  let disposed=false,texture:THREE.Texture|null=null,environment:GalleryEnvironment|null=null;
  new THREE.TextureLoader().load(textureUrl,t=>{if(disposed){t.dispose();return;}texture=t;t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;groundMaterial.map=t;groundMaterial.bumpMap=t;groundMaterial.bumpScale=.18;groundMaterial.needsUpdate=true;rockMaterial.map=t;rockMaterial.bumpMap=t;rockMaterial.bumpScale=.32;rockMaterial.needsUpdate=true;});
  const terrain=new THREE.Mesh(new THREE.BufferGeometry(),groundMaterial);terrain.receiveShadow=true;group.add(terrain);
  const waterG=new THREE.RingGeometry(28,160,192,12);waterG.rotateX(-Math.PI/2);
  const water=new THREE.Mesh(waterG,waterMaterial);water.position.y=-.45;group.add(water);
  const waveData=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const a=x/128*Math.PI*2,b=y/128*Math.PI*2,i=(y*128+x)*4;let dx=0,dy=0;
    for(let k=0;k<9;k++){const fx=[7,13,-17,23,31,-37,41,47,-53][k],fy=[11,-5,19,-29,13,23,-37,41,17][k],w=9/(1+k*.4),c=Math.cos(a*fx+b*fy+k*1.7);dx+=w*c;dy+=w*Math.sin(a*fy-b*fx+k*.9);}
    waveData[i]=128+Math.round(dx);waveData[i+1]=128+Math.round(dy);waveData[i+2]=250;waveData[i+3]=255;
  }
  const wave=new THREE.DataTexture(waveData,128,128);wave.wrapS=wave.wrapT=THREE.RepeatWrapping;wave.minFilter=wave.magFilter=THREE.LinearFilter;wave.repeat.set(18,18);wave.needsUpdate=true;waterMaterial.normalMap=wave;waterMaterial.normalScale.setScalar(.16);
  const rockG=new THREE.IcosahedronGeometry(1,3),rp=rockG.getAttribute('position');
  for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),n=1+.10*Math.sin(x*9+y*3)+.07*Math.sin(z*13-y*5);rp.setXYZ(i,x*n,y*n,z*n);}rockG.computeVertexNormals();
  // Intersecting needle-bearing branch planes give porous crowns and real depth,
  // rather than stacking solid cones in front of the photographic horizon.
  const needleCanvas=document.createElement('canvas');needleCanvas.width=needleCanvas.height=128;const ctx=needleCanvas.getContext('2d')!;
  ctx.strokeStyle='#567b40';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(64,126);ctx.lineTo(64,4);ctx.stroke();
  for(let i=0;i<25;i++){const y=8+i*4.7,w=7+i*1.4;ctx.strokeStyle=i%2?'#90a878':'#516e3c';ctx.beginPath();ctx.moveTo(64,y+9);ctx.lineTo(64-w,y-3);ctx.moveTo(64,y+9);ctx.lineTo(64+w,y-3);ctx.stroke();}
  const needles=new THREE.CanvasTexture(needleCanvas);needles.colorSpace=THREE.SRGBColorSpace;treeMaterial.map=needles;treeMaterial.alphaTest=.25;treeMaterial.side=THREE.DoubleSide;
  const tv:number[]=[],tu:number[]=[],ti:number[]=[];
  for(let layer=0;layer<10;layer++)for(let branch=0;branch<9;branch++)for(let cross=0;cross<2;cross++){
    const a=branch*Math.PI*2/9+layer*.83,h=.08+layer*.089,length=.38*(1-h),radial=new THREE.Vector3(Math.sin(a),.19,Math.cos(a));
    const across=cross?new THREE.Vector3(0,1,0):new THREE.Vector3(Math.cos(a),0,-Math.sin(a));const base=new THREE.Vector3(0,h,0),n=tv.length/3;
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){tv.push(...base.clone().addScaledVector(radial,length*v).addScaledVector(across,(u-.5)*length*.66).toArray());tu.push(u,v);}ti.push(n,n+1,n+2,n,n+2,n+3);
  }
  const treeG=new THREE.BufferGeometry();treeG.setAttribute('position',new THREE.Float32BufferAttribute(tv,3));treeG.setAttribute('uv',new THREE.Float32BufferAttribute(tu,2));treeG.setIndex(ti);treeG.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(rockG,rockMaterial,90),trees=new THREE.InstancedMesh(treeG,treeMaterial,200);
  for(const mesh of [rocks,trees]){mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  const dummy=new THREE.Object3D();
  function height(x:number,z:number,env:GalleryEnvironment){
    const r=Math.hypot(x,z),edge=THREE.MathUtils.smoothstep(r,45,125);
    const f=.5+.21*Math.sin(x*.014+z*.018)+.18*Math.sin(x*.033-z*.012)+.08*Math.sin(x*.073+z*.055)+.03*Math.sin(x*.181-z*.132);
    const ridges=Math.pow(Math.max(0,1-Math.abs(2*f-1)),env==='desert'?2:3);
    const scale=env==='coast'?22:env==='desert'?48:env==='snow'?165:115;
    return -2.2+edge*(scale*ridges+Math.max(0,r-150)*.08)+(env==='desert'?2:0);
  }
  function setEnvironment(env:GalleryEnvironment){
    if(environment===env)return;environment=env;
    const positions:number[]=[],colours:number[]=[],uv:number[]=[],indices:number[]=[];
    const radial=112,angular=256,green=new THREE.Color('#839570'),stone=new THREE.Color('#85877f'),snow=new THREE.Color('#e6edf0'),sand=new THREE.Color('#c7a275');
    for(let r=0;r<=radial;r++)for(let a=0;a<=angular;a++){
      const radius=29+Math.pow(r/radial,1.5)*470,angle=a/angular*Math.PI*2,x=Math.sin(angle)*radius,z=Math.cos(angle)*radius,y=height(x,z,env);
      positions.push(x,y,z);uv.push(x/18,z/18);
      const slope=Math.hypot(height(x+1,z,env)-y,height(x,z+1,env)-y);
      const color=(env==='desert'?sand:green).clone().lerp(stone,Math.min(.85,slope*.7));
      if(env==='snow')color.lerp(snow,THREE.MathUtils.smoothstep(y,8,45)*(1-Math.min(.7,slope*.12)));
      else if(env==='mountain')color.lerp(snow,THREE.MathUtils.smoothstep(y,83,108));
      color.multiplyScalar(.92+.08*Math.sin(x*.17+z*.13));colours.push(color.r,color.g,color.b);
    }
    for(let r=0;r<radial;r++)for(let a=0;a<angular;a++){const i=r*(angular+1)+a,j=i+angular+1;indices.push(i,j,i+1,i+1,j,j+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();terrain.geometry.dispose();terrain.geometry=g;
    water.visible=env==='coast'||env==='mountain';waterMaterial.color.set(env==='coast'?'#254f5a':'#285b60');
    rockMaterial.color.set(env==='desert'?'#b28a62':env==='snow'?'#b4bdc1':'#939080');treeMaterial.color.set(env==='snow'?'#7b928a':'#38543d');trees.visible=env!=='desert';
    let seed=9741;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<90;i++){
      const a=random()*Math.PI*2,r=80+random()*270,x=Math.sin(a)*r,z=Math.cos(a)*r,y=height(x,z,env),s=.35+random()*1.5;
      dummy.position.set(x,y+s*.15,z);dummy.rotation.set(random(),random()*6,random());dummy.scale.set(s,s*.65,s*.9);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
    }
    for(let i=0;i<200;i++){
      const a=random()*Math.PI*2,r=95+random()*250,x=Math.sin(a)*r,z=Math.cos(a)*r,y=height(x,z,env),h=5+random()*9;
      dummy.position.set(x,y,z);dummy.rotation.set(0,a,0);dummy.scale.set(y<-.5?0:h,h,y<-.5?0:h);dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate=true;trees.instanceMatrix.needsUpdate=true;rocks.computeBoundingSphere();trees.computeBoundingSphere();
    group.userData.environment=env;group.userData.coverageDegrees=360;
  }
  return {group,setEnvironment,dispose(){disposed=true;group.removeFromParent();texture?.dispose();wave.dispose();needles.dispose();terrain.geometry.dispose();waterG.dispose();rockG.dispose();treeG.dispose();groundMaterial.dispose();waterMaterial.dispose();rockMaterial.dispose();treeMaterial.dispose();}};
}
