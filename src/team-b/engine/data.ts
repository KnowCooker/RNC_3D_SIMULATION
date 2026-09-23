/** Direct port of fixtures/reference/reference_mimo.py; SI teaching units. */
export function uniform(seed: number, count: number): Float64Array {
  let state = seed >>> 0;
  return Float64Array.from({ length: count }, () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    state >>>= 0;
    return ((state + 0.5) / 4294967296) * 2 - 1;
  });
}

export type Paths = Float64Array[][];
export function createPaths(): { primary: Paths; secondary: Paths } {
  const primary = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => new Float64Array(24)));
  const secondary = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => new Float64Array(16)));
  for (let m = 0; m < 4; m++) for (let k = 0; k < 4; k++) {
    const p = m === k ? 12 : 14 + (m + k) % 3;
    primary[m][k][p] = m === k ? 0.032 : 0.006;
    primary[m][k][p + 2] = m === k ? 0.007 : 0.002;
    const s = m === k ? 4 : 5 + (m + k) % 3;
    secondary[m][k][s] = m === k ? 0.12 : 0.012;
    secondary[m][k][s + 2] = m === k ? 0.018 : 0.004;
  }
  return { primary, secondary };
}

export function convolve(input: Float64Array, kernel: Float64Array): Float64Array {
  const output = new Float64Array(input.length);
  for (let j = 0; j < kernel.length; j++) {
    if (kernel[j] === 0) continue;
    for (let n = j; n < input.length; n++) output[n] += kernel[j] * input[n - j];
  }
  return output;
}

export function createData(seed: number) {
  const sampleCount = 32000;
  const sinc = (v: number) => v === 0 ? 1 : Math.sin(Math.PI * v) / (Math.PI * v);
  const shape = Float64Array.from({ length: 65 }, (_, i) => {
    const t = i - 32;
    return (0.35 * sinc(0.35 * t) - 0.04 * sinc(0.04 * t)) * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / 64));
  });
  const norm = Math.sqrt(shape.reduce((s, v) => s + v * v, 0) / 3);
  for (let i = 0; i < shape.length; i++) shape[i] /= norm;
  const x = Array.from({ length: 4 }, (_, k) => convolve(uniform(seed + 101 * k, sampleCount), shape));
  const { primary, secondary } = createPaths();
  const d = Array.from({ length: 4 }, (_, m) => {
    const result = new Float64Array(sampleCount);
    for (let k = 0; k < 4; k++) {
      const signal = convolve(x[k], primary[m][k]);
      for (let n = 0; n < sampleCount; n++) result[n] += signal[n];
    }
    const disturbance = uniform(seed + 5001 + 101 * m, sampleCount);
    for (let n = 0; n < sampleCount; n++) result[n] += 0.001 * Math.sqrt(3) * disturbance[n];
    return result;
  });
  return { x, d, primary, secondary };
}
