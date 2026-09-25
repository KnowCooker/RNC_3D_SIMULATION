// Run from repository root: node docs/evidence/A2/A2-FULL-016/audit-spatial-fit.mjs
// Uses glTF accessor bounds: a conservative spatial audit, not a mesh/seat inspection.
import { readFileSync } from 'node:fs';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';

const files = [
  ['Range Rover Sport SVR', 'src/team-a/viewer/assets/range-rover-sport-svr.glb'],
  ['Tesla Model Y', 'src/team-a/viewer/assets/tesla-model-y.meshopt.glb'],
];
const rounded = value => Math.round(value * 1000) / 1000;
const pack = box => ({ min: box.min.toArray().map(rounded), max: box.max.toArray().map(rounded) });

function inspect(path) {
  const data = readFileSync(path);
  if (data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`Invalid GLB: ${path}`);
  const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8'));
  const all = new Box3().makeEmpty(), groups = new Map();
  const local = node => node.matrix
    ? new Matrix4().fromArray(node.matrix)
    : new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(node.scale ?? [1, 1, 1]));
  function visit(index, parent, semantic = '') {
    const node = json.nodes[index];
    const world = parent.clone().multiply(local(node));
    const match = /^r:([^_]+)_/.exec(node.name ?? '');
    const label = match?.[1] ?? semantic;
    if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives) {
      const accessor = json.accessors[primitive.attributes.POSITION];
      if (!accessor.min || !accessor.max) throw new Error(`${path}: position accessor has no bounds`);
      const box = new Box3(new Vector3().fromArray(accessor.min), new Vector3().fromArray(accessor.max)).applyMatrix4(world);
      all.union(box);
      const material = json.materials[primitive.material]?.name ?? 'unnamed';
      const group = label || material;
      const prior = groups.get(group) ?? new Box3().makeEmpty();
      groups.set(group, prior.union(box));
    }
    for (const child of node.children ?? []) visit(child, world, label);
  }
  for (const root of json.scenes[json.scene ?? 0].nodes) visit(root, new Matrix4());
  const size = all.getSize(new Vector3()), center = all.getCenter(new Vector3());
  const scale = 4.8 / Math.max(size.x, size.z);
  const normal = box => new Box3(
    new Vector3((box.min.x - center.x) * scale, (box.min.y - all.min.y) * scale, (box.min.z - center.z) * scale),
    new Vector3((box.max.x - center.x) * scale, (box.max.y - all.min.y) * scale, (box.max.z - center.z) * scale),
  );
  return {
    normalizedVehicleBounds: pack(normal(all)),
    groups: Object.fromEntries([...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, box]) => [name, pack(normal(box))])),
  };
}

for (const [name, file] of files) console.log(JSON.stringify({ name, file, ...inspect(file) }));
