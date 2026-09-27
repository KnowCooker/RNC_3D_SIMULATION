import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateSync, validateConfig, EngineError } from '../src/team-b/engine/core';
import { createData, createPaths, convolve, uniform } from '../src/team-b/engine/data';
import { DEFAULT_CONFIG } from '../src/shared/defaults';
import { decodeFixture } from '../src/shared/fixture';
import type { RunConfig } from '../src/shared/contracts';

const fixture = decodeFixture(JSON.parse(readFileSync(new URL('../fixtures/reference/golden_browser_fixture.json', import.meta.url), 'utf8')));
const reports = JSON.parse(readFileSync(new URL('../fixtures/reference/verification.json', import.meta.url), 'utf8')).cases;
const baseline = calculateSync(DEFAULT_CONFIG, 'test-baseline');

test('B01/B03: all 640,000 samples match immutable Python Float32 golden and e=d+a', () => {
  for (const kind of ['x', 'u', 'd', 'a', 'e'] as const) for (let channel = 0; channel < 4; channel++) {
    const actual = baseline.signals[kind][channel], expected = fixture.signals[kind][channel];
    assert.equal(actual.length, 32000);
    let errorPower = 0, referencePower = 0;
    for (let i = 0; i < actual.length; i++) {
      assert.ok(Number.isFinite(actual[i]));
      errorPower += (actual[i] - expected[i]) ** 2; referencePower += expected[i] ** 2;
    }
    const relative = Math.sqrt(errorPower / referencePower);
    assert.ok(relative <= 1e-3, `${kind}/${channel}: relative RMS ${relative}`);
  }
  for (let c = 0; c < 4; c++) for (let i = 0; i < 32000; i++) {
    assert.ok(Math.abs(baseline.signals.e[c][i] - baseline.signals.d[c][i] - baseline.signals.a[c][i]) <= 1e-5);
    if (i < 4000) assert.equal(baseline.signals.u[c][i], 0);
  }
});

test('B02/B04/B05: five configurations match Python metrics; repeat is deterministic', () => {
  for (const report of reports) {
    const config = { ...DEFAULT_CONFIG, seed: report.seed, taps: report.taps, stepSize: report.mu };
    const result = calculateSync(config, `test-${report.seed}-${report.taps}-${report.mu}`);
    result.metrics.reductionDbByMic.forEach((db, i) => {
      assert.ok(Math.abs(db - report.reductionDbByMic[i]) <= 0.2);
      assert.ok(db >= 0);
    });
    if (config.stepSize) assert.ok(result.metrics.aggregateReductionDb >= 3);
    else for (let c = 0; c < 4; c++) {
      assert.deepEqual(result.signals.d[c], result.signals.e[c]);
      assert.ok(result.signals.u[c].every(v => v === 0));
      assert.ok(result.signals.a[c].every(v => v === 0));
      assert.equal(result.metrics.aggregateReductionDb, 0);
    }
    if (report.seed === 11 && report.taps === 64 && report.mu === 0.08) assert.deepEqual(result.signals, baseline.signals);
  }
});

test('B06: every output reaches every mic; removing one cross-path removes only that response', () => {
  const { secondary } = createPaths();
  const impulse = new Float64Array(32); impulse[0] = 1;
  for (let l = 0; l < 4; l++) for (let m = 0; m < 4; m++) {
    const response = convolve(impulse, secondary[m][l]);
    assert.ok(response.some(v => v !== 0));
    assert.ok(response.subarray(0, 4).every(v => v === 0));
    assert.deepEqual(response.subarray(0, 16), secondary[m][l]);
  }
  secondary[0][1].fill(0);
  assert.ok(convolve(impulse, secondary[0][1]).every(v => v === 0));
  assert.ok(convolve(impulse, secondary[1][0]).some(v => v !== 0));
});

test('B07: rejects invalid taps, negative/NaN step, wrong fixed dimensions, null config', () => {
  for (const bad of [{ taps: 31 }, { stepSize: -1 }, { stepSize: NaN }, { sampleRateHz: 48000 }, { seed: 42 }, { durationSeconds: 1 }]) {
    assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, ...bad } as RunConfig), (e: unknown) => e instanceof EngineError && e.code === 'INVALID_CONFIG');
  }
  assert.throws(() => validateConfig(null as unknown as RunConfig), EngineError);
});

// Independently generated from the frozen Python oracle; regenerate only into a
// temporary output and compare, never replace expected values to hide a failure.
const sourceAudit = JSON.parse(readFileSync(new URL('../docs/evidence/B/B2-001/reference-audit.json', import.meta.url), 'utf8'));
function float32LeHash(signal: Float64Array): string {
  const bytes = Buffer.alloc(signal.length * 4);
  signal.forEach((value, i) => bytes.writeFloatLE(value, i * 4));
  return createHash('sha256').update(bytes).digest('hex');
}

test('B2-001: independent unsigned PRNG oracle preserves all three seeds and distinct channel streams', () => {
  for (const seed of [11, 29, 47]) {
    const channels = new Set<string>();
    for (let channel = 0; channel < 4; channel++) {
      const channelSeed = seed + 101 * channel;
      let state = BigInt(channelSeed);
      const expected = Float64Array.from({ length: 128 }, () => {
        const mask = 0xffffffffn;
        state = (state ^ (state << 13n)) & mask;
        state = (state ^ (state >> 17n)) & mask;
        state = (state ^ (state << 5n)) & mask;
        return ((Number(state) + 0.5) / 2 ** 32) * 2 - 1;
      });
      const actual = uniform(channelSeed, expected.length);
      assert.deepEqual(actual, expected);
      assert.ok(actual.every(value => value > -1 && value < 1));
      channels.add(float32LeHash(actual));
    }
    assert.equal(channels.size, 4); // Distinct streams, not a claim of physical wheel independence.
  }
});

test('B2-001: three-seed shaped references and primary pressure match every Python Float32 sample', () => {
  for (const expected of sourceAudit.cases) {
    const data = createData(expected.seed);
    for (const kind of ['x', 'd'] as const) for (let channel = 0; channel < 4; channel++) {
      const actual = data[kind][channel];
      assert.equal(actual.length, 32000);
      assert.ok(actual.every(Number.isFinite));
      assert.equal(float32LeHash(actual), expected[kind][channel].float32LeSha256, `${expected.seed}/${kind}/${channel}`);
      const rms = Math.sqrt(actual.reduce((sum, value) => sum + value * value, 0) / actual.length);
      assert.ok(Math.abs(rms - expected[kind][channel].rms) < 1e-12);
    }
  }
});

test('B2-001: all primary and secondary FIRs retain oracle taps, causal delays and complete cross-coupling', () => {
  const paths = createPaths();
  for (const [kind, length, expected] of [
    ['primary', 24, sourceAudit.primaryNonzeroTaps],
    ['secondary', 16, sourceAudit.secondaryNonzeroTaps],
  ] as const) {
    assert.equal(paths[kind].length, 4);
    let crossPaths = 0;
    for (let mic = 0; mic < 4; mic++) {
      assert.equal(paths[kind][mic].length, 4);
      for (let input = 0; input < 4; input++) {
        const kernel = paths[kind][mic][input];
        assert.equal(kernel.length, length);
        const oracle = new Float64Array(length);
        for (const [tap, value] of expected[mic][input]) oracle[tap] = value;
        assert.deepEqual(kernel, oracle);
        assert.ok(kernel.some(value => value !== 0));
        if (mic !== input) crossPaths++;
        const impulse = new Float64Array(64); impulse[7] = 1;
        const shifted = new Float64Array(64); shifted.set(oracle, 7);
        assert.deepEqual(convolve(impulse, kernel), shifted);
      }
    }
    assert.equal(crossPaths, 12);
  }
});

test('B2-001: original pressure includes the documented independent disturbance after causal P*x', () => {
  const { x, d, primary } = createData(11);
  for (let mic = 0; mic < 4; mic++) {
    const disturbance = uniform(11 + 5001 + 101 * mic, 32000);
    let residualPower = 0;
    for (let n = 0; n < 32000; n++) {
      let pressure = 0;
      for (let k = 0; k < 4; k++) for (let tap = 0; tap <= Math.min(n, 23); tap++) {
        pressure += primary[mic][k][tap] * x[k][n - tap];
      }
      const residual = d[mic][n] - pressure;
      assert.ok(Math.abs(residual - 0.001 * Math.sqrt(3) * disturbance[n]) < 1e-15);
      residualPower += residual ** 2;
    }
    assert.ok(Math.abs(Math.sqrt(residualPower / 32000) - 0.001) < 0.00002);
  }
});

test('B2-001: exported demo-v2 identity, units and last-sample time stay explicit', () => {
  assert.deepEqual(baseline.config, DEFAULT_CONFIG);
  assert.equal(baseline.config.pathProfileId, 'synthetic-4x4x4-v1');
  assert.equal(baseline.source, 'computed-browser');
  assert.deepEqual(baseline.order, ['fl', 'fr', 'rl', 'rr']);
  assert.deepEqual(baseline.units, { x: 'm/s2', u: 'drive', d: 'Pa', a: 'Pa', e: 'Pa' });
  assert.equal(baseline.sampleCount / baseline.config.sampleRateHz, 16);
  assert.equal((baseline.sampleCount - 1) / baseline.config.sampleRateHz, 15.9995);
});
