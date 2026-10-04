import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchVehicleParts } from '../src/team-a/viewer/vehicle-batching';
import { createXPengModel } from '../src/team-a/viewer/xpeng-model';
import { sculptDashboard } from '../src/team-a/viewer/cabin-craft';
import { createRenderMeter } from '../src/team-a/viewer/render-meter';

test('A1: batching preserves per-part ownership, named hardware, transformed bounds and exterior isolation',()=>{
  const root=new THREE.Group(),door=new THREE.Group(),other=new THREE.Group();root.add(door,other);door.name='door';other.name='wheel';
  const geometry=new THREE.BoxGeometry(.2,.3,.4),m=new THREE.MeshStandardMaterial(),resources=new Set([geometry]);
  const shell:THREE.Mesh[]=[];
  for(let i=0;i<3;i++){const o=new THREE.Mesh(geometry,m);o.position.set(i*.4,.2,.1);o.rotation.z=.12*i;door.add(o);shell.push(o);}
  const inside=new THREE.Mesh(geometry,m);inside.name='acoustic-speaker';door.add(inside);
  const fixed=new THREE.Mesh(geometry,m);fixed.name='brake-caliper';other.add(fixed);
  const before=new THREE.Box3().setFromObject(root);let sourceDisposals=0;geometry.addEventListener('dispose',()=>sourceDisposals++);
  batchVehicleParts(root,shell,resources);
  assert.equal(door.children.length,2);assert.equal(shell.length,1);assert.equal(shell[0].parent,door);
  assert.equal(inside.parent,door);assert.equal(fixed.parent,other);assert.equal(inside.geometry,geometry);assert.equal(sourceDisposals,0);
  const after=new THREE.Box3().setFromObject(root);assert.ok(after.min.distanceTo(before.min)<1e-7&&after.max.distanceTo(before.max)<1e-7);
  const ray=new THREE.Raycaster(new THREE.Vector3(.4,.2,2),new THREE.Vector3(0,0,-1));assert.equal(ray.intersectObjects(root.children,true)[0].object.parent,door);
  door.position.x=1;root.updateMatrixWorld(true);assert.equal(fixed.getWorldPosition(new THREE.Vector3()).x,0);
  resources.forEach(g=>g.dispose());m.dispose();
});

test('A1: sculpted dashboard normals are finite, unit length and continuous at duplicated vertices',()=>{
  const g=sculptDashboard(1.8,.15,.34),p=g.getAttribute('position'),n=g.getAttribute('normal'),seen=new Map<string,THREE.Vector3>();
  for(let i=0;i<p.count;i++){
    assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
    const v=new THREE.Vector3().fromBufferAttribute(n,i);assert.ok(Math.abs(v.length()-1)<1e-5);
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>x.toFixed(5)).join('/'),old=seen.get(key);
    if(old)assert.ok(old.dot(v)>.995);seen.set(key,v);
  }
  assert.ok(g.boundingBox!.max.x<=.90001&&g.boundingBox!.min.x>=-.90001);g.dispose();
});

test('A1: detailed cabins remain separately detachable while materials and microtextures dispose once',()=>{
  for(const id of ['gx','p7plus'] as const){
    const model=createXPengModel(id),insert=model.group.getObjectByName('perforated-back-insert') as THREE.Mesh;
    assert.ok(insert);assert.equal(model.partForObject(insert),'seat-1-1');
    const material=insert.material as THREE.MeshPhysicalMaterial,grain=material.bumpMap!;assert.ok(grain.generateMipmaps);
    let disposals=0;grain.addEventListener('dispose',()=>disposals++);
    const sourceColour=material.color.getHexString();model.setPaint('#afbdc3');model.inspection.setBody('transparent');model.inspection.setBody('solid');
    assert.equal(material.color.getHexString(),sourceColour);assert.equal(material.opacity,1);
    const hood=model.group.getObjectByName('hood')!.children[0] as THREE.Mesh,coat=hood.material as THREE.Material,version=coat.version;
    model.inspection.setBody('solid');model.inspection.setBody('solid');assert.equal(coat.version,version,'same-view preview must not invalidate the material program again');
    model.group.updateMatrixWorld(true);const origin=insert.getWorldPosition(new THREE.Vector3());
    model.setPartProgress('seat-1-1',1);model.group.updateMatrixWorld(true);assert.ok(insert.getWorldPosition(new THREE.Vector3()).distanceTo(origin)>.5);
    model.setPartProgress('seat-1-1',0);model.group.updateMatrixWorld(true);assert.ok(insert.getWorldPosition(new THREE.Vector3()).distanceTo(origin)<1e-8);
    let meshes=0;model.group.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;});assert.ok(meshes<400,'static detail should stay below the review budget, without changing detachable parts');
    model.dispose();model.dispose();assert.equal(disposals,1);
  }
});

test('A1: render observations are bounded and never mix different vehicles or suspended frames',()=>{
  const host={dataset:{}} as HTMLElement,meter=createRenderMeter(host);let now=1000;
  meter(now,'gx',500,1000);for(let i=0;i<90;i++)meter(now+=10,'gx',500,1000);
  const first=JSON.parse(host.dataset.renderMeter!);assert.equal(first.frames,90);assert.equal(first.fps,100);assert.equal(first.drawCalls,500);
  meter(now+=10,'p7',100,200);for(let i=0;i<90;i++)meter(now+=20,'p7',100,200);
  const second=JSON.parse(host.dataset.renderMeter!);assert.equal(second.context,'p7');assert.equal(second.drawCalls,100);assert.equal(second.fps,50);
  meter(now+=2000,'p7',900,9000);meter(now+=20,'p7',100,200);assert.equal(host.dataset.renderMeter,JSON.stringify(second));
});
