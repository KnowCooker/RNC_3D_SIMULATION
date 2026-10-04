import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFieldOcclusion } from '../src/team-a/viewer/field-occlusion';
import { createAssetInspection } from '../src/team-a/viewer/asset-inspection';
import { createFieldDisplay } from '../src/team-a/viewer/field-display';
import { createFieldPoints } from '../src/team-a/viewer/field-slices';
import type { FieldFrame } from '../src/shared/lab-contracts';

test('A1: vehicle depth pass ignores transparent body, keeps seats and restores renderer/hierarchy on failure', () => {
  const depth=createFieldOcclusion(),scene=new THREE.Scene(),car=new THREE.Group(),other=new THREE.Group();
  scene.add(car,other);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
  const ghost=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({transparent:true,depthWrite:false}));
  const previouslyHidden=new THREE.Mesh();previouslyHidden.visible=false;
  const contour=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial());
  car.add(seat,ghost,previouslyHidden,contour);
  const oldTarget=new THREE.WebGLRenderTarget();let currentTarget:THREE.WebGLRenderTarget|null=oldTarget;
  const renderer={
    shadowMap:{autoUpdate:true},
    getDrawingBufferSize:(v:THREE.Vector2)=>v.set(1280,720),
    getRenderTarget:()=>currentTarget,
    setRenderTarget:(v:THREE.WebGLRenderTarget|null)=>{currentTarget=v;},
    clear:()=>{},
    render:(pass:THREE.Scene)=>{
      assert.equal(car.parent,pass);assert.equal(seat.visible,true);assert.equal(ghost.visible,false);
      assert.equal(contour.visible,false);assert.equal(previouslyHidden.visible,false);
      assert.equal(renderer.shadowMap.autoUpdate,false);
      throw Error('depth pass unavailable');
    },
  };
  assert.throws(()=>depth.render(renderer as unknown as THREE.WebGLRenderer,car,new THREE.PerspectiveCamera()),/depth pass unavailable/);
  assert.equal(currentTarget,oldTarget);assert.equal(renderer.shadowMap.autoUpdate,true);
  assert.deepEqual(scene.children,[car,other]);assert.equal(car.parent,scene);
  assert.equal(ghost.visible,true);assert.equal(contour.visible,true);assert.equal(previouslyHidden.visible,false);
  depth.dispose();oldTarget.dispose();
});

test('A1: transparent contour styling returns the exact source colour, side and geometry in solid mode', () => {
  const root=new THREE.Group(),paint=new THREE.MeshStandardMaterial({color:'#43352b',side:THREE.DoubleSide,metalness:.7,roughness:.19});
  paint.userData.inspectionRim=true;
  const body=new THREE.Mesh(new THREE.BoxGeometry(),paint);root.add(body);
  const view=createAssetInspection(root,[body]),geometry=body.geometry;
  view.setBody('transparent');
  const styled=body.material as THREE.MeshStandardMaterial;
  assert.notEqual(styled,paint);assert.equal(styled.side,THREE.FrontSide);
  assert.equal(body.children.find(c=>c.name==='inspection-body-contour')?.visible,true);
  assert.equal(body.geometry,geometry);assert.equal(paint.color.getHexString(),'43352b');
  view.setBody('solid');assert.equal(styled.color.getHexString(),'43352b');
  assert.equal(styled.side,paint.side);assert.equal(styled.metalness,paint.metalness);assert.equal(styled.roughness,paint.roughness);
  assert.equal(body.children.find(c=>c.name==='inspection-body-contour')?.visible,false);
  view.dispose();view.dispose();assert.equal(body.material,paint);assert.equal(body.geometry,geometry);
  assert.equal(body.children.length,0);geometry.dispose();paint.dispose();
});

test('A1: same-frame slice preview preserves main field blend, signed range, slice and clipping', () => {
  const points=createFieldPoints(),view=createFieldDisplay(points,true);
  const frame:FieldFrame={valid:true,time:5,points,primarySpl:new Float32Array(280).fill(70),residualSpl:new Float32Array(280).fill(73),reductionDb:new Float32Array(280).fill(-3)};
  view.update(frame,'reduction','volume',[-8,8]);view.setOpacity(.9);view.setClip(new THREE.Plane(new THREE.Vector3(1,0,0),.2));
  const u=view.volume.material.uniforms,data=(u.samples.value.image.data as Float32Array).slice(),weights=u.quantityWeights.value.clone();
  assert.throws(()=>view.renderSnapshot(()=>{
    assert.equal(view.volume.visible,false);assert.equal(view.slices.get('x')!.mesh.visible,true);
    assert.equal(u.clipped.value,1);assert.deepEqual(u.quantityWeights.value.toArray(),[0,0,1]);
    assert.deepEqual(u.improvementRange.value.toArray(),[-8,8]);
    throw Error('preview failed');
  },{quantity:'reduction',slice:'x'}),/preview failed/);
  assert.equal(view.volume.visible,true);assert.equal(view.slices.get('x')!.mesh.visible,false);
  assert.equal(u.opacity.value,.9);assert.equal(u.clipped.value,1);
  assert.deepEqual(u.quantityWeights.value,weights);assert.deepEqual(u.samples.value.image.data,data);
  assert.deepEqual(Array.from(frame.reductionDb),new Array(280).fill(-3));view.dispose();
});
