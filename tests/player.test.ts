import test from 'node:test';
import assert from 'node:assert/strict';
import { resampleForAudio } from '../src/team-a/player';

test('audio paths use the same linear gain and sinc resampling', () => {
  const signal = Float32Array.from({ length: 2000 }, (_, n) => 0.1 * Math.sin(2 * Math.PI * 125 * n / 2000));
  const primary = resampleForAudio(signal), half = resampleForAudio(signal.map(v => v / 2));
  assert.equal(primary.length, 16000);
  for (let i = 0; i < primary.length; i++) assert.ok(Math.abs(primary[i] / 2 - half[i]) < 1e-6);
  assert.ok(Math.abs(Math.max(...primary) - 0.2) < 0.001);
  assert.ok(primary.every(v => Number.isFinite(v) && Math.abs(v) < 0.98));
});
