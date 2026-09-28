import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLabConfig, TEACHING_LAYOUT_ID, type LabAnalysis, type LabResult } from '../src/shared/lab-contracts';
import { captureCase } from '../src/team-a/lab/case-compare';
import { CASE_EVIDENCE_MAX_BYTES, createCaseEvidence, parseCaseEvidence } from '../src/team-a/lab/case-evidence';

function snapshot(runId: string) {
  const config = defaultLabConfig(); config.durationSeconds = 10;
  const analysis: LabAnalysis = { time: 10, levelWeighting: 'A', valid: true, primarySpl: [60, 61, 62, 63],
    residualSpl: [55, 56, 57, 58], reductionDb: [5, 5, 5, 5], waveform: new Float32Array(), spectrum: null, spectrumDb: null, unit: 'Pa' };
  return captureCase({ runId, config } as LabResult, analysis);
}

test('exported A/B summary survives JSON roundtrip and recomputes deltas', () => {
  const a = snapshot('base'), b = snapshot('candidate');
  b.config.roadRoughness = 2.2; b.residualSpl = [55, 56, 60, 58];
  const json = createCaseEvidence(a, b, '后排变吵', '实车复测', '2026-09-28T00:00:00.000Z');
  const parsed = parseCaseEvidence(json);
  assert.equal(parsed.evidence.format, 'rnc-case-v1');
  assert.equal(parsed.evidence.baseline.config.layoutId, TEACHING_LAYOUT_ID);
  assert.equal(parsed.evidence.observation, '后排变吵');
  assert.equal(parsed.evidence.nextCheck, '实车复测');
  assert.deepEqual(parsed.comparison.changes, ['路面粗糙度 1.0 → 2.2']);
  assert.equal(parsed.comparison.residualDeltaDb[2], 3);
  b.residualSpl = [55, 56, 99, 58];
  assert.equal(parsed.evidence.candidate.residualSpl[2], 60);
});

test('condition mismatch imports but suppresses unsupported deltas', () => {
  const a = snapshot('base'), b = snapshot('candidate'); b.config.speedKph = 90;
  const parsed = parseCaseEvidence(createCaseEvidence(a, b, '', ''));
  assert.equal(parsed.comparison.comparable, false);
  assert.deepEqual(parsed.comparison.conditions, ['车速']);
  assert.equal(parsed.comparison.residualDeltaDb[2], null);
});

test('rejects oversized, forged, malformed and nonfinite evidence', () => {
  const a = snapshot('base'), b = snapshot('candidate');
  const json = createCaseEvidence(a, b, '', '');
  assert.throws(() => parseCaseEvidence('x'.repeat(CASE_EVIDENCE_MAX_BYTES + 1)), /64 KiB/);
  assert.throws(() => parseCaseEvidence('{'), /JSON/);
  const edit = (mutate: (record: Record<string, any>) => void) => { const record = JSON.parse(json); mutate(record); return JSON.stringify(record); };
  assert.throws(() => parseCaseEvidence(edit(r => { r.format = 'rnc-case-v0'; })), /版本/);
  assert.throws(() => parseCaseEvidence(edit(r => { r.candidate.config.vehicle = 'truck'; })), /车型/);
  assert.throws(() => parseCaseEvidence(edit(r => { r.candidate.config.layoutId = 'showroom-unverified-v1'; })), /物理布局身份/);
  assert.throws(() => parseCaseEvidence(edit(r => { r.candidate.config.layoutId = ''; })), /物理布局身份/);
  assert.throws(() => parseCaseEvidence(edit(r => { r.candidate.config.taps = 18.5; })), /系数数/);
  assert.throws(() => parseCaseEvidence(edit(r => { r.boundary = '实车认证'; })), /来源边界/);
  assert.throws(() => parseCaseEvidence(edit(r => { r.candidate.residualSpl = [1, 2, 3]; })), /残余/);
  assert.throws(() => parseCaseEvidence(edit(r => { r.candidate.windowEndSeconds = 9; })), /窗口与时长/);
  assert.throws(() => parseCaseEvidence(edit(r => { r.candidate.residualSpl[0] = 'Infinity'; })), /残余/);
  assert.throws(() => createCaseEvidence(a, b, 'x'.repeat(1001), ''), /观察/);
});

test('older rnc-case-v1 without layout identity imports as teaching layout', () => {
  const record = JSON.parse(createCaseEvidence(snapshot('base'), snapshot('candidate'), '', ''));
  delete record.baseline.config.layoutId;
  delete record.candidate.config.layoutId;
  const parsed = parseCaseEvidence(JSON.stringify(record));
  assert.equal(parsed.evidence.baseline.config.layoutId, TEACHING_LAYOUT_ID);
  assert.equal(parsed.evidence.candidate.config.layoutId, TEACHING_LAYOUT_ID);
  assert.equal(parsed.comparison.comparable, true);
});
