import * as THREE from 'three';

/** Spin geometry about the axle, preserving the semantic part and physical mounting frame. */
export function createWheelMotion(group: THREE.Group, center: THREE.Vector3, radius: number) {
  if (!(radius > 0)) throw Error('Wheel radius must be positive');
  const pivot = new THREE.Group(); pivot.name = 'rolling-wheel-geometry'; pivot.position.copy(center);
  for (const child of [...group.children]) {
    if (child.name === 'brake-caliper') continue;
    child.position.sub(center); pivot.add(child);
  }
  group.add(pivot);
  return { pivot, setDistance(distance: number) { pivot.rotation.x = (distance / radius) % (Math.PI * 2); } };
}
