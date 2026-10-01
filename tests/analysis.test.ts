import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { analyzeAt, meanPower, welchPsd, syntheticSpl, steadyMetrics } from '../src/team-b/analysis';
import { decodeFixture } from '../src/shared/fixture';
import { defaultLabConfig, type LabResult } from '../src/shared/lab-contracts';
import { analyzeLab } from '../src/team-b/lab';
// Export verification uses the existing B analysis test entry; no common script changes.
import './helpers/export-tests';
import './helpers/lab-recipe-tests';

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

function constantResult(primary = [1, 1, 1, 1], residual = [1, 1, 1, 1]) {
  const copy = structuredClone(result);
  copy.signals.d.forEach((channel, i) => channel.fill(primary[i]));
  copy.signals.e.forEach((channel, i) => channel.fill(residual[i]));
  return copy;
}
const selection = { signal: 'e' as const, channel: 'fl' as const };

test('B2-002: RMS uses exactly the trailing 1000 samples, including first and final windows', () => {
  const trace = constantResult();
  trace.signals.d[0][0] = 2;
  trace.signals.d[0][1000] = 3;
  trace.signals.d[0][31999] = 4;
  assert.equal(analyzeAt(trace, 999, selection).valid, false);
  const first = analyzeAt(trace, 1000, selection);
  assert.equal(first.valid, true);
  assert.equal(first.spectrum, null); // RMS is ready before 1024-point PSD.
  assert.equal(first.microphones[0].primaryRmsPa, Math.sqrt(1003 / 1000));
  assert.equal(analyzeAt(trace, 1001, selection).microphones[0].primaryRmsPa, Math.sqrt(1008 / 1000));
  const final = analyzeAt(trace, 32000, selection);
  assert.equal(final.microphones[0].primaryRmsPa, Math.sqrt(1015 / 1000));
  assert.deepEqual(analyzeAt(trace, 90000, selection), final);
  assert.equal(analyzeAt(trace, 1000.9, selection).endSampleExclusive, 1000);
  for (const end of [-1, NaN, Infinity, -Infinity]) {
    const frame = analyzeAt(trace, end, selection);
    assert.equal(frame.endSampleExclusive, 0);
    assert.equal(frame.reason, 'warming-up');
  }
});

test('B2-002: same-window reduction preserves negative gains and aggregates powers before dB', () => {
  const trace = constantResult([1, 2, 3, 10], [2, 1, 1, 1]);
  const frame = analyzeAt(trace, 32000, selection);
  const expected = [-6.020599913279624, 6.020599913279624, 9.542425094393248, 20];
  frame.microphones.forEach((mic, i) => assert.ok(Math.abs(mic.reductionDb! - expected[i]) < 1e-12));
  const metrics = steadyMetrics(trace.signals);
  const pooled = 10 * Math.log10(114 / 7);
  assert.ok(Math.abs(metrics.aggregateReductionDb - pooled) < 1e-12);
  assert.ok(Math.abs(metrics.aggregateReductionDb - expected.reduce((a, b) => a + b) / 4) > 1);
  assert.equal(syntheticSpl(20e-6), 0);
  assert.ok(Math.abs(syntheticSpl(1) - 93.97940008672037) < 1e-12);
});

test('B2-002: silence and near-floor pressure never report valid zero-dB benefit', () => {
  for (const amplitude of [0, 1e-11]) {
    const frame = analyzeAt(constantResult(Array(4).fill(amplitude), Array(4).fill(amplitude)), 32000, selection);
    assert.equal(frame.valid, false);
    assert.equal(frame.reason, 'below-floor');
    assert.ok(frame.microphones.every(mic => mic.reductionDb === null));
    assert.ok(frame.spectrum!.psd.every(Number.isFinite));
  }
  assert.ok(Number.isNaN(steadyMetrics(constantResult([0, 0, 0, 0], [0, 0, 0, 0]).signals).aggregateReductionDb));
});

test('B2-002: non-finite pressure is unavailable, never a valid analysis frame', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const trace = constantResult();
    trace.signals.d[0][31999] = invalid;
    trace.signals.e[1][31999] = invalid;
    const frame = analyzeAt(trace, 32000, selection);
    assert.equal(frame.valid, false);
    assert.equal(frame.reason, 'below-floor'); // Existing unavailable-data reason; contract stays fixed.
    assert.equal(frame.microphones[0].primaryRmsPa, null);
    assert.equal(frame.microphones[0].reductionDb, null);
    assert.equal(frame.microphones[1].residualRmsPa, null);
    assert.equal(frame.microphones[1].reductionDb, null);
    assert.equal(frame.microphones[2].reductionDb, 0);
  }
  for (const rms of [-1, NaN, Infinity, -Infinity]) assert.ok(Number.isNaN(syntheticSpl(rms)));
});

test('B2-002: power rejects invalid ranges and PSD clamps finite sample cursors to actual data', () => {
  const signal = new Float32Array(1024).fill(1);
  assert.equal(meanPower(signal, 0, 1024), 1);
  for (const [start, end] of [[0, 0], [2, 1], [-1, 2], [0.5, 2], [0, 1025], [0, NaN], [0, Infinity]]) {
    assert.ok(Number.isNaN(meanPower(signal, start, end)), `${start}/${end}`);
  }
  assert.equal(welchPsd(signal, 1023), null);
  assert.equal(welchPsd(new Float32Array(1000), 5000), null);
  assert.deepEqual(welchPsd(signal, 4096), welchPsd(signal, 1024));
  assert.deepEqual(welchPsd(signal, 1024.9), welchPsd(signal, 1024));
  for (const fs of [0, -1, NaN, Infinity, Number.MIN_VALUE]) assert.equal(welchPsd(signal, 1024, fs), null);
});

test('B2-002: PSD rejects non-finite samples in its complete windows and ignores future samples', () => {
  const signal = new Float32Array(2048).fill(1);
  const first = welchPsd(signal, 1024);
  signal[1024] = NaN;
  assert.deepEqual(welchPsd(signal, 1024), first);
  assert.equal(welchPsd(signal, 2048), null);
  signal[1024] = Infinity;
  assert.equal(welchPsd(signal, 2048), null);
});

test('B2-002: non-finite PSD cursors cannot trap a caller in an unbounded loop', () => {
  // Run separately so removing the Infinity guard fails within a bounded time.
  const moduleUrl = new URL('../src/team-b/analysis/index.ts', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    `import { welchPsd } from ${JSON.stringify(moduleUrl)};
     import assert from 'node:assert/strict';
     for (const end of [Infinity, -Infinity, NaN, -1]) assert.equal(welchPsd(new Float32Array(2048), end), null);`],
  { encoding: 'utf8', timeout: 5000 });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr);
});

test('B2-002: shared PSD preserves lab pressure weighting and vibration/drive/source units', () => {
  const config = defaultLabConfig();
  const lab: LabResult = { runId: 'b2-unit-boundaries', config, sampleCount: result.sampleCount,
    sources: result.signals.x, signals: { ...result.signals, x: [...result.signals.x] }, metrics: result.metrics, computeMilliseconds: 0 };
  for (const kind of ['q', 'x', 'u', 'd', 'a', 'e'] as const) {
    const frame = analyzeLab(lab, 16, { signal: kind, channel: 3 }, { spectrumWeighting: 'A' });
    const pressure = ['d', 'a', 'e'].includes(kind);
    assert.equal(frame.spectrumWeighting, pressure ? 'A' : 'Z');
    assert.equal(frame.unit, pressure ? 'Pa' : kind === 'u' ? 'drive' : kind === 'x' ? 'm/s²' : 'm/s²（等效轮端激励）');
    assert.ok(frame.spectrum!.every(Number.isFinite));
    if (!pressure) assert.deepEqual(frame.spectrum, welchPsd(kind === 'q' ? lab.sources[3] : lab.signals[kind][3], 32000));
  }
  lab.config = { ...config, sourceMode: 'recorded-noise' };
  assert.equal(analyzeLab(lab, 16, { signal: 'q', channel: 0 }).unit, '相对幅值');
});

// Direct trigonometric DFT (no FFT/butterflies): independent PSD normalization oracle.
function directPsd(input: Float32Array, starts: number[], fs: number) {
  const window = Array.from({ length: 1024 }, (_, i) => (1 - Math.cos(2 * Math.PI * i / 1023)) / 2);
  const energy = window.reduce((sum, w) => sum + w * w, 0);
  return Float64Array.from({ length: 513 }, (_, bin) => {
    let power = 0;
    for (const start of starts) {
      let real = 0, imaginary = 0;
      for (let n = 0; n < 1024; n++) {
        const phase = 2 * Math.PI * bin * n / 1024, sample = input[start + n] * window[n];
        real += sample * Math.cos(phase); imaginary -= sample * Math.sin(phase);
      }
      power += real * real + imaginary * imaginary;
    }
    return power / (starts.length * fs * energy) * (bin === 0 || bin === 512 ? 1 : 2);
  });
}

test('B2-002: asymmetric signal Welch bins match direct DFT, 50% overlap and incomplete-tail handling', () => {
  const input = Float32Array.from({ length: 2400 }, (_, n) => (1 + n / 1000) * Math.sin(0.173 * n) + 0.3 * Math.cos(0.027 * n));
  for (const [end, starts] of [[1024, [0]], [1535, [0]], [1536, [0, 512]], [2048, [0, 512, 1024]], [2301, [253, 765, 1277]]] as const) {
    const expected = directPsd(input, [...starts], 2000), actual = welchPsd(input, end)!;
    expected.forEach((value, bin) => assert.ok(Math.abs(actual[bin] - value) <= 2e-7 * value + 1e-12, `${end}/${bin}`));
  }
});

test('B2-002: DC and Nyquist are not doubled; PSD scales as signal-unit squared per Hz', () => {
  const nyquist = Float32Array.from({ length: 2048 }, (_, n) => n % 2 ? -1 : 1);
  for (const signal of [new Float32Array(2048).fill(1), nyquist]) {
    const psd = welchPsd(signal, 2048)!;
    assert.ok(Math.abs(psd.reduce((a, b) => a + b, 0) * 2000 / 1024 - 1) < 1e-6);
    const scaled = welchPsd(signal.map(v => 3 * v), 2048)!;
    psd.forEach((value, i) => assert.ok(Math.abs(scaled[i] - 9 * value) <= 1e-6 * value + 1e-12));
    const faster = welchPsd(signal, 2048, 4000)!;
    psd.forEach((value, i) => assert.equal(faster[i], value / 2));
  }
  const trace = constantResult();
  for (const kind of ['x', 'u', 'd', 'a', 'e'] as const) {
    const frame = analyzeAt(trace, 32000, { signal: kind, channel: 'rr' });
    assert.equal(frame.spectrum!.signal, kind);
    assert.equal(frame.spectrum!.channel, 'rr');
    assert.deepEqual(frame.spectrum!.psd, welchPsd(trace.signals[kind][3], 32000));
  }
  assert.deepEqual(trace.units, { x: 'm/s2', u: 'drive', d: 'Pa', a: 'Pa', e: 'Pa' });
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
