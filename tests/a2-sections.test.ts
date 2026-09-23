import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { sectionGeometry } from '../src/team-a/viewer/section-geometry';
import { createSectionDisplay } from '../src/team-a/viewer/section-display';

function area(geometry: THREE.BufferGeometry | null) {
  if (!geometry) return 0;
  const p = geometry.getAttribute('position'); let sum = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    sum += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return sum;
}
function release(section: ReturnType<typeof sectionGeometry>) { section.cap?.dispose(); section.contour?.dispose(); }

test('true mesh-plane sections preserve area, plane position and outward normal after transforms', () => {
  const shape = new THREE.BoxGeometry(2, 3, 4), plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  const cut = sectionGeometry(shape, plane, true); assert.ok(cut.cap); assert.equal(cut.openChains, 0); assert.equal(cut.closedLoops, 1);
  assert.ok(Math.abs(area(cut.cap) - 12) < 1e-6);
  const p = cut.cap.getAttribute('position'), n = cut.cap.getAttribute('normal');
  for (let i = 0; i < p.count; i++) { assert.ok(Math.abs(p.getX(i)) < 1e-7); assert.equal(n.getX(i), -1); }
  const transform = new THREE.Matrix4().compose(new THREE.Vector3(0.7, -1.3, 2.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.4, 0.7)), new THREE.Vector3(2, 3, 4));
  shape.applyMatrix4(transform); const transformedPlane = plane.clone().applyMatrix4(transform);
  const transformed = sectionGeometry(shape, transformedPlane, true); assert.ok(transformed.cap);
  assert.ok(Math.abs(area(transformed.cap) - 144) < 1e-4);
  const points = transformed.cap.getAttribute('position');
  for (let i = 0; i < points.count; i++) assert.ok(Math.abs(transformedPlane.distanceToPoint(new THREE.Vector3().fromBufferAttribute(points, i))) < 1e-6);
  release(cut); release(transformed); shape.dispose();
});

test('section through exact edges is closed; tangencies and existing coplanar faces are not duplicated', () => {
  const shape = new THREE.BoxGeometry(2, 2, 2);
  const diagonal = sectionGeometry(shape, new THREE.Plane(new THREE.Vector3(1, 1, 0).normalize(), 0), true);
  assert.ok(Math.abs(area(diagonal.cap) - 4 * Math.sqrt(2)) < 1e-5); assert.equal(diagonal.openChains, 0);
  for (const value of [1, 1.001, -1, -1.001]) {
    const tangent = sectionGeometry(shape, new THREE.Plane(new THREE.Vector3(1, 0, 0), -value), true); assert.equal(tangent.cap, null); release(tangent);
  }
  const near = sectionGeometry(shape, new THREE.Plane(new THREE.Vector3(1, 0, 0), -0.999), true);
  assert.ok(Math.abs(area(near.cap) - 4) < 1e-6); release(diagonal); release(near); shape.dispose();
});

test('ring sections keep their holes and disconnected islands; open surfaces never get a solid cap', () => {
  const torus = new THREE.TorusGeometry(2, 0.5, 32, 96);
  const ring = sectionGeometry(torus, new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), true);
  assert.equal(ring.closedLoops, 2); assert.ok(Math.abs(area(ring.cap) - 4 * Math.PI) / (4 * Math.PI) < 0.02);
  const islands = sectionGeometry(torus, new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), true);
  assert.equal(islands.closedLoops, 2); assert.ok(Math.abs(area(islands.cap) - Math.PI / 2) / (Math.PI / 2) < 0.02);
  const sheet = new THREE.PlaneGeometry(2, 2), sheetCut = sectionGeometry(sheet, new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), false);
  assert.equal(sheetCut.cap, null); assert.ok(sheetCut.contour); assert.equal(sheetCut.openChains, 1);
  const pipe = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0)), 8, 0.2, 16, false);
  const pipeCut = sectionGeometry(pipe, new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), false);
  assert.equal(pipeCut.cap, null); assert.ok(pipeCut.contour);
  [ring, islands, sheetCut, pipeCut].forEach(release); torus.dispose(); sheet.dispose(); pipe.dispose();
});

test('section display updates from exploded geometry, respects ancestor visibility and material opacity', () => {
  const model = new THREE.Group(), part = new THREE.Group(); model.add(part);
  const geometry = new THREE.BoxGeometry(2, 2, 2); geometry.userData.sectionClosed = true;
  const material = new THREE.MeshStandardMaterial({ color: '#8899aa' }), source = new THREE.Mesh(geometry, material); part.add(source);
  const sections = createSectionDisplay(model), plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  sections.update(plane); const cap = sections.group.children.find(p => p.name === 'section-cap') as THREE.Mesh;
  assert.equal(cap.visible, true); assert.ok(Math.abs(area(cap.geometry) - 4) < 1e-6);
  part.position.set(0.4, 0.7, -0.2); sections.update(plane);
  const positions = cap.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(cap.matrix).x) < 1e-6);
  material.transparent = true; material.opacity = 0.2; sections.update(plane); assert.equal((cap.material as THREE.Material).opacity, 0.2);
  part.visible = false; sections.update(plane); assert.equal(cap.visible, false);
  part.visible = true; part.position.x = 4; sections.update(plane); assert.equal(cap.visible, false);
  sections.update(null); assert.equal(sections.group.visible, false);
  sections.dispose(); geometry.dispose(); material.dispose();
});
