import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createXPengModel } from '../src/team-a/viewer/xpeng-model';

test('P7+ canopy, liftback glazing and rear bumper are separately owned assemblies', () => {
  const model = createXPengModel('p7plus');
  assert.equal(model.group.userData.revision, 'p7plus-photo-v3');
  const hatch = new THREE.Box3().setFromObject(model.group.getObjectByName('tailgate')!);
  const bumper = new THREE.Box3().setFromObject(model.group.getObjectByName('bumper-rear')!);
  assert.ok(hatch.max.y > 1.4, 'Rear windscreen belongs to the liftback');
  assert.ok(bumper.max.y < .65, 'Bumper excludes rear windscreen and taillights');
  const bumperBefore = model.group.getObjectByName('bumper-rear')!.position.clone();
  model.setPartProgress('tailgate', 1);
  assert.ok(model.group.getObjectByName('bumper-rear')!.position.equals(bumperBefore));
  assert.ok(model.parts.some(p => p.id === 'spoiler'));
  model.dispose();
});

test('P7+ hidden shell exposes actual seat picking, and clipping rejects the removed half', () => {
  const model = createXPengModel('p7plus');
  const ray = new THREE.Raycaster(new THREE.Vector3(.465, 2.5, .48), new THREE.Vector3(0, -1, 0));
  const closed = model.inspection.pick(ray); assert.ok(closed); assert.equal(model.partForObject(closed.object), 'roof');
  model.inspection.setBody('hidden');
  const open = model.inspection.pick(ray); assert.ok(open); assert.equal(model.partForObject(open.object), 'seat-1-1');
  model.inspection.setSection('x', .6); assert.equal(model.inspection.pick(ray), undefined);
  model.inspection.setSection('none', 0); model.inspection.setBody('solid');
  assert.equal(model.partForObject(model.inspection.pick(ray)!.object), 'roof');
  model.dispose();
});

test('P7+ intermediate explosion poses remain finite and return to identical world transforms', () => {
  const model = createXPengModel('p7plus'); model.group.updateMatrixWorld(true);
  const base = new Map(model.group.children.map(o => [o.name, o.matrixWorld.clone()]));
  for (let round = 0; round < 10; round++) for (const t of [.25, .5, 1, .5, 0]) {
    for (const p of model.parts) model.setPartProgress(p.id, t);
    model.inspection.update();
    assert.ok(new THREE.Box3().setFromObject(model.group).min.y >= -1e-5);
    if (t === 0) for (const o of model.group.children) assert.ok(o.matrixWorld.equals(base.get(o.name)!));
  }
  model.dispose();
});

test('P7+ paint and shell presentation preserve independent glass, tires and cabin materials', () => {
  const model = createXPengModel('p7plus'), protectedMaterials = new Map<THREE.MeshPhysicalMaterial, string>();
  model.group.traverse(o => { if (o instanceof THREE.Mesh) { const m = o.material as THREE.MeshPhysicalMaterial; if (m.clearcoat !== 1) protectedMaterials.set(m, m.color.getHexString()); } });
  model.inspection.setBody('transparent'); model.setPaint('#164f68'); model.inspection.setBody('solid');
  for (const [m, color] of protectedMaterials) assert.equal(m.color.getHexString(), color);
  model.dispose();
});

test('P7 detailed EV assemblies and acoustic diaphragms own their reversible geometry',()=>{
 const model=createXPengModel('p7plus');
 for(const id of ['battery','battery-cover','battery-modules','battery-cooling','hv-system','thermal-front','suspension-1','suspension--1'])assert.ok(model.group.getObjectByName(id));
 const positions:number[][]=[];model.group.traverse(o=>{if(o.name==='acoustic-speaker')positions.push(o.position.toArray());});
 assert.deepEqual(positions.sort((a,b)=>a[0]-b[0]||a[2]-b[2]),[[-.85,.72,-.65],[-.84,.72,.58],[.84,.72,.58],[.85,.72,-.65]]);
 model.dispose();
});
