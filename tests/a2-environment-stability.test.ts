import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drivingGroundHeight, galleryHeight, sceneryVisibility } from '../src/team-a/viewer/landscape-height';
import { routePoint } from '../src/team-a/viewer/driving-route';
import { roadSegment } from '../src/team-a/viewer/driving-state';
import { createPanoramaSky } from '../src/team-a/viewer/panorama-sky';
import { constrainEnvironmentCamera } from '../src/team-a/viewer/environment-camera';

test('A2 landscape: finite, continuous, bounded slopes across every environment and negative world coordinates', () => {
  for (const env of ['coast','mountain','desert','snow'] as const) {
    for (let z=-500;z<=500;z+=13) for (let x=-380;x<=380;x+=11) {
      for (const height of [drivingGroundHeight,galleryHeight]) {
        assert.ok(Number.isFinite(height(x,z,env)));
        const slope=Math.hypot(height(x+.5,z,env)-height(x-.5,z,env),height(x,z+.5,env)-height(x,z-.5,env));
        assert.ok(slope<1.6,`${env} (${x},${z}) slope ${slope}`);
        assert.ok(Math.abs(height(x,z,env)-height(x+1e-5,z,env))<.0001);
      }
    }
  }
});

test('A2 road ground stays below the travelled lane through bends and grades', () => {
  for (const env of ['coast','mountain','desert','snow'] as const) for(let d=-400;d<2500;d+=9) {
    for (const lateral of [-1.8,0,1.8,5.4]) {
      const road=routePoint(d,lateral,-.027), ground=drivingGroundHeight(road.x,road.z,env);
      assert.ok(road.y-ground>.045,`${env} ground pokes through lane at ${d}/${lateral}`);
      assert.ok(road.y-ground<.3,`${env} ground separated from lane at ${d}/${lateral}`);
    }
  }
});

test('A2 recycled world tiles stay beyond the fully faded distance for forward and backward driving',()=>{
  for(let d=-5000;d<=5000;d+=23.9)for(let slot=0;slot<20;slot++){
    const a=roadSegment(slot,d,20,48,10),b=roadSegment(slot,d+.2,20,48,10);
    if(a.index!==b.index)for(const index of [a.index,b.index]){
      const nearest=Math.abs(index*48-d)-24-22; // tile edge plus maximum allowed orbit/pan
      assert.equal(sceneryVisibility(nearest),0);
    }
  }
  let last=1;for(let d=230;d<=360;d++){const v=sceneryVisibility(d);assert.ok(v<=last);assert.ok(last-v<.012);last=v;}
});

test('A2 sky retains complete imagery while loading and blends monotonically; rapid requests retain referenced textures',()=>{
  const sky=createPanoramaSky('test'),a=new THREE.Texture(),b=new THREE.Texture(),c=new THREE.Texture();
  const uniforms=(sky.mesh.material as THREE.ShaderMaterial).uniforms;
  sky.set(a,0);let last=0;
  for(let i=0;i<30;i++){sky.update(.05);assert.ok(uniforms.blend.value>=last);assert.ok(uniforms.blend.value-last<.07);last=uniforms.blend.value;}
  sky.set(null,0);assert.equal(uniforms.next.value,a);
  sky.set(b,1);sky.update(.05);sky.set(c,2);assert.ok(sky.uses(a)&&sky.uses(b)&&sky.uses(c));
  for(let i=0;i<60;i++)sky.update(.05);
  assert.equal(uniforms.next.value,c);assert.equal(uniforms.blend.value,1);assert.ok(!sky.uses(a)&&!sky.uses(b));
  assert.equal(sky.mesh.frustumCulled,false);assert.equal(sky.mesh.material.depthWrite,false);
  sky.dispose();a.dispose();b.dispose();c.dispose();
});

test('A2 outdoor camera cannot enter the floor, car shell or distant scenery after repeated pan/zoom/orbit',()=>{
  for(const stage of ['road','gallery'] as const)for(const asset of ['xpeng-p7plus','xpeng-gx'])for(let n=0;n<360;n+=5){
    const angle=n*Math.PI/180,position=new THREE.Vector3(Math.sin(angle)*.8,-3,Math.cos(angle)*.8),target=new THREE.Vector3(100,-100,-100);
    constrainEnvironmentCamera(position,target,stage,asset);
    assert.ok(position.y>=(stage==='road'?1.1:.4));assert.ok(Math.abs(target.x)<=2&&Math.abs(target.z)<=1.5&&target.y>=.45);
    assert.ok(Math.hypot(position.x,position.z)<=(stage==='road'?19:20)+1e-6);
    if(position.y<1.85)assert.ok(Math.abs(position.x)>=1.5-1e-6||Math.abs(position.z)>=3.05-1e-6);
  }
  const p=new THREE.Vector3(0,-2,0),t=new THREE.Vector3(0,0,0);constrainEnvironmentCamera(p,t,'workshop');assert.equal(p.y,-2);
});
