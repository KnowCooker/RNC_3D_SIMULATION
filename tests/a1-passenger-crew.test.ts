import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPassengerState } from '../src/team-a/lab/passenger-state';
import { createPassengerModel, PASSENGERS, PASSENGER_PRESETS, passengerHipOffset, type PassengerId } from '../src/team-a/viewer/passenger-model';
import { createPassengerCabin } from '../src/team-a/viewer/passenger-cabin';
import { createPassengerAssetLibrary } from '../src/team-a/viewer/passenger-assets';
import { createXPengModel } from '../src/team-a/viewer/xpeng-model';

test('A1 crew: all six characters can replace the driver; presets and vehicle restoration stay independent', () => {
  const car = createXPengModel('gx'), cabin = createPassengerCabin(), state = createPassengerState();
  cabin.attach(car); state.bind('gx', cabin.seats);
  assert.equal(PASSENGERS.length, 6);
  for (const { id } of PASSENGERS) {
    assert.equal(state.choose('seat-1-1', id), true); cabin.setAssignments(state.assignments);
    const driver = car.group.getObjectByName(`passenger-${id}`)!;
    assert.equal(driver.parent?.name, 'seat-1-1'); assert.equal(driver.userData.driver, true);
    assert.equal(cabin.quality.length, 1);
  }
  state.fill(PASSENGER_PRESETS.strawhats); cabin.setAssignments(state.assignments);
  const crew = state.assignments;
  assert.deepEqual(Object.values(crew).slice(0, 5), ['luffy', 'nami', 'chopper', 'zoro', 'robin']);
  state.choose('seat-1-1', 'chopper'); state.choose('seat-1-2', 'chopper');
  state.bind('other-car', cabin.seats); state.fill();
  assert.deepEqual(Object.values(state.assignments).slice(0, 3), ['niulai', 'robin', 'luffy']);
  state.bind('gx', cabin.seats); assert.equal(state.assignments['seat-1-1'], 'chopper'); assert.equal(state.assignments['seat-1-2'], 'chopper');
  state.clear(); cabin.setAssignments(state.assignments); assert.equal(cabin.quality.length, 0);
  cabin.dispose(); car.dispose();
});

test('A1 crew: each new character has distinct driver/passenger assets and an independent supported instance', async () => {
  const keys: string[] = [];
  const library = createPassengerAssetLibrary(async key => {
    keys.push(key); const group = new THREE.Group(); group.add(new THREE.Mesh(new THREE.BoxGeometry(.4,.6,.4), new THREE.MeshStandardMaterial())); return group;
  });
  for (const id of ['chopper', 'nami', 'zoro'] as const) {
    const seated = await library.load(id, false), driver = await library.load(id, true);
    assert.notEqual(seated.group.children[0], driver.group.children[0]);
    assert.equal(driver.group.userData.driver, true); assert.equal(seated.group.userData.driver, false);
    assert.equal(driver.group.userData.seatedHipOffset, passengerHipOffset(id));
    driver.dispose(); seated.dispose();
  }
  assert.deepEqual(keys, ['chopper-seated','chopper-driver','nami-seated','nami-driver','zoro-seated','zoro-driver']); library.dispose();
});

test('A1 crew: new fallback animations and disposal remain isolated across duplicate characters', () => {
  for (const id of ['chopper', 'nami', 'zoro'] as const) {
    const one = createPassengerModel(id, true), two = createPassengerModel(id);
    one.setSection('z', .3); two.group.traverse(o => { if (o instanceof THREE.Mesh) assert.equal((o.material as THREE.Material).clippingPlanes, null); });
    one.animate(3, false); const head = one.group.getObjectByName('head-rig')!; const angle = head.rotation.y;
    one.animate(3, false); assert.equal(head.rotation.y, angle); one.animate(3, true); assert.equal(head.rotation.y, 0);
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    one.group.traverse(o => { if (o instanceof THREE.Mesh) { resources.add(o.geometry); resources.add(o.material as THREE.Material); } });
    let disposals = 0; resources.forEach(r => r.addEventListener('dispose', () => disposals++));
    one.dispose(); one.dispose(); assert.equal(disposals, resources.size);
    assert.ok(two.group.children.length > 0); two.dispose();
  }
});
