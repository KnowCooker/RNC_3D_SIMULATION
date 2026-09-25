import type { AcousticWeighting } from '../../shared/lab-contracts';
import { A_WEIGHTING_FIR } from './a-weighting-fir';

export const A_WEIGHTING_HISTORY = A_WEIGHTING_FIR.length - 1;
const filtered = new WeakMap<Float32Array, Float32Array>();
const response = (hz: number) => {
  const f2 = hz * hz;
  return 12194 ** 2 * f2 ** 2 / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
};
const at1k = response(1000);
export function aWeightPower(hz: number): number {
  return hz <= 0 ? 0 : (response(hz) / at1k) ** 2;
}
export function weightedSpectrum(psd: Float32Array | null, fs: number, weighting: AcousticWeighting): Float32Array | null {
  return !psd || weighting === 'Z' ? psd : psd.map((value, i) => value * aWeightPower(i * fs / 1024));
}
/** Cached causal filtering retains pre-window history. Weak keys do not retain old live snapshots. */
export function aWeightedSignal(input: Float32Array): Float32Array {
  const cached = filtered.get(input); if (cached) return cached;
  const output = new Float32Array(input.length);
  for (let n = 0; n < input.length; n++) {
    let value = 0;
    for (let k = 0; k < A_WEIGHTING_FIR.length && k <= n; k++) value += A_WEIGHTING_FIR[k] * input[n - k];
    output[n] = value;
  }
  filtered.set(input, output); return output;
}
export function weightedPower(input: Float32Array, start: number, end: number, weighting: AcousticWeighting): number {
  const values = weighting === 'A' ? aWeightedSignal(input) : input;
  let sum = 0;
  for (let n = start; n < end; n++) sum += values[n] ** 2;
  return sum / (end - start);
}
