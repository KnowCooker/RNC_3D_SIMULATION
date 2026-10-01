import assert from 'node:assert/strict';
import test from 'node:test';
import type { FieldFrame, Vec3 } from '../src/shared/lab-contracts';
import { fieldEvidence } from '../src/team-a/lab/field-evidence';

const frame = (reduction: number[], valid = true): FieldFrame => ({
  valid, time: 1, weighting: 'A',
  points: reduction.map((_, i): Vec3 => [i, 1, 0]),
  primarySpl: Float32Array.from(reduction, () => 60),
  residualSpl: Float32Array.from(reduction, () => 58),
  reductionDb: Float32Array.from(reduction),
});

test('paired spatial evidence distinguishes quieter, louder and near-zero samples without claiming a volume mean', () => {
  const result = fieldEvidence(frame([-2, -0.02, 0, 0.06, 3]));
  assert.deepEqual(result, {
    sampled: 5, valid: 5, improved: 2, nearZero: 2, worsened: 1,
    medianDb: 0, lowestDb: -2, highestDb: 3,
  });
});

test('invalid, mismatched and nonfinite samples cannot produce a stale or invented spatial verdict', () => {
  assert.equal(fieldEvidence(frame([1], false)), null);
  const truncated = frame([1, 2]); truncated.reductionDb = new Float32Array([1]);
  assert.equal(fieldEvidence(truncated), null);
  const partial = frame([1, 2, 3]); partial.primarySpl[1] = NaN;
  partial.reductionDb[2] = Infinity;
  assert.deepEqual(fieldEvidence(partial), {
    sampled: 3, valid: 1, improved: 1, nearZero: 0, worsened: 0,
    medianDb: 1, lowestDb: 1, highestDb: 1,
  });
});
