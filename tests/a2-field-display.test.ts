import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { FieldFrame } from '../src/shared/lab-contracts';
import { createFieldPoints, fieldFrameMatchesPoints } from '../src/team-a/viewer/field-slices';
import { displayEnergy, fieldValues, packFieldVolume, pairedFieldRange, improvementFieldRange } from '../src/team-a/viewer/field-display-data';
import { createCameraMotion } from '../src/team-a/viewer/camera-motion';

const frame = (): FieldFrame => ({ valid: true, time: 4, points: createFieldPoints(), primarySpl: Float32Array.from({ length: 280 }, (_, i) => 40 + i / 10), residualSpl: Float32Array.from({ length: 280 }, (_, i) => 36 + i / 10), reductionDb: new Float32Array(280) });

test('volume texture keeps every queried point and both channels in WebGL storage order', () => {
  const f = frame(), before = Array.from(f.primarySpl), pixels = packFieldVolume(f);
  assert.equal(pixels.length, 560);
  for (let x = 0; x < 7; x++) for (let y = 0; y < 5; y++) for (let z = 0; z < 8; z++) {
    const source = (x * 5 + y) * 8 + z, target = ((z * 5 + y) * 7 + x) * 2;
    for (const channel of [0, 1]) {
      const expected = (channel ? f.residualSpl : f.primarySpl)[source];
      assert.ok(Math.abs(60 + 10 * Math.log10(pixels[target + channel]) - expected) < .00001);
    }
  }
  assert.deepEqual(Array.from(f.primarySpl), before);
  assert.equal(fieldFrameMatchesPoints(f, createFieldPoints()), true);
});

test('spatial smoothing operates on mean-square energy, not a mean of dB or RGB', () => {
  const midpoint = 60 + 10 * Math.log10((displayEnergy(40) + displayEnergy(60)) / 2);
  assert.ok(Math.abs(midpoint - 57.032913781186615) < 1e-10);
  assert.notEqual(midpoint, 50);
  assert.equal(displayEnergy(60), 1);
  assert.throws(() => displayEnergy(NaN));
  assert.throws(() => packFieldVolume({ ...frame(), primarySpl: new Float32Array(4) }));
});

test('improvement is the signed, same-point same-frame difference; worsening is retained', () => {
  const f = frame(); f.residualSpl[11] = f.primarySpl[11] + 3.5;
  const delta = fieldValues(f, 'reduction');
  assert.equal(delta[11], -3.5);
  assert.ok(Math.abs(delta[0] - 4) < 1e-6);
  assert.equal(fieldValues(f, 'primary'), f.primarySpl);
  assert.equal(fieldValues(f, 'residual'), f.residualSpl);
});

test('detail range includes both channels and has a nonzero span even for a flat frame', () => {
  const f = frame(); assert.deepEqual(pairedFieldRange(f), [35, 70]);
  f.primarySpl.fill(50); f.residualSpl.fill(50); assert.deepEqual(pairedFieldRange(f), [50, 60]);
  f.residualSpl[9] = 82; assert.deepEqual(pairedFieldRange(f), [50, 85]);
});

test('improvement detail keeps zero centered and includes real worsening and improvement', () => {
  const f = frame(); f.residualSpl[3] = f.primarySpl[3] + 8.2;
  assert.deepEqual(improvementFieldRange(f), [-9, 9]);
  f.residualSpl.set(f.primarySpl); assert.deepEqual(improvementFieldRange(f), [-3, 3]);
});

test('camera moves around the car and reaches an exact endpoint without overshoot', () => {
  const camera = new THREE.PerspectiveCamera(40); camera.position.set(0, 0, 5);
  const target = new THREE.Vector3(), motion = createCameraMotion(camera, target);
  motion.start([0, 0, -5], [0, 0, 0], 32, 0, 400); motion.update(200);
  assert.ok(Math.abs(camera.position.length() - 5) < 1e-9);
  assert.ok(Math.abs(camera.position.x) > 4.99); assert.equal(camera.fov, 36);
  motion.update(500); assert.deepEqual(camera.position.toArray(), [0, 0, -5]); assert.equal(motion.active, false);
});

test('manual input cancels motion; a rapid replacement starts at the currently visible pose', () => {
  const camera = new THREE.PerspectiveCamera(40); camera.position.set(0, 2, 6);
  const target = new THREE.Vector3(), motion = createCameraMotion(camera, target);
  motion.start([6, 2, 0], [0, .5, 0], 38, 0, 420); motion.update(160);
  const midway = camera.position.clone(); motion.start([-6, 2, 0], [0, 1, 0], 40, 160, 420); motion.update(160);
  assert.ok(camera.position.distanceTo(midway) < 1e-9);
  motion.cancel(); motion.update(900); assert.ok(camera.position.distanceTo(midway) < 1e-9);
  motion.start([4, 3, 5], [0, 1, 0], 35, 900, 0);
  assert.equal(motion.active, false); assert.deepEqual(camera.position.toArray(), [4, 3, 5]); assert.deepEqual(target.toArray(), [0, 1, 0]);
});
