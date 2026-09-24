import * as THREE from 'three';

export type WheelCorner = 'fl' | 'fr' | 'rl' | 'rr';
export const wheelCorners: WheelCorner[] = ['fl', 'fr', 'rl', 'rr'];

/** Split an authored four-corner mesh by its actual triangles, preserving every vertex attribute. */
export function splitFourWheelMesh(mesh: THREE.Mesh): { pieces: Record<WheelCorner, THREE.Mesh>; sourceGeometry: THREE.BufferGeometry } {
  const sourceGeometry = mesh.geometry;
  const indices = sourceGeometry.getIndex();
  const positions = sourceGeometry.getAttribute('position');
  if (!indices || !(positions instanceof THREE.BufferAttribute) || indices.count % 3 !== 0) {
    throw new Error(`Wheel source ${mesh.name} must have indexed triangles`);
  }
  const buckets = Object.fromEntries(wheelCorners.map(corner => [corner, [] as number[]])) as Record<WheelCorner, number[]>;
  mesh.updateWorldMatrix(true, false);
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const classify = (point: THREE.Vector3): WheelCorner => `${point.z > 0 ? 'f' : 'r'}${point.x > 0 ? 'l' : 'r'}` as WheelCorner;
  for (let triangle = 0; triangle < indices.count; triangle += 3) {
    const ids = [indices.getX(triangle), indices.getX(triangle + 1), indices.getX(triangle + 2)];
    ids.forEach((id, i) => vertices[i].fromBufferAttribute(positions, id).applyMatrix4(mesh.matrixWorld));
    const corner = classify(vertices[0]);
    if (vertices.some(vertex => classify(vertex) !== corner)) throw new Error(`Wheel triangle crosses vehicle center: ${mesh.name}`);
    buckets[corner].push(...ids);
  }
  if (wheelCorners.some(corner => buckets[corner].length === 0) || wheelCorners.reduce((count, corner) => count + buckets[corner].length, 0) !== indices.count) {
    throw new Error(`Wheel quadrants are incomplete: ${mesh.name}`);
  }
  const parent = mesh.parent;
  if (!parent) throw new Error(`Wheel source has no parent: ${mesh.name}`);
  const pieces = {} as Record<WheelCorner, THREE.Mesh>;
  for (const corner of wheelCorners) {
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(sourceGeometry.attributes)) {
      if (!(attribute instanceof THREE.BufferAttribute) || !(attribute.array instanceof Float32Array)) {
        throw new Error(`Unsupported wheel attribute ${name}: ${mesh.name}`);
      }
      const values = new Float32Array(buckets[corner].length * attribute.itemSize);
      buckets[corner].forEach((sourceIndex, vertex) => {
        for (let component = 0; component < attribute.itemSize; component++) {
          values[vertex * attribute.itemSize + component] = attribute.array[sourceIndex * attribute.itemSize + component];
        }
      });
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize, attribute.normalized));
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const piece = mesh.clone(false);
    piece.name = `${mesh.name}-${corner}`; piece.geometry = geometry;
    parent.add(piece); pieces[corner] = piece;
  }
  parent.remove(mesh);
  return { pieces, sourceGeometry };
}
