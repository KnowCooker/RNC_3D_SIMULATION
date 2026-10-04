import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { upholsterySurface } from '../src/team-a/viewer/upholstery-surface';
import { createXPengModel } from '../src/team-a/viewer/xpeng-model';

test('contoured upholstery remains finite, smoothly shaded and inside the assembled seat envelope', () => {
  for (const kind of ['cushion','back','headrest'] as const) {
    const geometry = upholsterySurface(.47,.53,.145,kind), bounds=geometry.boundingBox!;
    assert.ok(bounds.min.x>=-.235001 && bounds.max.x<=.235001);
    assert.ok(bounds.min.z>=-.072501 && bounds.max.z<=.100);
    assert.ok([...geometry.getAttribute('position').array].every(Number.isFinite));
    const normal=geometry.getAttribute('normal');
    for(let i=0;i<normal.count;i++) assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-5);
    // Duplicated triangle vertices must retain smooth normals after deformation.
    const position=geometry.getAttribute('position'), seen=new Map<string,THREE.Vector3>();
    for(let i=0;i<position.count;i++){
      const key=[position.getX(i),position.getY(i),position.getZ(i)].map(n=>n.toFixed(5)).join(',');
      const n=new THREE.Vector3().fromBufferAttribute(normal,i), previous=seen.get(key);
      if(previous) assert.ok(previous.dot(n)>.995);
      seen.set(key,n);
    }
    geometry.dispose();
  }
});

test('GX seat detail retains part ownership, reversibility and shared micrograin lifetime', () => {
  const model=createXPengModel('gx'), seat=model.group.getObjectByName('seat-1-1')!;
  const back=seat.getObjectByName('contoured-seat-back') as THREE.Mesh;
  assert.equal(model.partForObject(back),'seat-1-1');
  const material=back.material as THREE.MeshPhysicalMaterial, grain=material.bumpMap!;
  assert.ok(grain && material.sheen>0);
  let disposed=0;grain.addEventListener('dispose',()=>disposed++);
  model.group.updateMatrixWorld(true);const before=back.getWorldPosition(new THREE.Vector3()).clone();
  model.setPartProgress('seat-1-1',.8);model.group.updateMatrixWorld(true);
  assert.ok(back.getWorldPosition(new THREE.Vector3()).distanceTo(before)>.5);
  model.setPartProgress('seat-1-1',0);model.group.updateMatrixWorld(true);
  assert.deepEqual(back.getWorldPosition(new THREE.Vector3()).toArray(),before.toArray());
  model.inspection.setBody('transparent');assert.equal(material.opacity,1);
  model.dispose();model.dispose();assert.equal(disposed,1);
});
