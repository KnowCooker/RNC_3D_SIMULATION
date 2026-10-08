import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGalleryPlatform } from '../src/team-a/viewer/gallery-platform';

test('A2 platform has a continuous load-bearing car bay and a shallow, supported access path', () => {
  const platform = createGalleryPlatform(); platform.group.updateMatrixWorld(true);
  const down = new THREE.Raycaster(), hitsAt = (x: number, z: number) => {
    down.set(new THREE.Vector3(x, 2, z), new THREE.Vector3(0, -1, 0));
    return down.intersectObject(platform.group, true);
  };
  for (let x = -2; x <= 2; x += .25) for (let z = -3; z <= 3; z += .25) {
    const hit = hitsAt(x, z)[0]; assert.ok(hit, `missing floor under vehicle at ${x}/${z}`);
    assert.ok(Math.abs(hit.point.y + .024) < 1e-5);
    assert.ok(hit.face && hit.face.normal.y > .99);
  }
  for (const angle of [.2, 1.2, 2.5, 4.1, 5.3]) {
    const hit = hitsAt(Math.cos(angle) * 27, Math.sin(angle) * 27)[0];
    assert.ok(hit && Math.abs(hit.point.y + .024) < .001, 'coping must cover the structural edge from above');
    assert.ok(hit.face && hit.face.normal.y > .9, 'coping top must face outwards');
  }
  for (const side of [-1, 1]) {
    let previous = -.024;
    for (let radius = 27.25; radius < 31; radius += .08) {
      const hits = hitsAt(side * radius, 0); assert.ok(hits.length > 0, `unsupported access at ${side * radius}`);
      const height = hits[0].point.y;
      assert.ok(height <= previous + .001, 'access must descend away from the platform');
      assert.ok(previous - height <= .131, 'unexpected drop between consecutive step samples');
      assert.ok(height > -.40, 'access is submerged below the approach terrain'); previous = height;
    }
  }
  const bounds = new THREE.Box3().setFromObject(platform.group);
  assert.ok(bounds.min.y <= -.63 && bounds.min.y >= -.66);
  assert.ok(bounds.max.x >= 31 && bounds.min.x <= -31);
  platform.dispose();
});

test('A2 platform remains one underfloor visibility unit and keeps rough stone opaque across environments', () => {
  const platform = createGalleryPlatform(), floor = new THREE.Group(); floor.add(platform.group);
  for (const environment of ['coast', 'mountain', 'desert', 'snow'] as const) {
    platform.setEnvironment(environment);
    assert.ok(platform.finishMaterial.roughness >= .6);
    assert.equal(platform.finishMaterial.transparent, false);
    assert.equal(platform.finishMaterial.opacity, 1);
    let meshes = 0;
    platform.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++; let ancestor: THREE.Object3D | null = object;
      while (ancestor && ancestor !== floor) ancestor = ancestor.parent;
      assert.equal(ancestor, floor, `${object.name} escaped the stage floor lifecycle`);
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.array.length; i++) assert.ok(Number.isFinite(positions.array[i]));
    });
    assert.ok(meshes < 32, 'paving details cause excessive separate draw calls');
  }
  floor.visible = false;
  assert.equal(platform.group.parent, floor);
  platform.dispose();
});

test('A2 platform releases each owned GPU resource once, including instanced detail buffers', () => {
  const platform = createGalleryPlatform(), resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.InstancedMesh>();
  platform.group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    if (object instanceof THREE.InstancedMesh) resources.add(object);
  });
  const counts = new Map<object, number>();
  resources.forEach(resource => {
    const count = () => { counts.set(resource, (counts.get(resource) ?? 0) + 1); };
    if (resource instanceof THREE.Material) resource.addEventListener('dispose', count);
    else if (resource instanceof THREE.BufferGeometry) resource.addEventListener('dispose', count);
    else resource.addEventListener('dispose', count);
  });
  platform.dispose(); platform.dispose();
  resources.forEach(resource => assert.equal(counts.get(resource), 1));
  assert.equal(platform.group.children.length, 0);
});
