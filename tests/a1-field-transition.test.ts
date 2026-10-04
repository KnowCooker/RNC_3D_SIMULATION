import test from 'node:test';
import assert from 'node:assert/strict';
import type { FieldFrame } from '../src/shared/lab-contracts';
import { createFieldDisplay } from '../src/team-a/viewer/field-display';
import { createFieldPoints } from '../src/team-a/viewer/field-slices';
import { displayEnergy } from '../src/team-a/viewer/field-display-data';

const points = createFieldPoints();
const frame = (time: number, db: number): FieldFrame => ({
  layoutId: 'teaching-fixed-v1', weighting: 'A', valid: true, time, points,
  primarySpl: new Float32Array(points.length).fill(db), residualSpl: new Float32Array(points.length).fill(db - 8),
  reductionDb: new Float32Array(points.length).fill(8),
});

test('A1: one-second field cadence keeps moving past the old 350 ms plateau', () => {
  const view = createFieldDisplay(points, true);
  view.advance(1, true); view.update(frame(1, 50), 'residual', 'volume', [45, 85], true);
  view.advance(2, true); view.update(frame(2, 70), 'residual', 'volume', [45, 85], true);
  view.advance(2.5, true); assert.ok(Math.abs(view.blend - .5) < 1e-9);
  view.advance(2.8, true); assert.ok(view.blend > .5 && view.blend < 1);
  view.advance(3, true); assert.equal(view.blend, 1);
  view.dispose();
});

test('A1: slices and volume share the same energy blend, including interrupted frames', () => {
  const view = createFieldDisplay(points, true), first = frame(1, 50), next = frame(2, 70);
  const original = next.primarySpl.slice();
  view.advance(1, true); view.update(first, 'residual', 'y', [45, 85], true);
  view.advance(2, true); view.update(next, 'residual', 'y', [45, 85], true);
  view.advance(2.5, true);
  const volume = view.volume.material.uniforms;
  for (const row of view.slices.values()) {
    const u = row.mesh.material.uniforms;
    assert.equal(u.temporalMix, volume.temporalMix);
    assert.ok(Math.abs(u.previousValues.value.image.data[0] - displayEnergy(50)) < 1e-6);
    assert.ok(Math.abs(u.values.value.image.data[0] - displayEnergy(70)) < 1e-6);
  }
  view.update(frame(2.6, 80), 'residual', 'y', [45, 85], true);
  const expected = (displayEnergy(50) + displayEnergy(70)) / 2;
  for (const row of view.slices.values()) assert.ok(Math.abs(row.mesh.material.uniforms.previousValues.value.image.data[0] - expected) < 1e-6);
  assert.deepEqual(next.primarySpl, original);
  view.dispose();
});

test('A1: paused same-window quantity changes crossfade without replacing physical textures', () => {
  const view = createFieldDisplay(points, true), data = frame(1, 70);
  view.advance(1, false, 10); view.update(data, 'residual', 'volume', [45, 85]);
  const u = view.volume.material.uniforms, version = u.samples.value.version;
  view.update(data, 'primary', 'volume', [45, 85]);
  assert.deepEqual(u.quantityWeights.value.toArray(), [0, 1, 0]);
  view.advance(1, false, 10.14);
  const visible = u.quantityWeights.value.clone();
  assert.ok(visible.x > .1 && visible.x < .9); assert.ok(visible.y > .1 && visible.y < .9);
  view.update(data, 'reduction', 'volume', [-10, 10]);
  assert.deepEqual(u.quantityWeights.value.toArray(), visible.toArray());
  view.advance(1, false, 10.5);
  assert.deepEqual(u.quantityWeights.value.toArray(), [0, 0, 1]);
  assert.equal(u.samples.value.version, version);
  assert.deepEqual(u.pressureRange.value.toArray(), [45, 85]);
  assert.deepEqual(u.improvementRange.value.toArray(), [-10, 10]);
  view.dispose();
});

test('A1: pause settles both slice textures and new identities cannot inherit a mode crossfade', () => {
  const view = createFieldDisplay(points, false), u = view.volume.material.uniforms;
  view.advance(1, true, 10); view.update(frame(1, 50), 'residual', 'y', [45, 85], true);
  view.advance(2, true, 11); view.update(frame(2, 70), 'residual', 'y', [45, 85], true);
  view.advance(2.2, false, 11.2);
  assert.equal(view.blend, 1);
  for (const row of view.slices.values()) assert.equal(row.mesh.material.uniforms.temporalMix.value, 1);
  view.update({...frame(3, 80), weighting: 'Z'}, 'primary', 'y', [45, 85], true);
  assert.equal(view.blend, 1);
  assert.deepEqual(u.quantityWeights.value.toArray(), [1, 0, 0]);
  view.clear(); view.update(frame(4, 60), 'reduction', 'y', [-10, 10], true);
  assert.deepEqual(u.quantityWeights.value.toArray(), [0, 0, 1]);
  view.dispose();
});
