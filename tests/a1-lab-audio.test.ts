import test from 'node:test';
import assert from 'node:assert/strict';
import type { Four } from '../src/shared/contracts';
import { defaultLabConfig } from '../src/shared/lab-contracts';
import { prepareLabPlayback, resampleForAudio } from '../src/team-a/player';
import { calculateLab } from '../src/team-b/lab';

const four = (values: Float32Array[]) => values as unknown as Four<Float32Array>;
const maximum = (values: Float32Array) => values.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);

test('lab playback applies one gain to all eight signals, preserves d/e ratios and does not mutate physics', () => {
  const d = four(Array.from({ length: 4 }, (_, seat) => Float32Array.from({ length: 2000 }, (_, n) => (seat + 1) * Math.sin(2 * Math.PI * 125 * n / 2000))));
  const e = four(d.map(channel => channel.map(value => value / 4)));
  const input = { runId: 'physical-original', signals: { d, e } }, snapshot = structuredClone(input);
  const prepared = prepareLabPlayback(input);
  assert.ok(prepared.gain > 0 && prepared.gain < 1);
  assert.deepEqual(input, snapshot);
  assert.equal(prepared.result.runId, input.runId);
  for (const mode of ['d', 'e'] as const) for (let seat = 0; seat < 4; seat++) {
    assert.notEqual(prepared.result.signals[mode][seat], input.signals[mode][seat]);
    for (let n = 0; n < 2000; n++) assert.ok(Math.abs(prepared.result.signals[mode][seat][n] - input.signals[mode][seat][n] * prepared.gain) < 3e-8);
  }
  for (let seat = 0; seat < 4; seat++) {
    const primary = resampleForAudio(prepared.result.signals.d[seat]), residual = resampleForAudio(prepared.result.signals.e[seat]);
    for (let n = 0; n < primary.length; n++) assert.ok(Math.abs(primary[n] / 4 - residual[n]) < 1e-7);
  }
});

test('actual extreme valid lab experiment has no clipped samples after shared preparation', () => {
  const run = calculateLab({ ...defaultLabConfig(), speedKph: 130, roadRoughness: 3, treadRoughness: 3,
    pressureKpa: 320, temperatureC: -20 }, 'extreme-audio');
  const prepared = prepareLabPlayback(run);
  assert.ok(resampleForAudio(run.signals.d[0]).some(value => Math.abs(value) >= 0.979999), 'unprotected legacy resampling reproduces the clipping problem');
  for (const mode of ['d', 'e'] as const) for (let seat = 0; seat < 4; seat++) {
    const pcm = resampleForAudio(prepared.result.signals[mode][seat]);
    assert.ok(pcm.every(Number.isFinite));
    assert.ok(maximum(pcm) <= 0.90001, `${mode}/${seat} must remain below the limiter before user volume`);
  }
});

test('sinc overshoot is covered by the strict bound; silence and low-level legacy gain remain unchanged', () => {
  // Select input signs to align every interpolation coefficient at one output sample.
  // A source-peak-only gain guard would miss this sinc overshoot.
  const up = 8, kernel = new Float64Array(129), rowNorms = new Float64Array(8);
  for (let k = 0; k < kernel.length; k++) {
    const t = k - 64, x = 2 * 700 / 16000 * t;
    kernel[k] = 2 * 700 / 16000 * (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * (0.54 - 0.46 * Math.cos(2 * Math.PI * k / 128));
    rowNorms[k % up] += Math.abs(kernel[k]);
  }
  const phase = rowNorms.indexOf(Math.max(...rowNorms)), input = new Float32Array(256);
  const target = 128 * up + phase;
  for (let k = phase; k < kernel.length; k += up) input[(target - k + 64) / up] = Math.sign(kernel[k]) * 4;
  const prepared = prepareLabPlayback({ signals: { d: four([input, input, input, input]), e: four([input, input, input, input]) } });
  assert.ok(Math.abs(maximum(resampleForAudio(prepared.result.signals.d[0])) - 0.9) < 1e-6);
  const zero = new Float32Array(128), quiet = Float32Array.from({ length: 128 }, (_, n) => 0.01 * Math.sin(n));
  const low = { signals: { d: four([quiet, quiet, quiet, quiet]), e: four([zero, zero, zero, zero]) } };
  const unchanged = prepareLabPlayback(low);
  assert.equal(unchanged.gain, 1);
  assert.deepEqual(resampleForAudio(unchanged.result.signals.d[0]), resampleForAudio(quiet));
  assert.ok(resampleForAudio(unchanged.result.signals.e[0]).every(value => value === 0));
});
