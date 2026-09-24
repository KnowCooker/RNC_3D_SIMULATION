// Run from the repository root: node docs/evidence/A2/A2-FULL-016/audit-part-hierarchy.mjs
// GLB JSON only: node names are a candidate inventory, not proof of movable parts.
import { readFileSync } from 'node:fs';

const assets = [
  ['ICE Range Rover Sport SVR', 'src/team-a/viewer/assets/range-rover-sport-svr.glb'],
  ['BEV Tesla Model Y', 'src/team-a/viewer/assets/tesla-model-y.meshopt.glb'],
];

function readJson(path) {
  const data = readFileSync(path);
  if (data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error(`${path} is not a JSON-first GLB`);
  }
  const length = data.readUInt32LE(12);
  return JSON.parse(data.subarray(20, 20 + length).toString('utf8'));
}

for (const [label, path] of assets) {
  const glb = readJson(path);
  const meshNodes = glb.nodes.filter(node => node.mesh !== undefined);
  const labels = new Set(glb.nodes.flatMap(node => {
    const match = /^r:([^_]+)_/.exec(node.name ?? '');
    return match ? [match[1]] : [];
  }));
  const genericMeshNodes = meshNodes.filter(node => /^Object_\d+$/.test(node.name ?? '')).length;
  const candidateParts = [...labels].sort();
  console.log(JSON.stringify({
    label,
    path,
    meshes: glb.meshes.length,
    nodes: glb.nodes.length,
    meshNodes: meshNodes.length,
    genericMeshNodes,
    semanticPrefixCount: candidateParts.length,
    semanticPrefixes: candidateParts,
    caveat: 'Names alone do not verify pivot, separability, wheel/seat geometry, internal structure or assembly order.',
  }));
}
