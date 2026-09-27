import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLabConfig, type LabAnalysis, type LabResult } from '../src/shared/lab-contracts';
import { captureCase, compareCases } from '../src/team-a/lab/case-compare';

function snapshot(id: string) {
  const config = defaultLabConfig();
  config.durationSeconds = 10;
  const result = { runId: id, config } as LabResult;
  const analysis: LabAnalysis = { time: 10, levelWeighting: 'A', primarySpl: [60, 61, 62, 63], residualSpl: [57, 58, 59, 60], reductionDb: [3, 3, 3, 3], valid: true, waveform: new Float32Array(), spectrum: null, unit: 'Pa' };
  return captureCase(result, analysis);
}

test('one road change compares the same weighted window without keeping mutable config', () => {
  const base = snapshot('base'), candidate = snapshot('candidate');
  candidate.config.roadRoughness = 2.2;
  candidate.reductionDb = [3, 3, 4, 3];
  const comparison = compareCases(base, candidate);
  assert.equal(base.config.roadRoughness, 1);
  assert.equal(comparison.comparable, true);
  assert.deepEqual(comparison.changes, ['路面粗糙度 1.0 → 2.2']);
  assert.deepEqual(comparison.reductionDeltaDb, [0, 0, 1, 0]);
  assert.deepEqual(comparison.primaryDeltaDb, [0, 0, 0, 0]);
});

test('changed operating conditions block numeric deltas even when values are present', () => {
  const base = snapshot('base'), candidate = snapshot('candidate');
  candidate.config.speedKph = 80;
  candidate.config.durationSeconds = 20;
  const comparison = compareCases(base, candidate);
  assert.equal(comparison.comparable, false);
  assert.deepEqual(comparison.conditions, ['采样时长/末尾时间窗', '车速']);
  assert.deepEqual(comparison.reductionDeltaDb, [null, null, null, null]);
  assert.deepEqual(comparison.residualDeltaDb, [null, null, null, null]);
});

test('multiple configuration changes remain visible and missing seat values stay unavailable', () => {
  const base = snapshot('base'), candidate = snapshot('candidate');
  candidate.config.stepSize = 0.2;
  candidate.config.roadRoughness = 2.2;
  candidate.reductionDb = [3, 3, 3, null];
  const comparison = compareCases(base, candidate);
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.changes.length, 2);
  assert.equal(comparison.reductionDeltaDb[3], null);
  assert.throws(() => captureCase({ runId: 'invalid', config: base.config } as LabResult,
    { time: 0.3, levelWeighting: 'A' } as LabAnalysis), /0.5秒/);
});
