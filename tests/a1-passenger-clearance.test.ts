import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clearanceViolations, fitPassengerGeometry, solveSeatedPlacement } from '../src/team-a/viewer/passenger-clearance';
import { createXPengModel } from '../src/team-a/viewer/xpeng-model';
import { xpengCatalog } from '../src/team-a/viewer/xpeng-catalog';
import { createPassengerCabin, passengerMounts } from '../src/team-a/viewer/passenger-cabin';
import { PASSENGERS, isPassenger } from '../src/team-a/viewer/passenger-model';

test('A1 clearance: cabin floor, cushion and backrest constrain every current basic character and seat',()=>{
  assert.equal(isPassenger('ayaka'),false);assert.equal(isPassenger('robin'),true);
  for(const spec of xpengCatalog){
    const car=createXPengModel(spec.id),cabin=createPassengerCabin();cabin.attach(car);const mounts=passengerMounts(car);
    for(const {id} of PASSENGERS){
      cabin.setAssignments(Object.fromEntries(mounts.map(m=>[m.id,id])));
      for(const m of mounts){
        const group=m.parent.children.find(o=>o.userData.passengerId)!;
        assert.equal(group.userData.clearance.collisions,0,`${spec.id}/${m.id}/${id}`);
        const box=new THREE.Box3().setFromObject(group);
        assert.ok(box.min.y>=m.floor+.005,`${spec.id}/${m.id}/${id} actual floor`);
        assert.ok(box.max.y<=m.roof-.034,`${spec.id}/${m.id}/${id} roof`);
      }
    }
    cabin.dispose();car.dispose();
  }
});

test('A1 clearance: a steering ring has a free center, with solid rim contact detected',()=>{
  const seat={origin:new THREE.Vector3(),roof:3,maxWidth:1,floor:-2,obstacles:[{min:new THREE.Vector3(-.172,-.172,-.017),max:new THREE.Vector3(.172,.172,.017),part:'cockpit',name:'wheel',torus:{radius:.155,tube:.017,inverse:new THREE.Matrix4(),scale:1}}]};
  const fit={position:new THREE.Vector3(),scale:1,legScale:1,collisions:0,maxPenetration:0};
  assert.equal(clearanceViolations([new THREE.Vector3()],fit,seat).count,0);
  assert.equal(clearanceViolations([new THREE.Vector3(.155,0,0)],fit,seat).count,1);
});

test('A1 clearance: unsampled surface points veto a seemingly clear placement',()=>{
  const seat={origin:new THREE.Vector3(0,.70,0),floor:.44,roof:1.7,maxWidth:.6,obstacles:[{min:new THREE.Vector3(-.1,.9,-.025),max:new THREE.Vector3(.1,1.01,.025),part:'cockpit',name:'thin obstruction'}]};
  const points=[new THREE.Vector3(-.12,-.1,.1),new THREE.Vector3(.12,.65,.05),new THREE.Vector3(0,-.45,.38)];
  const omitted=new THREE.Vector3(0,.1,0),all=[...points,omitted];
  const fit=solveSeatedPlacement(points,new THREE.Box3().setFromPoints(all),seat,.12,all);
  assert.equal(clearanceViolations(all,fit,seat).count,0);
});

test('A1 clearance: fitting duplicate geometry leaves the template intact and disposes owned copies once',()=>{
  const geometry=new THREE.BoxGeometry(.12,.7,.12), material=new THREE.MeshStandardMaterial(), original=Array.from(geometry.getAttribute('position').array);
  const group=new THREE.Group();group.add(new THREE.Mesh(geometry,material));
  const fit=fitPassengerGeometry(group,{origin:new THREE.Vector3(0,.7,0),floor:.5,roof:1.5,maxWidth:.6,obstacles:[]},.03);
  assert.deepEqual(Array.from(geometry.getAttribute('position').array),original);
  let count=0;const privateGeometry=(group.children[0] as THREE.Mesh).geometry;privateGeometry.addEventListener('dispose',()=>count++);
  fit.disposeGeometry();fit.disposeGeometry();assert.equal(count,privateGeometry===geometry?0:1);
  geometry.dispose();material.dispose();
});

test('A1 clearance: shallow contact is corrected; deep solid penetration is never silently erased',()=>{
  const obstacle={min:new THREE.Vector3(-.1,-.1,-.1),max:new THREE.Vector3(.1,.1,.1),name:'solid',part:'seat'};
  const seat={origin:new THREE.Vector3(),roof:3,maxWidth:1,floor:-2,obstacles:[obstacle]};
  const fit={position:new THREE.Vector3(),scale:1,legScale:1,collisions:0,maxPenetration:0,contacts:[obstacle]};
  assert.equal(clearanceViolations([new THREE.Vector3(.095,0,0)],fit,seat).count,0);
  assert.equal(clearanceViolations([new THREE.Vector3()],fit,seat).count,1);
  const overlapping=[
    {...obstacle,min:new THREE.Vector3(-1,-1,-1),max:new THREE.Vector3(.02,1,1)},
    {...obstacle,min:new THREE.Vector3(-.01,-1,-1),max:new THREE.Vector3(.15,.02,1)},
  ];
  // Two individually small pushes would total > 35 mm; keep the collision visible instead.
  assert.equal(clearanceViolations([new THREE.Vector3()],{...fit,contacts:overlapping},{...seat,obstacles:overlapping}).count,1);
});

test('A1 clearance: a small localized contact preserves adult scale before shrinking the whole character',()=>{
  const points=[new THREE.Vector3(.095,.3,.2),new THREE.Vector3(.2,-.2,.3),new THREE.Vector3(-.2,.6,.4)];
  const seat={origin:new THREE.Vector3(0,.7,0),roof:2,maxWidth:1,floor:0,obstacles:[{min:new THREE.Vector3(-.1,.7,-1),max:new THREE.Vector3(.1,2,1),name:'armrest',part:'seat'}]};
  const fit=solveSeatedPlacement(points,new THREE.Box3().setFromPoints(points),seat,.1);
  assert.equal(fit.scale,1);
  assert.ok(fit.contacts);
  assert.equal(clearanceViolations(points,fit,seat).count,0);
});
