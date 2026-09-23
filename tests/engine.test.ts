import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateSync, validateConfig, EngineError } from '../src/team-b/engine/core';
import { createPaths, convolve } from '../src/team-b/engine/data';
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
