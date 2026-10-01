import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLabConfig } from '../src/shared/lab-contracts';
import { guideState, isFieldAtComparisonWindow, type GuideInput } from '../src/team-a/lab/guide-state';
import type { CaseSnapshot } from '../src/team-a/lab/case-compare';

function snapshot(id: string, road: number): CaseSnapshot {
  const config = defaultLabConfig(); config.durationSeconds = 10; config.roadRoughness = road;
  return { runId: id, config, windowEndSeconds: 10, primarySpl: [60, 61, 62, 63], residualSpl: [57, 58, 59, 60], reductionDb: [3, 3, 3, 3] };
}

function input(): GuideInput {
  const config = defaultLabConfig(); config.durationSeconds = 10; config.roadRoughness = 0.6;
  return { realtime: true, busy: false, config, currentRunId: null, currentValid: false, baseline: null, candidate: null, candidateFieldReady: false, heardOriginal: false, heardResidual: false };
}

test('guide requires actual baseline and candidate runs before showing comparison evidence', () => {
  const state = input();
  assert.equal(guideState(state).stage, 'mode');
  state.realtime = false;
  assert.equal(guideState(state).stage, 'baseline-run');
  state.busy = true;
  assert.equal(guideState(state).blocked, true);
  state.busy = false; state.currentRunId = 'A'; state.currentValid = true;
  assert.equal(guideState(state).stage, 'baseline-save');
  state.baseline = snapshot('A', 0.6);
  assert.equal(guideState(state).stage, 'road');
  state.config.roadRoughness = 2.2; state.currentRunId = null;
  assert.equal(guideState(state).stage, 'candidate-run');
  state.currentRunId = 'B'; state.candidate = snapshot('B', 2.2);
  assert.equal(guideState(state).stage, 'field');
  state.candidateFieldReady = true;
  assert.equal(guideState(state).stage, 'listen');
  state.heardOriginal = true; state.heardResidual = true;
  assert.equal(guideState(state).stage, 'review');
});

test('changed operating condition or multiple edits block the guided verdict', () => {
  const state = input(); state.realtime = false; state.baseline = snapshot('A', 0.6);
  state.config.speedKph = 80;
  assert.equal(guideState(state).stage, 'repair');
  state.config.speedKph = state.baseline.config.speedKph;
  state.config.roadRoughness = 2.2; state.config.stepSize = 0.2;
  assert.equal(guideState(state).stage, 'repair');
  state.config.stepSize = state.baseline.config.stepSize;
  state.currentRunId = 'B'; state.currentValid = true; state.candidate = snapshot('B', 2.2);
  state.candidate.config.speedKph = 80;
  assert.equal(guideState(state).stage, 'repair');
  state.candidate.config.speedKph = state.baseline.config.speedKph;
  state.candidate.config.stepSize = 0.2;
  assert.equal(guideState(state).stage, 'repair');
  state.candidate = snapshot('B', 0.6);
  assert.equal(guideState(state).stage, 'repair');
});

test('invalid candidate and stale field never unlock listening', () => {
  const state = input(); state.realtime = false; state.baseline = snapshot('A', 0.6);
  state.currentRunId = 'B'; state.currentValid = false; state.candidate = snapshot('B', 2.2);
  assert.equal(guideState(state).stage, 'repair');
  state.currentValid = true; state.candidateFieldReady = false; state.heardOriginal = true; state.heardResidual = true;
  assert.equal(guideState(state).stage, 'field');
});

test('a candidate field unlocks guidance only at the comparison window end', () => {
  const candidate = snapshot('B', 2.2);
  const sampleCount = 20_000;
  const sampleRateHz = candidate.config.sampleRateHz;
  assert.equal(isFieldAtComparisonWindow({ valid: true, time: 3, weighting: 'A' }, 'residual', sampleCount, sampleRateHz), false);
  assert.equal(isFieldAtComparisonWindow({ valid: true, time: 9.5, weighting: 'A' }, 'residual', sampleCount, sampleRateHz), false);
  assert.equal(isFieldAtComparisonWindow({ valid: true, time: 10, weighting: 'A' }, 'primary', sampleCount, sampleRateHz), false);
  assert.equal(isFieldAtComparisonWindow({ valid: true, time: 10, weighting: 'Z' }, 'residual', sampleCount, sampleRateHz), false);
  assert.equal(isFieldAtComparisonWindow({ valid: true, time: 10, weighting: 'A' }, 'residual', sampleCount, sampleRateHz), true);
  assert.equal(isFieldAtComparisonWindow({ valid: false, time: 10, weighting: 'A' }, 'residual', sampleCount, sampleRateHz), false);
  assert.equal(isFieldAtComparisonWindow({ valid: true, time: Number.NaN, weighting: 'A' }, 'residual', sampleCount, sampleRateHz), false);
});
