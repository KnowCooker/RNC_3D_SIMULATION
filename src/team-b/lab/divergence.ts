import type { LabDivergence } from '../../shared/lab-contracts';
export class LabDivergenceError extends Error {
  readonly detail: LabDivergence;
  constructor(sample: number) {
    super(`已经发散：样本 ${sample} 出现数值溢出或非有限值，已自动暂停，无法继续此实验；请调整步长后重新开始。`);
    this.detail = { sample, message: this.message };
  }
}
/** Signals leave the solver as Float32. Stop only when the actual storage cannot represent them. */
export function finiteSignal(value: number, sample: number): number {
  const output = Math.fround(value);
  if (!Number.isFinite(output)) throw new LabDivergenceError(sample);
  return output;
}
export function finiteWeight(value: number, sample: number): number {
  if (!Number.isFinite(value)) throw new LabDivergenceError(sample);
  return value;
}
