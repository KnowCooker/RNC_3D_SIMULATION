import * as THREE from 'three';
import { createVehicleModel, type VehicleKind } from '../../../../src/team-a/viewer/vehicle-model';
for (const kind of ['ice','bev','hev','erev'] as VehicleKind[]) {
  const model=createVehicleModel(kind); let triangles=0, meshes=0;
  model.group.traverse(object=>{ if(object instanceof THREE.Mesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;} });
  console.log(JSON.stringify({kind,meshes,triangles}));model.dispose();
}
