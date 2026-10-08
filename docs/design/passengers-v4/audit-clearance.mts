/** Offline inspection of installed static GLBs; no browser, network or textures. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createXPengModel } from '../../../src/team-a/viewer/xpeng-model';
import { xpengCatalog } from '../../../src/team-a/viewer/xpeng-catalog';
import { passengerMounts } from '../../../src/team-a/viewer/passenger-cabin';
import { passengerHipOffset, PASSENGERS } from '../../../src/team-a/viewer/passenger-model';
import { solveSeatedPlacement, clearanceViolations, seatedPoint } from '../../../src/team-a/viewer/passenger-clearance';

// Parse only the uncompressed POSITION data and scene transforms from our baked GLB exports.
async function pointsFromGlb(file:string) {
  const b=await readFile(file), size=b.readUInt32LE(12), json=JSON.parse(b.subarray(20,20+size).toString());
  const start=20+size+8, points:THREE.Vector3[]=[];
  function walk(id:number,parent:THREE.Matrix4) {
    const n=json.nodes[id], local=new THREE.Matrix4();
    if(n.matrix)local.fromArray(n.matrix);
    else local.compose(new THREE.Vector3().fromArray(n.translation??[0,0,0]),new THREE.Quaternion().fromArray(n.rotation??[0,0,0,1]),new THREE.Vector3().fromArray(n.scale??[1,1,1]));
    const matrix=parent.clone().multiply(local);
    if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){
      const a=json.accessors[p.attributes.POSITION], v=json.bufferViews[a.bufferView];
      if(a.componentType!==5126||a.type!=='VEC3'||a.sparse)throw Error('Expected baked float positions');
      for(let i=0;i<a.count;i++){const o=start+(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??12);points.push(new THREE.Vector3(b.readFloatLE(o),b.readFloatLE(o+4),b.readFloatLE(o+8)).applyMatrix4(matrix));}
    }
    for(const c of n.children??[])walk(c,matrix);
  }
  for(const n of json.scenes[json.scene??0].nodes)walk(n,new THREE.Matrix4());
  return points;
}
const assets=[];
class BlobReader {
  result:ArrayBuffer|string|null=null;onloadend?:()=>void;
  readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}
  readAsDataURL(blob:Blob){void blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onloadend?.();});}
}
Object.defineProperty(globalThis,'FileReader',{value:BlobReader});
for(const {id} of PASSENGERS)for(const driver of [false,true]){
  try{const points=await pointsFromGlb(`public/passengers-local/${id}-${driver?'driver':'seated'}.glb`);const samples=new Map<string,THREE.Vector3>();
    for(const p of points){const key=p.toArray().map(v=>Math.round(v/.022)).join('/');if(!samples.has(key))samples.set(key,p);}
    assets.push({id,driver,points,samples:[...samples.values()],bounds:new THREE.Box3().setFromPoints(points)});
  }catch(e){console.log('UNAVAILABLE',id,driver,String(e));}
}
const report=[];
for(const spec of xpengCatalog){
  const car=createXPengModel(spec.id);
  for(const seat of passengerMounts(car))for(const a of assets.filter(a=>a.driver===!!seat.driver)){
    const fit=solveSeatedPlacement(a.samples,a.bounds,seat,passengerHipOffset(a.id),a.points);
    const all=clearanceViolations(a.points,fit,seat);
    if(all.count>0){
      const hits=seat.obstacles.map(b=>({part:b.part,name:b.name,min:b.min.toArray(),max:b.max.toArray(),points:a.samples.map(p=>seatedPoint(p,fit)).filter(p=>p.x>b.min.x&&p.x<b.max.x&&p.y>b.min.y&&p.y<b.max.y&&p.z>b.min.z&&p.z<b.max.z).length})).filter(b=>b.points>0);
      console.log('DETAIL',a.id,JSON.stringify(hits));
      console.log('PELVIS',a.id,new THREE.Box3().setFromPoints(a.points.filter(p=>Math.abs(p.x)<.14&&p.z<.16&&p.z>-.10&&p.y<.1)).min.toArray());
      console.log('COLLISION_POINTS',a.id,a.samples.filter(p=>clearanceViolations([p],fit,seat).count>0).slice(0,16).map(p=>p.toArray()));
    }
    const contacts=fit.contacts?.map(b=>({...b,min:b.min.toArray(),max:b.max.toArray(),torus:b.torus?{...b.torus,inverse:b.torus.inverse.toArray()}:undefined}));
    let corrected=0,maxCorrection=0;
    if(fit.contacts)for(const p of a.points){const distance=seatedPoint(p,fit).distanceTo(seatedPoint(p,{...fit,contacts:undefined}));if(distance>.00001)corrected++;maxCorrection=Math.max(maxCorrection,distance);}
    report.push({car:spec.id,seat:seat.id,id:a.id,driver:a.driver,position:fit.position.toArray(),scale:fit.scale,legScale:fit.legScale,sampled:fit.collisions,vertices:all.count,penetration:all.maxPenetration,floor:seat.floor,roof:seat.roof,origin:seat.origin.toArray(),contacts,corrected,maxCorrection});
  }
  if(process.argv.includes('--export')&&['gx','m03'].includes(spec.id)){
    car.inspection.setBody('hidden');
    car.group.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])for(const k of Object.keys(m))if(k==='map'||k.endsWith('Map'))(m as unknown as Record<string,unknown>)[k]=null;});
    const glb=await new GLTFExporter().parseAsync(car.group,{binary:true,onlyVisible:true,trs:true});await writeFile(`output/passenger-v4/${spec.id}-cabin.glb`,Buffer.from(glb as ArrayBuffer));
  }
  car.dispose();console.log(spec.id,report.filter(r=>r.car===spec.id&&r.vertices>0).map(r=>[r.seat,r.id,r.vertices,r.penetration.toFixed(3)]));
}
await mkdir('output/passenger-v4',{recursive:true});
await writeFile('output/passenger-v4/clearance-audit.json',JSON.stringify(report,null,2));
console.log('TOTAL',report.length,'FAILED',report.filter(r=>r.vertices>0).length);
if(assets.length!==12||report.some(r=>r.vertices>0))process.exitCode=1;
