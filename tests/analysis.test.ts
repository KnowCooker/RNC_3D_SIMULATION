import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeAt, welchPsd, syntheticSpl, steadyMetrics } from '../src/team-b/analysis';
import { decodeFixture } from '../src/shared/fixture';

const result = decodeFixture(JSON.parse(readFileSync(new URL('../fixtures/reference/golden_browser_fixture.json', import.meta.url), 'utf8')));
test('Hann Welch one-sided PSD integrates to tone mean-square and has the correct peak', () => {
  const tone = Float32Array.from({ length: 4096 }, (_, n) => Math.sin(2 * Math.PI * 125 * n / 2000));
  const psd = welchPsd(tone, tone.length)!;
  assert.equal(psd.length, 513);
  const integral = psd.reduce((s, v) => s + v, 0) * 2000 / 1024;
  assert.ok(Math.abs(integral - 0.5) < 0.001, `integral=${integral}`);
  assert.equal(psd.indexOf(Math.max(...psd)), 64);
  const dc = welchPsd(new Float32Array(2048).fill(1), 2048)!;
  assert.ok(Math.abs(dc.reduce((s, v) => s + v, 0) * 2000 / 1024 - 1) < 0.001);
});
test('analysis warming-up, window boundary, channel identity and pressure calibration', () => {
  const selection = { signal: 'e' as const, channel: 'rr' as const };
  const early = analyzeAt(result, 999, selection);
  assert.equal(early.valid, false); assert.equal(early.reason, 'warming-up');
  assert.equal(early.microphones[0].reductionDb, null); assert.equal(early.spectrum, null);
  const baseline = analyzeAt(result, 2000, selection);
  assert.equal(baseline.valid, true); assert.equal(baseline.microphones[0].reductionDb, 0);
  assert.equal(baseline.spectrum?.channel, 'rr');
  assert.equal(analyzeAt(result, Infinity, selection).endSampleExclusive, 0);
  assert.equal(analyzeAt(result, 99999, selection).endSampleExclusive, 32000);
  assert.equal(syntheticSpl(20e-6), 0);
  assert.ok(Math.abs(steadyMetrics(result.signals).aggregateReductionDb - 28.847918337250782) < 0.0001);
});
