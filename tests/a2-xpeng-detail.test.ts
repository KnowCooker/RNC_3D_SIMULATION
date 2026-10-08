import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createXPengModel} from '../src/team-a/viewer/xpeng-model';
import {xpengCatalog} from '../src/team-a/viewer/xpeng-catalog';

for(const spec of xpengCatalog.filter(s=>s.id!=='p7plus')){
  test(`${spec.id}: P7-level structural coverage and correctly separated battery layers`,()=>{
    const model=createXPengModel(spec.id),box=(id:string)=>new THREE.Box3().setFromObject(model.group.getObjectByName(id)!);
    for(const id of ['hood','roof','tailgate','spoiler','bumper-front','bumper-rear','battery','battery-cooling','battery-modules','battery-cover','thermal-front','hv-system','body-cage','rear-floor'])assert.ok(model.parts.some(p=>p.id===id),`${spec.id} missing ${id}`);
    assert.ok(model.parts.length>=38);
    const cold=box('battery-cooling'),modules=box('battery-modules'),lid=box('battery-cover'),floor=box('cabin-floor');
    assert.ok(cold.max.y<modules.min.y,'coolant layer below battery cells');
    assert.ok(modules.max.y<lid.min.y,'cells below sealed lid');
    assert.ok(lid.max.y<=floor.min.y+.005,'pack remains under passenger floor');
    assert.ok(box('tailgate').max.y>spec.height*.84,'rear glass moves with hatch');
    assert.ok(box('bumper-rear').max.y<.66,'rear bumper excludes hatch glass');
    const roof=box('roof');model.setPartProgress('tailgate',1);assert.ok(box('roof').equals(roof));
    model.dispose();
  });
  test(`${spec.id}: interior ray picking and sampled disassembly restore world transforms`,()=>{
    const model=createXPengModel(spec.id);model.group.updateMatrixWorld(true);
    const seat=model.group.getObjectByName('seat-1-1')!,centre=seat.getObjectByName('contoured-seat-cushion')!.getWorldPosition(new THREE.Vector3());
    // Aim at the actual cushion; an assembly-box offset can fall on the roof crossmember after seat adjustment.
    const ray=new THREE.Raycaster(new THREE.Vector3(centre.x,3,centre.z+.05),new THREE.Vector3(0,-1,0));
    model.inspection.setBody('hidden');const picked=model.inspection.pick(ray);assert.ok(picked);assert.equal(model.partForObject(picked.object),'seat-1-1');
    model.inspection.setSection('x',centre.x+.1);assert.equal(model.inspection.pick(ray),undefined);
    model.inspection.setSection('none',0);model.inspection.setBody('solid');
    const before=new Map(model.group.children.map(o=>[o.name,o.matrixWorld.clone()]));
    for(const t of [.25,.5,.75,1,.75,.25,0]){
      for(const p of model.parts)model.setPartProgress(p.id,t);model.inspection.update();
      assert.ok(new THREE.Box3().setFromObject(model.group).min.y>=-.001);
      if(t===0)for(const o of model.group.children)assert.ok(o.matrixWorld.equals(before.get(o.name)!));
    }
    model.dispose();
  });
}
test('Verified drivetrain and suspension differences survive shared construction helpers',()=>{
  const expected={x9:['双叉臂','H臂多连杆'],l03:['麦弗逊','五连杆'],m03:['麦弗逊','扭力梁'],gx:['双叉臂','H臂多连杆']};
  for(const id of ['x9','l03','m03','gx'] as const){const model=createXPengModel(id);
    assert.deepEqual([model.group.getObjectByName('suspension-1')!.userData.topology,model.group.getObjectByName('suspension--1')!.userData.topology],expected[id]);
    assert.equal(!!model.group.getObjectByName('fuel-system'),id==='x9'||id==='gx');
    if(id==='l03')assert.ok(model.group.getObjectByName('motor--1'));
    if(id==='m03'){assert.ok(model.group.getObjectByName('motor-1'));assert.ok(!model.group.getObjectByName('motor--1'));}
    model.dispose();
  }
});
