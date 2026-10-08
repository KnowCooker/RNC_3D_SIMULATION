import * as THREE from 'three';
import { upholsteryGrain } from './upholstery-surface';

/** Authored PBR finishes; all maps are deterministic, local and mip-filtered. */
export function refineVehicleMaterials(paint:THREE.MeshPhysicalMaterial,glass:THREE.MeshPhysicalMaterial,leather:THREE.MeshPhysicalMaterial,metal:THREE.MeshPhysicalMaterial) {
  const textures=new Set<THREE.Texture>(),materials=new Set<THREE.Material>();
  function texture(size:number,colour:(x:number,y:number)=>number[],repeat=1){
    const data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)data.set([...colour(x,y),255],(y*size+x)*4);
    const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);
    t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;textures.add(t);return t;
  }
  const hash=(x:number,y:number)=>((Math.imul(x+31,374761393)^Math.imul(y+17,668265263))>>>0)%97/96;
  const film=texture(128,(x,y)=>{const c=Math.round(236+hash(x,y)*18);return [c,c,c];},6);
  paint.name='automotive-metallic-basecoat';paint.roughness=.19;paint.metalness=.62;paint.clearcoat=1;paint.clearcoatRoughness=.085;paint.ior=1.5;paint.envMapIntensity=1.05;
  paint.roughnessMap=film;paint.userData.inspectionRim=true;
  glass.color.set('#3a555e');glass.metalness=0;glass.roughness=.08;glass.opacity=.62;glass.transparent=true;glass.depthWrite=false;
  glass.envMapIntensity=.8;glass.ior=1.52;glass.forceSinglePass=true;glass.userData.inspectionGlass=true;
  metal.roughness=.25;metal.metalness=.92;metal.envMapIntensity=.9;
  const grain=upholsteryGrain();textures.add(grain);
  leather.color.set('#c9bca8');leather.roughness=.68;leather.metalness=0;leather.bumpMap=grain;leather.bumpScale=.0009;
  leather.roughnessMap=grain;leather.sheen=.32;leather.sheenRoughness=.8;leather.sheenColor.set('#e2d6c3');
  const perforation=texture(128,(x,y)=>{const dx=(x%16)-8,dy=(y%16)-8,r=Math.hypot(dx,dy),c=Math.round(234-95*Math.exp(-r*r/3)+hash(x,y)*12);return [c,c,c];},3);
  const perforated=leather.clone();perforated.name='perforated-seat-leather';perforated.bumpMap=perforation;perforated.bumpScale=.0014;perforated.roughnessMap=perforation;materials.add(perforated);
  const carpetGrain=texture(128,(x,y)=>{const c=85+Math.round(hash(x,y)*110);return [c,c,c];},9);
  const carpet=new THREE.MeshStandardMaterial({color:'#494743',roughness:1,bumpMap:carpetGrain,bumpScale:.0018,roughnessMap:carpetGrain});carpet.name='woven-cabin-carpet';materials.add(carpet);
  const woodMap=texture(128,(x,y)=>{const v=1.5*Math.sin(y*.41+Math.sin(x*.027)*1.5)+hash(x,y)*2.5;return [105+v,87+v,66+v];});woodMap.colorSpace=THREE.SRGBColorSpace;woodMap.repeat.set(1,3);
  const wood=new THREE.MeshStandardMaterial({map:woodMap,roughness:.44,metalness:.04,bumpMap:woodMap,bumpScale:.0004});wood.name='satin-open-pore-trim';materials.add(wood);
  const satin=new THREE.MeshStandardMaterial({color:'#b7b7b1',roughness:.29,metalness:.83});satin.name='satin-cabin-metal';materials.add(satin);
  const softTouch=new THREE.MeshStandardMaterial({color:'#393936',roughness:.6,bumpMap:grain,bumpScale:.0005});softTouch.name='soft-touch-dashboard';materials.add(softTouch);
  const backShell=new THREE.MeshStandardMaterial({color:'#a39a8b',roughness:.72,bumpMap:grain,bumpScale:.0006});backShell.name='warm-seat-shell';materials.add(backShell);
  const ambient=new THREE.MeshStandardMaterial({color:'#e5c99b',emissive:'#e6bc7e',emissiveIntensity:.38,roughness:.4});ambient.name='warm-cabin-ambient';materials.add(ambient);
  const screenMap=texture(128,(x,y)=>{
    const grid=(x>8&&x<120&&y>12&&y<112),route=Math.abs(x-(48+20*Math.sin(y*.035)))<2&&y>24&&y<112;
    const card=x>88&&x<118&&y>28&&y<78,bar=y>8&&y<12&&x>12&&x<112;
    return route?[98,169,180]:bar?[146,152,137]:card?[37,48,53]:grid?[21,32,37]:[8,13,17];
  });screenMap.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.MeshStandardMaterial({map:screenMap,emissiveMap:screenMap,emissive:'#ffffff',emissiveIntensity:.22,roughness:.25,metalness:.12});screen.name='decorative-cockpit-display';materials.add(screen);
  let disposed=false;
  return {perforated,carpet,wood,satin,softTouch,backShell,ambient,screen,dispose(){if(disposed)return;disposed=true;textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());}};
}
