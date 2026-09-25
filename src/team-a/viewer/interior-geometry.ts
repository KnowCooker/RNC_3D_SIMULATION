import * as THREE from 'three';

export type InteriorRegion = 'front-left' | 'front-right' | 'rear-bench' | 'remainder';
const regions: InteriorRegion[] = ['front-left', 'front-right', 'rear-bench', 'remainder'];

/** Partition the fixed Range Rover Interior5 upholstery mesh by connected source triangles. */
export function splitInteriorSeatIslands(mesh: THREE.Mesh): {
  pieces: Record<InteriorRegion, THREE.Mesh>;
  sourceGeometry: THREE.BufferGeometry;
  triangles: Record<InteriorRegion, number>;
} {
  const sourceGeometry = mesh.geometry;
  const indices = sourceGeometry.getIndex();
  const positions = sourceGeometry.getAttribute('position');
  if (!indices || !(positions instanceof THREE.BufferAttribute) || indices.count % 3 !== 0) {
    throw new Error(`Interior source ${mesh.name} must have indexed triangles`);
  }
  mesh.updateWorldMatrix(true, false);
  const world = Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld));
  const parent = Uint32Array.from({ length: positions.count }, (_, i) => i);
  const find = (index: number): number => {
    while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; }
    return index;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a), rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2);
    union(a, b); union(b, c);
  }
  const components = new Map<number, { bounds: THREE.Box3; ids: number[] }>();
  for (let i = 0; i < indices.count; i += 3) {
    const ids = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    const root = find(ids[0]);
    const component = components.get(root) ?? { bounds: new THREE.Box3(), ids: [] };
    component.ids.push(...ids);
    for (const id of ids) component.bounds.expandByPoint(world[id]);
    components.set(root, component);
  }
  const buckets = Object.fromEntries(regions.map(region => [region, [] as number[]])) as Record<InteriorRegion, number[]>;
  for (const { bounds, ids } of components.values()) {
    const { min, max } = bounds;
    const front = min.z >= -0.65 && max.z <= 0.55 && min.y >= 0.55 && max.y <= 1.65;
    const dashboardOrRoof = min.z > 0.2 && min.y > 1.05;
    const rear = min.z >= -1.7 && max.z <= -0.65 && min.y >= 0.55 && max.y <= 1.65;
    const region: InteriorRegion = front && !dashboardOrRoof && min.x >= 0.12 && max.x <= 0.72 ? 'front-left'
      : front && !dashboardOrRoof && max.x <= -0.12 && min.x >= -0.72 ? 'front-right'
        : rear && min.x >= -0.72 && max.x <= 0.72 ? 'rear-bench' : 'remainder';
    buckets[region].push(...ids);
  }
  const triangles = Object.fromEntries(regions.map(region => [region, buckets[region].length / 3])) as Record<InteriorRegion, number>;
  if (triangles['front-left'] < 600 || triangles['front-right'] < 600 || triangles['rear-bench'] < 480 ||
      regions.reduce((sum, region) => sum + triangles[region], 0) !== indices.count / 3) {
    throw new Error(`Unexpected Range Rover seat topology: ${JSON.stringify(triangles)}`);
  }
  const owner = mesh.parent;
  if (!owner) throw new Error(`Interior source has no parent: ${mesh.name}`);
  const pieces = {} as Record<InteriorRegion, THREE.Mesh>;
  for (const region of regions) {
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(sourceGeometry.attributes)) {
      if (!(attribute instanceof THREE.BufferAttribute) || !(attribute.array instanceof Float32Array)) {
        throw new Error(`Unsupported interior attribute ${name}: ${mesh.name}`);
      }
      const values = new Float32Array(buckets[region].length * attribute.itemSize);
      buckets[region].forEach((sourceIndex, vertex) => {
        for (let component = 0; component < attribute.itemSize; component++) {
          values[vertex * attribute.itemSize + component] = attribute.array[sourceIndex * attribute.itemSize + component];
        }
      });
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize, attribute.normalized));
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const piece = mesh.clone(false);
    piece.name = `${mesh.name}-${region}`; piece.geometry = geometry;
    owner.add(piece); pieces[region] = piece;
  }
  owner.remove(mesh);
  return { pieces, sourceGeometry, triangles };
}
