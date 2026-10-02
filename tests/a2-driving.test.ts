import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cabinViews, drivingLook, roadSegment, travelDistance } from '../src/team-a/viewer/driving-state';
import { createWheelMotion } from '../src/team-a/viewer/wheel-motion';

test('driving distance uses the experiment clock, including pause and backward seek', () => {
  assert.equal(travelDistance(3.6, 100), 100);
  assert.equal(travelDistance(9, 60), 150);
  assert.equal(travelDistance(9, 60), travelDistance(9, 60));
  assert.equal(travelDistance(2, 60), 100 / 3);
  assert.equal(travelDistance(100, 0), 0);
  assert.equal(travelDistance(NaN, 60), 0);
});
test('road segments cover a continuous range and preserve world identity while passing the car', () => {
  for (const distance of [0, 47.9, 48, 10000, 2]) {
    const rows = Array.from({length:12},(_,slot)=>roadSegment(slot,distance)).sort((a,b)=>a.index-b.index);
    assert.equal(new Set(rows.map(r=>r.index)).size,12);
    for (let i=1;i<rows.length;i++) assert.ok(Math.abs(rows[i].z-rows[i-1].z-48)<1e-9);
    assert.ok(rows[0].z<=-144&&rows.at(-1)!.z>300);
    for (const r of rows) assert.ok(Math.abs(r.index*48-r.z-distance)<=4*Number.EPSILON*Math.max(1,Math.abs(r.index*48),distance));
  }
  const before=roadSegment(0,1),after=roadSegment(0,2);
  assert.equal(before.index,after.index);assert.equal(before.z-after.z,1);
});
test('four cabin eyes share P7 seat coordinates and are distinct from the microphones', () => {
  assert.equal(cabinViews.fl.seat,'seat-1-1');assert.equal(cabinViews.rr.seat,'seat-2-3');
  assert.ok(cabinViews.fl.eye[0]>0&&cabinViews.fr.eye[0]<0);
  assert.ok(cabinViews.fl.eye[2]>cabinViews.rl.eye[2]);
  for (const row of Object.values(cabinViews)) {assert.ok(row.eye[1]>1.1&&row.eye[1]<1.3);const look=drivingLook(row.eye);assert.equal(look[0],row.eye[0]);assert.equal(look[2]-row.eye[2],5);}
});
test('cabin look rotates around the eye without translating it and clamps pitch', () => {
  const eye=cabinViews.fl.eye,copy=[...eye];const look=drivingLook(eye,Math.PI/2,0);
  assert.ok(Math.abs(look[0]-eye[0]-5)<1e-9);assert.ok(Math.abs(look[2]-eye[2])<1e-9);assert.deepEqual([...eye],copy);
  assert.deepEqual(drivingLook(eye,0,10),drivingLook(eye,0,.55));
});
test('wheel spin preserves its axle and semantic attachment, keeping the brake caliper stationary', () => {
  const wheel=new THREE.Group(),center=new THREE.Vector3(.831,.37,1.5);
  const tyre=new THREE.Mesh(new THREE.SphereGeometry(.37),new THREE.MeshBasicMaterial());tyre.position.copy(center);wheel.add(tyre);
  const caliper=new THREE.Object3D();caliper.name='brake-caliper';caliper.position.copy(center).add(new THREE.Vector3(0,.1,.2));wheel.add(caliper);
  const initial=caliper.position.clone(),motion=createWheelMotion(wheel,center,.37);
  motion.setDistance(2);wheel.updateMatrixWorld(true);
  assert.ok(tyre.getWorldPosition(new THREE.Vector3()).distanceTo(center)<1e-10);assert.ok(caliper.position.equals(initial));assert.equal(caliper.parent,wheel);assert.deepEqual(wheel.position.toArray(),[0,0,0]);
  motion.setSteering(.24);motion.setDistance(12);wheel.updateMatrixWorld(true);
  assert.ok(tyre.getWorldPosition(new THREE.Vector3()).distanceTo(center)<1e-10);
  const turned=initial.clone().sub(center).applyAxisAngle(new THREE.Vector3(0,1,0),.24).add(center);
  assert.ok(caliper.position.distanceTo(turned)<1e-10);motion.setSteering(0);assert.ok(caliper.position.distanceTo(initial)<1e-10);
  motion.setDistance(0);assert.equal(motion.pivot.rotation.x,0);
  tyre.geometry.dispose();(tyre.material as THREE.Material).dispose();
});


test('curved graded route preserves arc length, periodic seams and reversible vehicle coordinates',async()=>{
  const {sampleDrivingRoute,routePoint,routePeriodMetres}=await import('../src/team-a/viewer/driving-route');
  let minGrade=Infinity,maxGrade=-Infinity,minHeading=Infinity,maxHeading=-Infinity;
  for(let d=-200;d<2600;d+=3.7){
    const a=sampleDrivingRoute(d),b=sampleDrivingRoute(d+.1);
    assert.ok(Math.abs(a.position.distanceTo(b.position)-.1)<.00002);
    minGrade=Math.min(minGrade,a.grade);maxGrade=Math.max(maxGrade,a.grade);
    minHeading=Math.min(minHeading,Math.atan2(a.tangent.x,a.tangent.z));maxHeading=Math.max(maxHeading,Math.atan2(a.tangent.x,a.tangent.z));
    const local=routePoint(d,.8,.35).sub(a.position).applyQuaternion(a.rotation.clone().invert());
    assert.ok(local.distanceTo(new THREE.Vector3(.8,.35,0))<1e-10);
  }
  assert.ok(minGrade<-.05&&maxGrade>.05);assert.ok(maxHeading-minHeading>.7);
  for(const d of [0,routePeriodMetres,-routePeriodMetres])assert.ok(sampleDrivingRoute(d-.001).position.distanceTo(sampleDrivingRoute(d+.001).position)<.00201);
  assert.deepEqual(sampleDrivingRoute(145).position.toArray(),sampleDrivingRoute(145).position.toArray());
});
