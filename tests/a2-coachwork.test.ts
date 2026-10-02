import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { coachworkSurface, roundedTrim } from '../src/team-a/viewer/coachwork-surface';
import { createP7PlusModel } from '../src/team-a/viewer/p7plus-model';

test('separate curved sheets have continuous boundary normals and finite UV coordinates',()=>{
  const left=coachworkSurface((u,v)=>[Math.cos(u),v,Math.sin(u)],32,12);
  const right=coachworkSurface((u,v)=>[Math.cos(u+1),v,Math.sin(u+1)],32,12);
  for(let row=0;row<=12;row++){
    const a=new THREE.Vector3().fromBufferAttribute(left.getAttribute('normal'),32*13+row);
    const b=new THREE.Vector3().fromBufferAttribute(right.getAttribute('normal'),row);
    assert.ok(a.dot(b)>.99999,'independent panel tessellation must not create a hard shading seam');
    assert.ok(Math.abs(a.length()-1)<1e-6);
  }
  for(const g of [left,right]){assert.ok([...g.getAttribute('uv').array].every(Number.isFinite));g.dispose();}
});

test('rounded lamp apertures preserve the original silhouette bounds without repeated sharp corners',()=>{
  const outline=roundedTrim([[-.3,0],[.3,0],[.25,.14],[-.25,.14]],.015);
  assert.equal(outline.length,20);
  assert.ok(outline.every(([x,y])=>Math.abs(x)<=.3&&y>=0&&y<=.14));
  assert.ok(!outline.some(([x,y])=>x===.3&&y===0));
});

test('P7 shoulder-to-window gap is closed by paint owned by the removable front door',()=>{
  const model=createP7PlusModel();model.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(1.3,1.03,0),new THREE.Vector3(-1,0,0));
  const hit=model.inspection.pick(ray);assert.ok(hit);assert.equal(model.partForObject(hit.object),'front-door-1');
  assert.ok(hit.point.x>.86);assert.equal(((hit.object as THREE.Mesh).material as THREE.MeshPhysicalMaterial).clearcoat,1);
  model.dispose();
});
