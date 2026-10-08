import type { LabAnalysis } from '../../shared/lab-contracts';

/** Overview uses the experiment's microphone analysis, independent of visible field meshes. */
export function overviewReading(analysis: LabAnalysis | null, seat: number, offset = 0) {
  if (!analysis?.valid || analysis.time < .5 || !Number.isInteger(seat) || seat < 0 || seat > 3) return null;
  const values = [analysis.primarySpl[seat], analysis.residualSpl[seat], analysis.reductionDb[seat]];
  if (values.some(value => value === null || !Number.isFinite(value))) return null;
  return {
    primary: values[0]!, residual: values[1]!, reduction: values[2]!,
    time: analysis.time + offset, unit: analysis.levelWeighting === 'Z' ? 'dBZ' : 'dBA',
  };
}
