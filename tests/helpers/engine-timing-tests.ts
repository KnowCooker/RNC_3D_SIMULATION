import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../../src/shared/defaults';
import { calculateSync } from '../../src/team-b/engine/core';
import { loadCore } from './engine-harness';
import { runTimingAudit, timingData, checkTiming } from './engine-timing-audit';

test('B1-002: unchanged core in test harness matches normal production entry sample-for-sample', () => {
  const normal = calculateSync(DEFAULT_CONFIG, 'normal');
  const harness = loadCore().calculateSync(DEFAULT_CONFIG, 'harness');
  assert.deepEqual(harness.signals, normal.signals);
  assert.deepEqual(harness.metrics, normal.metrics);
});

test('B1-002: asymmetric matrices and independent recurrence detect sign/index/cross-path/timing faults', () => {
  const audit = runTimingAudit();
  assert.equal(audit.mutations.length, 11);
  assert.ok(audit.mutations.every(m => m.detected));
});

test('B1-002: every one of 16 output/reference controller routes contributes with the correct update', () => {
  const contributions: number[][] = [];
  for (let k = 0; k < 4; k++) {
    const input = timingData(k);
    const result = loadCore(() => input).calculateSync(DEFAULT_CONFIG, `reference-${k}`);
    checkTiming(result, input, 64);
    const outputs = result.signals.u.map(row => row[4001]);
    assert.ok(outputs.every(value => Math.abs(value) > 1e-8), `reference ${k}: missing controller route`);
    contributions.push(outputs);
  }
  const allInput = timingData();
  const all = loadCore(() => allInput).calculateSync(DEFAULT_CONFIG, 'all-references');
  for (let l = 0; l < 4; l++) {
    const sum = contributions.reduce((value, route) => value + route[l], 0);
    assert.ok(Math.abs(sum - all.signals.u[l][4001]) < 1e-9);
  }
});

test('B1-002: modifying future x/d cannot change any past output', () => {
  const input = timingData(), future = timingData(), boundary = 4025;
  for (let c = 0; c < 4; c++) {
    for (let n = boundary; n < 4070; n++) { future.x[c][n] *= -0.7; future.d[c][n] *= 1.1; }
  }
  const original = loadCore(() => input).calculateSync(DEFAULT_CONFIG, 'original');
  const changed = loadCore(() => future).calculateSync(DEFAULT_CONFIG, 'future');
  for (const key of ['u', 'a', 'e'] as const) for (let c = 0; c < 4; c++) {
    assert.deepEqual(changed.signals[key][c].subarray(0, boundary), original.signals[key][c].subarray(0, boundary));
  }
  assert.notDeepEqual(changed.signals.e[0].subarray(boundary, 4070), original.signals.e[0].subarray(boundary, 4070));
});
