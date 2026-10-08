// Role: A1; Task: A1-FULL-021; stdout only, does not overwrite saved evidence.
import * as THREE from 'three';
import { createXPengModel } from '../../../../../src/team-a/viewer/xpeng-model';
const rows=[];
for(const id of ['gx','x9','p7plus','l03','m03'] as const){
  const start=performance.now(),model=createXPengModel(id),materials=new Set(),geometries=new Set<THREE.BufferGeometry>();
  let meshes=0,triangles=0;
  model.group.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;geometries.add(o.geometry);materials.add(o.material);}});
  rows.push({id,meshes,triangles,materials:materials.size,geometryBytes:[...geometries].reduce((sum,g)=>sum+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength??0),0),buildMs:Math.round(performance.now()-start),parts:model.parts.length,bounds:new THREE.Box3().setFromObject(model.group).getSize(new THREE.Vector3()).toArray()});
  model.dispose();
}
console.log(JSON.stringify(rows,null,2));
