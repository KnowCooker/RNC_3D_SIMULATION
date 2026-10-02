import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { xpengCatalog } from '../src/team-a/viewer/xpeng-catalog';
import { createXPengModel } from '../src/team-a/viewer/xpeng-model';

for (const spec of xpengCatalog) {
  test(`A2 XPeng ${spec.id}: real proportions, semantic rows and finite geometry`, () => {
    const model = createXPengModel(spec.id);
    assert.equal(model.assetId, `xpeng-${spec.id}`);
    assert.equal(new Set(model.parts.map(p => p.id)).size, model.parts.length);
    assert.equal(model.parts.filter(p => p.id.startsWith('seat-')).length, spec.rows.reduce((a: number, b) => a + b, 0));
    assert.equal(model.parts.filter(p => p.id.startsWith('motor-')).length, spec.drive === 'awd' ? 2 : 1);
    assert.equal(model.parts.some(p => p.id === 'generator'), spec.generator);
    const wheels = model.group.children.filter(o => o.name.startsWith('wheel-'));
    assert.equal(wheels.length, 4);
    assert.equal(Math.max(...wheels.map(o => o.userData.axleZ)) - Math.min(...wheels.map(o => o.userData.axleZ)), spec.wheelbase);
    const bounds = new THREE.Box3().setFromObject(model.group), size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.z - spec.length) < .10, `length ${size.z}`);
    assert.ok(Math.abs(size.y - spec.height) < .08, `height ${size.y}`);
    assert.ok(bounds.min.y >= -.001, `below floor ${bounds.min.y}`);
    model.group.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      assert.ok(model.partForObject(o), 'Every mesh owns a semantic part');
      const positions = o.geometry.getAttribute('position');
      assert.ok(positions.count > 0); assert.ok([...positions.array].every(Number.isFinite));
    });
    model.dispose(); model.dispose();
  });
  test(`A2 XPeng ${spec.id}: explosion is reversible, clamped and above floor`, () => {
    const model = createXPengModel(spec.id);
    const assembled = new Map(model.group.children.map(o => [o.name, o.position.clone()]));
    for (let round = 0; round < 20; round++) {
      for (const part of model.parts) model.setPartProgress(part.id, 1);
      assert.ok(new THREE.Box3().setFromObject(model.group).min.y >= -.001);
      for (const part of model.parts) { model.setPartProgress(part.id, 0); assert.ok(model.group.getObjectByName(part.id)!.position.equals(assembled.get(part.id)!)); }
    }
    const key = model.parts[0].id;
    model.setPartProgress(key, 1); const full = model.group.getObjectByName(key)!.position.clone();
    model.setPartProgress(key, 2); assert.ok(model.group.getObjectByName(key)!.position.equals(full));
    model.setPartProgress(key, -1); assert.ok(model.group.getObjectByName(key)!.position.equals(assembled.get(key)!));
    assert.throws(() => model.setPartProgress(key, NaN));
    model.inspection.setSection('x', 0); model.inspection.setBody('hidden'); model.inspection.update();
    assert.ok(model.group.children.some(o => o.children.some(c => c instanceof THREE.Mesh && !c.visible)));
    model.inspection.setBody('solid'); model.inspection.setSection('none', 0);
    model.dispose();
  });
}

test('A2 XPeng paint affects exterior clones only; resources dispose exactly once', () => {
  const model = createXPengModel('gx');
  const seat = model.group.getObjectByName('seat-1-1')!.children[0] as THREE.Mesh;
  const before = (seat.material as THREE.MeshStandardMaterial).color.getHex();
  const hood = model.group.getObjectByName('hood')!.children[0] as THREE.Mesh;
  model.setPaint('#cc2211');
  assert.equal((hood.material as THREE.MeshStandardMaterial).color.getHex(), 0xcc2211);
  assert.equal((seat.material as THREE.MeshStandardMaterial).color.getHex(), before);
  const geometry = hood.geometry; let disposals = 0; geometry.addEventListener('dispose', () => disposals++);
  model.dispose(); model.dispose(); assert.equal(disposals, 1);
});
