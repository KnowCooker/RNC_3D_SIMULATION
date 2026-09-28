import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLabConfig, type LabAnalysis, type LabResult } from '../src/shared/lab-contracts';
import { captureCase } from '../src/team-a/lab/case-compare';
import { createCaseEvidence, parseCaseEvidence } from '../src/team-a/lab/case-evidence';
import { reviewCase } from '../src/team-a/lab/case-review';

function snapshot(runId: string) {
  const config = defaultLabConfig(); config.durationSeconds = 10;
  const analysis: LabAnalysis = { time: 10, levelWeighting: 'A', valid: true, primarySpl: [60, 61, 62, 63],
    residualSpl: [55, 56, 57, 58], reductionDb: [5, 5, 5, 5], waveform: new Float32Array(), spectrum: null, spectrumDb: null, unit: 'Pa' };
  return captureCase({ runId, config } as LabResult, analysis);
}

test('one-variable review reports measured direction without assigning cause or approval', () => {
  const a = snapshot('base'), b = snapshot('candidate');
  b.config.roadRoughness = 2.2; b.residualSpl = [55, 56, 59, 57];
  const review = reviewCase(a, b);
  assert.ok(review.facts.some(value => value.includes('配置唯一变更：路面粗糙度 1.0 → 2.2')));
  assert.ok(review.facts.some(value => value.includes('左后座 +2.0 dB，右后座 -1.0 dB')));
  assert.ok(review.limits.some(value => value.includes('不能用于实车认证')));
  assert.ok(!review.facts.join('').includes('原因'));
});

test('confounded or mismatched cases never receive a causal or numeric verdict', () => {
  const a = snapshot('base'), b = snapshot('candidate');
  b.config.roadRoughness = 2.2; b.config.stepSize = 0.2;
  assert.ok(reviewCase(a, b).limits.some(value => value.includes('不能把结果归因')));
  b.config.speedKph = 80;
  const mismatch = reviewCase(a, b);
  assert.ok(mismatch.limits.some(value => value.includes('车速')));
  assert.ok(!mismatch.facts.some(value => value.includes('B−A：')));
});

test('new human fields roundtrip, legacy v1 imports blank, computed facts ignore human claims', () => {
  const a = snapshot('base'), b = snapshot('candidate'); b.config.roadRoughness = 2.2;
  const current = parseCaseEvidence(createCaseEvidence(a, b, '观察', '复测', '2026-09-28T00:00:00.000Z', '可能由路面导致', '暂不发布'));
  assert.equal(current.evidence.interpretation, '可能由路面导致');
  assert.equal(current.evidence.decision, '暂不发布');
  assert.ok(!reviewCase(current.evidence.baseline, current.evidence.candidate).facts.join('').includes('可能由路面导致'));
  const legacy = JSON.parse(createCaseEvidence(a, b, '观察', '复测'));
  delete legacy.interpretation; delete legacy.decision;
  const imported = parseCaseEvidence(JSON.stringify(legacy));
  assert.equal(imported.evidence.interpretation, '');
  assert.equal(imported.evidence.decision, '');
  legacy.interpretation = 'x'.repeat(1001);
  assert.throws(() => parseCaseEvidence(JSON.stringify(legacy)), /人工解释/);
});
