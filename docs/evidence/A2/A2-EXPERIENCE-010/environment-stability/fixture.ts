import * as THREE from 'three';
import { createDrivingRoad } from '../../src/team-a/viewer/driving-road';
import { createPanoramaSky } from '../../src/team-a/viewer/panorama-sky';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(960,540);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.93;document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(55,960/540,.08,1200),scene=new THREE.Scene();scene.background=new THREE.Color('#c6d1cf');scene.fog=new THREE.Fog('#c6d1cf',230,360);scene.add(new THREE.HemisphereLight('#e3f2ff','#66564a',.8));const sun=new THREE.DirectionalLight('#fff0d7',2.5);sun.position.set(4,7,5);scene.add(sun);
const road=createDrivingRoad(8);scene.add(road.group);road.ensureLoaded();const sky=createPanoramaSky('isolated-sky');scene.add(sky.mesh);sky.mesh.visible=false;
const texture=new THREE.TextureLoader().load(new URL('../../src/team-a/viewer/assets/alps_field_8k.jpg',import.meta.url).href,()=>{texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;sky.set(texture,.98);road.setEnvironment('mountain',texture);(window as any).textureLoaded=true;});
const pixels=new Uint8Array(960*540*4);let last:Uint8Array|null=null;
function cameraPose(angle=0,translation=0){camera.position.set(Math.sin(angle)*6+translation,2.4,Math.cos(angle)*6);camera.lookAt(translation,4.5,0);camera.updateMatrixWorld();}
function render(time=0,angle=0,onlySky=false,translation=0){road.group.visible=!onlySky;sky.mesh.visible=onlySky;cameraPose(angle,translation);road.update(time,60,1/60);sky.update(1/60);renderer.render(scene,camera);}
function metrics(){renderer.getContext().readPixels(0,0,960,540,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixels);let sum=0,max=0,count=0,dark=0;for(let y=480;y<540;y+=2)for(let x=240;x<720;x+=2){const i=(y*960+x)*4;if(pixels[i]+pixels[i+1]+pixels[i+2]<18)dark++;if(last){let d=(Math.abs(pixels[i]-last[i])+Math.abs(pixels[i+1]-last[i+1])+Math.abs(pixels[i+2]-last[i+2]))/3;sum+=d;max=Math.max(max,d);}count++;}last=pixels.slice();return{mean:sum/count,max,darkFraction:dark/count};}
(window as any).fixture={renderer,scene,road,sky,render,metrics,ready:()=>road.ready&&(window as any).textureLoaded,reset:()=>{last=null;},hash(){const gl=renderer.getContext();gl.readPixels(0,0,960,540,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let h=2166136261;for(const v of pixels){h=Math.imul(h^v,16777619)>>>0;}return h;},warm(){for(let i=0;i<100;i++)render();},async environment(id){road.setEnvironment(id,texture);for(let i=0;i<100;i++)render();},dispose(){road.dispose();sky.dispose();texture.dispose();renderer.dispose();}};

(window as any).fixture.clearance=()=>{
 const crowns=road.floor.getObjectByName('roadside-foliage') as THREE.InstancedMesh;crowns.geometry.computeBoundingSphere();
 const m=new THREE.Matrix4(),world=new THREE.Matrix4(),p=new THREE.Vector3(),scale=new THREE.Vector3();let minimum=Infinity;
 for(let d=0;d<=1200;d+=12){road.update(d/ (60/3.6),60);road.group.updateMatrixWorld(true);for(let i=0;i<crowns.count;i++){crowns.getMatrixAt(i,m);world.multiplyMatrices(crowns.matrixWorld,m);p.copy(crowns.geometry.boundingSphere!.center).applyMatrix4(world);scale.setFromMatrixScale(world);if(scale.lengthSq()<1e-6)continue;const radius=crowns.geometry.boundingSphere!.radius*Math.max(scale.x,scale.y,scale.z);if(p.y-radius<20&&p.y+radius>1.1)minimum=Math.min(minimum,Math.hypot(p.x,p.z)-radius);}}
 return minimum;
};
