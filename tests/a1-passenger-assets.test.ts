import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPassengerAssetLibrary } from '../src/team-a/viewer/passenger-assets';
import { createPassengerCabin } from '../src/team-a/viewer/passenger-cabin';
import { createPassengerModel, type PassengerId } from '../src/team-a/viewer/passenger-model';
import { createXPengModel } from '../src/team-a/viewer/xpeng-model';

function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function source() {
  const group = new THREE.Group(), texture = new THREE.Texture();
  const geometry = new THREE.BoxGeometry(.4, 1, .35), material = new THREE.MeshStandardMaterial({ map: texture });
  group.add(new THREE.Mesh(geometry, material)); return { group, texture, geometry, material };
}

test('A1 detailed passengers: concurrent duplicate seats share download but own clip and disposable meshes', async () => {
  const asset = source(); let downloads = 0, textureDisposals = 0, sourceDisposals = 0;
  asset.texture.addEventListener('dispose', () => textureDisposals++); asset.geometry.addEventListener('dispose', () => sourceDisposals++);
  const library = createPassengerAssetLibrary(async key => { assert.equal(key, 'robin-driver'); downloads++; return asset.group; });
  const [one, two] = await Promise.all([library.load('robin', true), library.load('robin', true)]);
  const mesh = (g: THREE.Group) => g.children[0].children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  assert.equal(downloads, 1); assert.notEqual(mesh(one.group).geometry, mesh(two.group).geometry);
  assert.notEqual(mesh(one.group).material, mesh(two.group).material);
  one.setSection('x', .2); assert.equal(mesh(one.group).material.clippingPlanes?.[0].constant, -.2); assert.equal(mesh(two.group).material.clippingPlanes, null);
  one.animate(3, false); one.animate(3, true); assert.equal(one.group.children[0].position.y, 0);
  assert.equal(one.group.userData.driver, true);
  let ownDisposals = 0; mesh(one.group).geometry.addEventListener('dispose', () => ownDisposals++);
  one.dispose(); one.dispose(); assert.equal(ownDisposals, 1); assert.equal(textureDisposals, 0);
  two.dispose(); library.dispose(); library.dispose(); await flush();
  assert.equal(textureDisposals, 1); assert.equal(sourceDisposals, 1);
});

test('A1 detailed passengers: late response after library destruction releases source once; failures can retry', async () => {
  const asset = source(), pending = deferred<THREE.Group>(); let releases = 0;
  asset.geometry.addEventListener('dispose', () => releases++);
  const library = createPassengerAssetLibrary(() => pending.promise);
  const load = library.load('luffy', false); library.dispose(); pending.resolve(asset.group);
  await assert.rejects(load, /disposed/); await flush(); assert.equal(releases, 1);
  await assert.rejects(library.load('luffy', true), /disposed/);
  let attempts = 0; const retry = createPassengerAssetLibrary(async () => { if (++attempts === 1) throw new Error('missing'); return source().group; });
  await assert.rejects(retry.load('niulai', true), /missing/);
  const model = await retry.load('niulai', true); assert.equal(attempts, 2); model.dispose(); retry.dispose();
});

test('A1 detailed passengers: driver swap, clear, vehicle change and destruction cannot resurrect stale loads', async () => {
  type Model = ReturnType<typeof createPassengerModel>;
  const requests: { id: PassengerId; driver: boolean; request: ReturnType<typeof deferred<Model>> }[] = [];
  const cabin = createPassengerCabin({ loadDetailed: (id, driver) => { const request = deferred<Model>(); requests.push({ id, driver, request }); return request.promise; } });
  const gx = createXPengModel('gx'), x9 = createXPengModel('x9'); cabin.attach(gx);
  cabin.setAssignments({ 'seat-1-1': 'niulai', 'seat-1-2': 'luffy' });
  assert.deepEqual(requests.map(r => [r.id, r.driver]), [['niulai', true], ['luffy', false]]);
  cabin.setAssignments({ 'seat-1-1': 'robin' });
  let dropped = 0;
  function complete(index: number) { const m = createPassengerModel(requests[index].id, requests[index].driver); m.group.userData.assetStatus = 'detailed'; const dispose = m.dispose; m.dispose = () => { dropped++; dispose(); }; requests[index].request.resolve(m); return m; }
  complete(0); complete(1); await flush(); assert.equal(dropped, 2); assert.equal(cabin.quality.length, 1);
  cabin.setVisible(false); cabin.setSection('z', .4); const robin = complete(2); await flush();
  assert.equal(robin.group.visible, false); assert.equal(robin.group.parent?.name, 'seat-1-1');
  robin.group.traverse(o => { if (o instanceof THREE.Mesh) assert.equal((o.material as THREE.Material).clippingPlanes?.[0].constant, -.4); });
  cabin.setAssignments({ 'seat-1-1': 'luffy' }); cabin.attach(x9); complete(3); await flush(); assert.equal(cabin.quality.length, 0);
  cabin.setAssignments({ 'seat-1-1': 'niulai' }); cabin.setAssignments({}); complete(4); await flush(); assert.equal(cabin.quality.length, 0);
  cabin.setAssignments({ 'seat-1-1': 'luffy' }); cabin.dispose(); complete(5); await flush();
  assert.equal(cabin.quality.length, 0); assert.equal(dropped, 6); gx.dispose(); x9.dispose();
});

test('A1 detailed passengers: missing local asset keeps driver selectable and reports basic status', async () => {
  const car = createXPengModel('gx'); let changes = 0;
  const cabin = createPassengerCabin({ loadDetailed: async () => { throw new Error('missing file'); }, onChange: () => changes++ }); cabin.attach(car);
  cabin.setAssignments({ 'seat-1-1': 'robin' }); assert.equal(cabin.quality[0].status, 'loading'); await flush();
  assert.equal(cabin.quality[0].status, 'basic'); assert.equal(changes, 1);
  assert.equal(car.group.getObjectByName('passenger-robin')?.parent?.name, 'seat-1-1');
  cabin.setAssignments({ 'seat-1-1': 'luffy' }); await flush(); assert.ok(car.group.getObjectByName('passenger-luffy'));
  cabin.dispose(); car.dispose();
});
