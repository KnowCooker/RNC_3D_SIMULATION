import type { FieldFrame } from '../../shared/lab-contracts';

export interface FieldEvidence {
  sampled: number;
  valid: number;
  improved: number;
  nearZero: number;
  worsened: number;
  medianDb: number;
  lowestDb: number;
  highestDb: number;
}

/** Descriptive counts of B's paired field samples; these are not a cabin-volume average. */
export function fieldEvidence(frame: FieldFrame): FieldEvidence | null {
  const sampled = frame.points.length;
  if (!frame.valid || sampled === 0 || frame.primarySpl.length !== sampled
    || frame.residualSpl.length !== sampled || frame.reductionDb.length !== sampled) return null;
  const values: number[] = [];
  let improved = 0, nearZero = 0, worsened = 0;
  for (let i = 0; i < sampled; i++) {
    const reduction = frame.reductionDb[i];
    if (![frame.primarySpl[i], frame.residualSpl[i], reduction].every(Number.isFinite)) continue;
    values.push(reduction);
    if (reduction > 0.05) improved++;
    else if (reduction < -0.05) worsened++;
    else nearZero++;
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return {
    sampled, valid: values.length, improved, nearZero, worsened,
    medianDb: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
    lowestDb: values[0], highestDb: values[values.length - 1],
  };
}
