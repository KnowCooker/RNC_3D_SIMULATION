import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAssetInspection } from '../src/team-a/viewer/asset-inspection';
import { createShowroomModel } from '../src/team-a/viewer/showroom-model';

function fixture() {
  const root = new THREE.Group(), part = new THREE.Group(); root.add(part);
  const material = new THREE.MeshStandardMaterial({ color: '#668899' });
  const geometry = new THREE.BoxGeometry(2, 2, 2); geometry.userData.sectionClosed = true;
  const shell = new THREE.Mesh(geometry, material), inside = new THREE.Mesh(geometry, material);
  inside.scale.setScalar(0.4); part.add(shell); root.add(inside);
  const inspection = createAssetInspection(root, [shell]);
  return { root, part, material, geometry, shell, inside, inspection,
    dispose() { inspection.dispose(); geometry.dispose(); material.dispose(); } };
}

test('asset shell modes isolate shared interior materials and restore original ownership once', () => {
  const f = fixture(), copy = f.shell.material as THREE.Material;
  let copiedDisposed = 0, originalDisposed = 0;
  copy.addEventListener('dispose', () => copiedDisposed++);
  f.material.addEventListener('dispose', () => originalDisposed++);
  f.inspection.setBody('transparent');
  assert.equal(copy.opacity, 0.18); assert.equal(copy.depthWrite, false);
  assert.equal(f.inside.material, f.material); assert.equal(f.material.opacity, 1);
  f.inspection.setBody('hidden'); assert.equal(f.shell.visible, false); assert.equal(f.inside.visible, true);
  f.inspection.select(f.part);
  assert.equal(f.inspection.overlay.getObjectByName('asset-selected-part')!.visible, false);
  f.inspection.setBody('solid'); assert.equal(f.shell.visible, true); assert.equal(copy.opacity, 1);
  f.inspection.dispose(); f.inspection.dispose();
  assert.equal(f.shell.material, f.material); assert.equal(copiedDisposed, 1); assert.equal(originalDisposed, 0);
  f.geometry.dispose(); f.material.dispose();
});

test('authored asset sections follow actual moving meshes without inventing solid caps or changing coordinates', () => {
  const f = fixture(), initial = f.shell.geometry.getAttribute('position').array.slice();
  f.inspection.setSection('x', 0);
  const caps = f.inspection.overlay.getObjectByName('vehicle-sections')!.children.filter(o => o.name === 'section-cap') as THREE.Mesh[];
  assert.ok(caps.every(cap => !cap.visible), 'even a source flagged closed is not certified by this viewer');
  const contours = f.inspection.overlay.getObjectByName('vehicle-sections')!.children.filter(o => o.name === 'section-contour') as THREE.LineSegments[];
  assert.ok(contours.some(line => line.visible));
  f.part.position.set(0.4, 0.7, -0.2); f.inspection.update();
  const contour = contours.find(line => line.userData.sourceMeshId === f.shell.id)!;
  const p = contour.geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(contour.matrix).x) < 1e-5);
  assert.deepEqual(f.shell.geometry.getAttribute('position').array, initial);
  assert.deepEqual(f.shell.position.toArray(), [0, 0, 0]);
  f.inspection.setSection('none', 0); assert.equal(f.material.clippingPlanes, null);
  f.dispose();
});

test('asset picking skips hidden ancestors and discarded section surfaces, and selection bounds follow disassembly', () => {
  const f = fixture(), ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
  assert.equal(f.inspection.pick(ray)?.object, f.shell);
  f.inspection.setBody('hidden'); assert.equal(f.inspection.pick(ray)?.object, f.inside);
  f.inspection.setBody('solid'); f.part.visible = false; assert.equal(f.inspection.pick(ray)?.object, f.inside);
  f.part.visible = true; f.inspection.setSection('z', 1.1); assert.equal(f.inspection.pick(ray), undefined);
  f.inspection.setSection('none', 0); f.inspection.select(f.part);
  const bounds = f.inspection.overlay.getObjectByName('asset-selected-part') as THREE.Box3Helper;
  assert.equal(bounds.visible, true);
  const before = bounds.box.getCenter(new THREE.Vector3());
  f.part.position.x = 3; f.inspection.update();
  assert.equal(bounds.box.getCenter(new THREE.Vector3()).x - before.x, 3);
  f.inspection.select(null); assert.equal(bounds.visible, false);
  assert.throws(() => f.inspection.setSection('x', NaN)); f.dispose();
});

/** Decode the bundled GLB's real geometry/transforms. Only image texture references
 * are omitted because Node has no image decoder; this is not a rendered texture QA. */
async function realIceGeometry() {
  const file = await readFile(new URL('../src/team-a/viewer/assets/range-rover-sport-svr.glb', import.meta.url));
  const jsonLength = file.readUInt32LE(12), json = JSON.parse(file.toString('utf8', 20, 20 + jsonLength));
  const stripTextures = (object: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(object)) {
      if (key.endsWith('Texture')) delete object[key];
      else if (value && typeof value === 'object') stripTextures(value as Record<string, unknown>);
    }
  };
  json.materials.forEach(stripTextures); delete json.images; delete json.textures;
  const text = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded);
  const tail = file.subarray(20 + jsonLength), out = Buffer.alloc(20 + padded.length + tail.length);
  file.copy(out, 0, 0, 12); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(padded.length, 12);
  out.write('JSON', 16); padded.copy(out, 20); tail.copy(out, 20 + padded.length);
  const gltf = await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength), '');
  return createShowroomModel('ice', gltf.scene);
}

test('actual ICE asset keeps all 74127 triangles and 30 groups through inspection, disassembly and full restoration', async () => {
  const model = await realIceGeometry();
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  model.group.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  let disposedGeometries = 0, disposedMaterials = 0;
  geometries.forEach(g => g.addEventListener('dispose', () => disposedGeometries++));
  materials.forEach(m => m.addEventListener('dispose', () => disposedMaterials++));
  const triangles = () => { let total = 0; model.group.traverse(o => { if (o instanceof THREE.Mesh) total += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3; }); return total; };
  assert.equal(model.parts.length, 30); assert.equal(triangles(), 74127);
  model.group.updateMatrixWorld(true);
  const initial = new Map<THREE.Mesh, number[]>();
  model.group.traverse(o => { if (o instanceof THREE.Mesh) initial.set(o, o.matrixWorld.toArray()); });
  for (const part of model.parts) {
    const pivot = model.group.getObjectByName(`assembly-${part.id}`)!;
    assert.ok(pivot.children.length > 0);
    assert.equal(model.partForObject(pivot.children[0]), part.id);
    model.setPartProgress(part.id, 1);
  }
  model.selectPart('seat-front-left'); model.inspection.setBody('hidden'); model.inspection.update();
  const seat = model.group.getObjectByName('assembly-seat-front-left')!, hood = model.group.getObjectByName('assembly-hood')!;
  assert.ok(seat.children.every(o => o.visible)); assert.ok(hood.children.every(o => !o.visible));
  model.inspection.setSection('z', 0); model.inspection.setSection('none', 0);
  model.inspection.setBody('solid'); model.parts.forEach(part => model.setPartProgress(part.id, 0));
  model.group.updateMatrixWorld(true);
  for (const [mesh, before] of initial) mesh.matrixWorld.toArray().forEach((v, i) => assert.ok(Math.abs(v - before[i]) < 1e-10));
  assert.equal(triangles(), 74127);
  model.setPaint('#ff0000');
  model.group.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.name === 'carPaint') assert.equal(o.material.color.getHexString(), 'ff0000'); });
  model.dispose(); model.dispose();
  assert.equal(disposedGeometries, geometries.size); assert.equal(disposedMaterials, materials.size);
});
