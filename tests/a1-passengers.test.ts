import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPassengerModel, PASSENGERS } from '../src/team-a/viewer/passenger-model';
import { createPassengerCabin, passengerMounts } from '../src/team-a/viewer/passenger-cabin';
import { createPassengerState } from '../src/team-a/lab/passenger-state';
import { createXPengModel } from '../src/team-a/viewer/xpeng-model';
import { xpengCatalog } from '../src/team-a/viewer/xpeng-catalog';
import { defaultXPengConfig, labLayout } from '../src/shared/lab-contracts';

test('A1 passengers: real finite geometry, bounded draw count, unique silhouette and single lap hat', () => {
  for (const { id } of PASSENGERS) {
    const model = createPassengerModel(id); let meshes = 0, triangles = 0;
    model.group.traverse(o => { if (o instanceof THREE.Mesh) {
      meshes++; triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
      for (const name of ['position', 'normal', 'uv']) {
        const attribute = o.geometry.getAttribute(name); assert.ok(attribute, `${id} ${name}`);
        assert.ok([...attribute.array].every(Number.isFinite), `${id} ${name} finite`);
      }
    } });
    assert.ok(meshes < 65, `${id}: ${meshes} draws`); assert.ok(triangles < 120000, `${id}: ${triangles} tris`);
    const box = new THREE.Box3().setFromObject(model.group); assert.ok(box.min.y > -.26 && box.max.y < .80);
    assert.ok(box.max.x - box.min.x < .5 && box.max.z - box.min.z < .63);
    assert.equal(!!model.group.getObjectByName('lap-straw-hat'), id === 'luffy');
    model.dispose();
  }
});

test('A1 passengers: all five models use actual cushion anchors including driver', () => {
  for (const spec of xpengCatalog) {
    const model = createXPengModel(spec.id), mounts = passengerMounts(model);
    assert.equal(mounts.length, spec.rows.reduce((a, b) => a + b, 0));
    assert.ok(mounts.every(m => m.parent.userData.partId === m.id));
    assert.deepEqual(mounts.filter(m => m.driver).map(m => [m.id, m.label]), [['seat-1-1', '主驾']]);
    for (const m of mounts) { assert.ok(m.origin.y > .61 && m.origin.y < .75); assert.ok(m.roof > 1.3); }
    assert.equal(mounts.filter(m => m.row === 3).length, spec.rows[2] ?? 0);
    model.dispose();
  }
});

test('A1 passengers: independent seats allow duplicates; per-vehicle preferences cannot create stale seats', () => {
  const state = createPassengerState();
  const seats = [{ id: 'seat-1-2', label: '副驾', row: 1, column: 2 }, { id: 'seat-2-1', label: '二排左座', row: 2, column: 1 }];
  state.bind('gx', seats); assert.ok(state.choose(seats[0].id, 'niulai')); state.choose(seats[1].id, 'niulai');
  assert.equal(Object.values(state.assignments).filter(v => v === 'niulai').length, 2);
  assert.equal(state.choose('seat-1-1', 'luffy'), false); assert.equal(state.choose(seats[0].id, 'unknown' as never), false);
  state.bind('m03', seats); assert.deepEqual(Object.values(state.assignments), [null, null]);
  state.choose(seats[0].id, 'ayaka'); state.bind('gx', seats); assert.deepEqual(Object.values(state.assignments), ['niulai', 'niulai']);
  const snapshot = state.assignments as Record<string, unknown>; snapshot[seats[0].id] = 'luffy'; assert.equal(state.assignments[seats[0].id], 'niulai');
  state.bind('gx', seats.slice(0, 1)); assert.equal(Object.keys(state.assignments).length, 1);
  state.clear(); assert.equal(state.assignments[seats[0].id], null);
});

test('A1 passengers: swap, empty, detach and clip preserve the car and acoustic layout', () => {
  const model = createXPengModel('gx'), cabin = createPassengerCabin(), config = defaultXPengConfig('xpeng-gx');
  const physics = JSON.stringify({ config, layout: labLayout(config) }); cabin.attach(model);
  const seats = cabin.seats; cabin.setAssignments({ [seats[0].id]: 'niulai', [seats[1].id]: 'ayaka' });
  const occupant = model.group.getObjectByName('passenger-niulai')!; const parent = occupant.parent!;
  const start = occupant.getWorldPosition(new THREE.Vector3());
  model.setPartProgress(seats[0].id, 1); assert.ok(occupant.getWorldPosition(new THREE.Vector3()).distanceTo(start) > .5);
  model.setPartProgress(seats[0].id, 0); assert.ok(occupant.getWorldPosition(new THREE.Vector3()).distanceTo(start) < 1e-8);
  cabin.setSection('x', .04); occupant.traverse(o => { if (o instanceof THREE.Mesh) assert.equal((o.material as THREE.Material).clippingPlanes?.[0].constant, -.04); });
  cabin.setVisible(false); assert.equal(occupant.visible, false); cabin.setVisible(true);
  assert.throws(() => cabin.setAssignments({ invalid: 'luffy' })); assert.equal(occupant.parent, parent);
  cabin.setAssignments({ [seats[0].id]: 'luffy' }); assert.equal(occupant.parent, null); assert.ok(!model.group.getObjectByName('passenger-ayaka'));
  cabin.setAssignments({}); assert.ok(!model.group.getObjectByName('passenger-luffy'));
  assert.equal(JSON.stringify({ config, layout: labLayout(config) }), physics);
  cabin.dispose(); model.dispose();
});

test('A1 passengers: head/horns stay below each current cabin roof; geometry follows matching seats', () => {
  for (const spec of xpengCatalog) {
    const model = createXPengModel(spec.id), cabin = createPassengerCabin(); cabin.attach(model);
    const mounts = passengerMounts(model); cabin.setAssignments(Object.fromEntries(mounts.map((m, i) => [m.id, PASSENGERS[i % 3].id])));
    for (const m of mounts) {
      const occupant = m.parent.children.find(o => o.userData.passengerId)!; assert.ok(occupant);
      const box = new THREE.Box3().setFromObject(occupant); assert.ok(box.max.y < m.roof - .025, `${spec.id} ${m.id}: ${box.max.y}`);
      assert.ok(Math.abs(occupant.position.x - m.origin.x) < 1e-8); assert.ok(box.min.y > .35);
    }
    cabin.dispose(); model.dispose();
  }
});

test('A1 passengers: repeat frame is stable, reduced motion neutral, resources dispose exactly once', () => {
  const model = createPassengerModel('niulai');
  model.animate(3.69, false); const head = model.group.getObjectByName('head-rig')!, rotation = head.rotation.y;
  model.animate(3.69, false); assert.equal(head.rotation.y, rotation);
  model.animate(3.69, true); assert.equal(head.rotation.y, 0);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  model.group.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); materials.add(o.material as THREE.Material); } });
  let geometryDisposals = 0, materialDisposals = 0;
  geometries.forEach(g => g.addEventListener('dispose', () => geometryDisposals++)); materials.forEach(m => m.addEventListener('dispose', () => materialDisposals++));
  model.dispose(); model.dispose(); assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size);
});
