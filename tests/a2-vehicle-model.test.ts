import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createVehicleModel, type VehicleKind } from '../src/team-a/viewer/vehicle-model';
import { MIC_POSITIONS, SPEAKER_POSITIONS } from '../src/shared/lab-contracts';

test('four drivetrains preserve their physical differences and five-seat cabin', () => {
  for (const kind of ['ice', 'bev', 'hev', 'erev'] as VehicleKind[]) {
    const model = createVehicleModel(kind);
    const ids = new Set(model.parts.map(p => p.object.name));
    assert.equal(model.parts.filter(p => p.object.name.startsWith('seat-')).length, 5);
    assert.equal(ids.has('combustion-engine'), kind !== 'bev');
    assert.equal(ids.has('fuel-tank'), kind !== 'bev');
    assert.equal(ids.has('exhaust'), kind !== 'bev');
    assert.equal(ids.has('traction-battery'), kind !== 'ice');
    assert.equal(ids.has('transmission'), kind === 'ice');
    assert.equal(ids.has('power-split'), kind === 'hev');
    assert.equal(ids.has('range-generator'), kind === 'erev');
    assert.equal(ids.has('traction-motor-front'), kind === 'hev');
    assert.equal(ids.has('traction-motor-rear'), kind === 'bev' || kind === 'erev');
    assert.equal(ids.has('charge-system'), kind === 'bev' || kind === 'erev');
    assert.ok(ids.has('cockpit')); assert.ok(ids.has('chassis'));
    assert.equal(model.wheels.length, 4);
    assert.deepEqual(model.wheels.map(w => w.position.toArray()), [[1, 0.42, 1.45], [-1, 0.42, 1.45], [1, 0.42, -1.45], [-1, 0.42, -1.45]]);
    model.group.updateMatrixWorld(true);
    ['fl', 'fr', 'rl', 'rr'].forEach((corner, index) => {
      const speaker = model.group.getObjectByName(`speaker-${corner}`);
      assert.ok(speaker, `${kind} ${corner} speaker exists`);
      assert.deepEqual(speaker.getWorldPosition(new THREE.Vector3()).toArray(), SPEAKER_POSITIONS[index]);
    });
    [1, 2, 3, 5].forEach((seatIndex, index) => {
      const headrest = model.group.getObjectByName(`headrest-${seatIndex}`);
      assert.ok(headrest, `${kind} seat ${seatIndex} has a headrest`);
      assert.equal(headrest.parent?.name, `seat-${seatIndex}`);
      const mic = new THREE.Vector3(...MIC_POSITIONS[index]), bounds = new THREE.Box3().setFromObject(headrest);
      assert.ok(mic.distanceTo(bounds.clampPoint(mic, new THREE.Vector3())) < 0.1,
        `${kind} MIC ${index + 1} remains at its designated headrest`);
    });
    for (const p of model.parts) {
      assert.equal(p.object.parent, model.group, 'exploded parts do not inherit another part offset');
      assert.deepEqual(p.origin.toArray(), p.object.position.toArray());
      if (p.category === 'cabin') assert.deepEqual(p.offset.toArray(), [0, 0.45, 0]);
    }
    if (kind === 'erev') assert.match(model.group.getObjectByName('range-generator')!.userData.description, /无发动机到车轮的机械通路/);
    model.dispose();
  }
});

test('vehicle geometry is finite and every owned GPU resource is disposed once', () => {
  for (const kind of ['ice', 'bev', 'hev', 'erev'] as VehicleKind[]) {
    const model = createVehicleModel(kind), geometrySet = new Set<THREE.BufferGeometry>(), materialSet = new Set<THREE.Material>(), textureSet = new Set<THREE.Texture>();
    let triangles = 0;
    model.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometrySet.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => {
        materialSet.add(m);
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textureSet.add(value);
      });
      const position = object.geometry.getAttribute('position');
      assert.ok([...position.array].every(Number.isFinite));
      triangles += (object.geometry.index?.count ?? position.count) / 3;
    });
    assert.ok(triangles > 10000, 'model has substantially more structure than the old block proxy');
    assert.ok(triangles < 50000, `bounded geometry: ${kind} ${triangles}`);
    assert.ok([...materialSet].every(m => model.materials.includes(m)), 'every rendered material is owned and exposed for clipping');
    const bounds = new THREE.Box3().setFromObject(model.group), extent = bounds.getSize(new THREE.Vector3());
    assert.ok(extent.z >= 4.7 && extent.z <= 4.95);
    assert.ok(extent.x >= 2 && extent.x <= 2.6);
    assert.ok(extent.y >= 1.8 && extent.y <= 2.1);
    assert.ok(model.shell.length > 15);
    let geometryDisposed = 0, materialDisposed = 0, textureDisposed = 0;
    geometrySet.forEach(g => g.addEventListener('dispose', () => geometryDisposed++));
    model.materials.forEach(m => m.addEventListener('dispose', () => materialDisposed++));
    textureSet.forEach(t => t.addEventListener('dispose', () => textureDisposed++));
    model.dispose(); model.dispose();
    assert.equal(geometryDisposed, geometrySet.size); assert.equal(materialDisposed, model.materials.length);
    assert.ok(textureSet.size > 0); assert.equal(textureDisposed, textureSet.size);
    assert.equal(model.group.children.length, 0);
  }
});

test('the BEV and EREV battery enclosure remains directly visible from the underbody', () => {
  for (const kind of ['ice', 'bev', 'erev'] as VehicleKind[]) {
    const model = createVehicleModel(kind);
    model.group.updateMatrixWorld(true);
    const hit = new THREE.Raycaster(new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 1, 0))
      .intersectObject(model.group, true)[0];
    assert.ok(hit, `${kind} has an underbody surface`);
    let part: THREE.Object3D | null = hit.object;
    while (part && part.parent !== model.group) part = part.parent;
    assert.equal(part?.name === 'traction-battery', kind !== 'ice', `${kind} first visible underbody part`);
    model.dispose();
  }
});
