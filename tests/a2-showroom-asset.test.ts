import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('bundled showroom SUV is the attributed, offline CC BY asset within the geometry budget', () => {
  const file = readFileSync(new URL('../src/team-a/viewer/assets/range-rover-sport-svr.glb', import.meta.url));
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  assert.equal(file.readUInt32LE(8), file.length);
  assert.equal(file.toString('ascii', 16, 20), 'JSON');
  const jsonLength = file.readUInt32LE(12);
  const gltf = JSON.parse(file.toString('utf8', 20, 20 + jsonLength));
  assert.match(gltf.asset.extras.author, /Mona x Supercars/);
  assert.match(gltf.asset.extras.license, /^CC-BY-4\.0/);
  assert.equal(gltf.asset.extras.source, 'https://sketchfab.com/3d-models/land-rover-range-rover-sport-svr-5462d65acb0e4dca8c20da82360261db');
  assert.ok(gltf.materials.some((material: { name?: string }) => material.name === 'carPaint'));
  assert.ok(gltf.buffers.every((buffer: { uri?: string }) => !buffer.uri));
  assert.ok(gltf.images.every((image: { uri?: string }) => !image.uri));
  const triangles = gltf.meshes.reduce((total: number, mesh: { primitives: { indices: number }[] }) =>
    total + mesh.primitives.reduce((sum, primitive) => sum + gltf.accessors[primitive.indices].count / 3, 0), 0);
  assert.ok(triangles > 60_000 && triangles < 100_000, `${triangles} triangles`);
});
