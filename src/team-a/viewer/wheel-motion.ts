import * as THREE from 'three';

/** Spin geometry about the axle, preserving the semantic part and physical mounting frame. */
export function createWheelMotion(group: THREE.Group, center: THREE.Vector3, radius: number) {
  if (!(radius > 0)) throw Error('Wheel radius must be positive');
  const pivot = new THREE.Group(); pivot.name = 'rolling-wheel-geometry'; pivot.position.copy(center);pivot.rotation.order='YXZ';
  const fixed=group.children.filter(o=>o.name==='brake-caliper').map(o=>({o,position:o.position.clone(),rotation:o.quaternion.clone()}));
  for (const child of [...group.children]) {
    if (child.name === 'brake-caliper') continue;
    child.position.sub(center); pivot.add(child);
  }
  group.add(pivot);
  return { pivot, setSteering(angle:number){pivot.rotation.y=angle;const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);for(const row of fixed){row.o.position.copy(row.position).sub(center).applyQuaternion(q).add(center);row.o.quaternion.copy(q).multiply(row.rotation);}}, setDistance(distance: number) { pivot.rotation.x = (distance / radius) % (Math.PI * 2); } };
}
