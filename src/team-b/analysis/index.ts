import { ORDER, type Four, type RunResult, type SteadyMetrics, type AnalysisFrame, type SignalKind, type Corner } from '../../shared/contracts';

export function meanPower(signal: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let n = start; n < end; n++) sum += signal[n] ** 2;
  return sum / (end - start);
}

export function steadyMetrics(signals: RunResult['signals']): SteadyMetrics {
  const d = signals.d.map(s => meanPower(s, 24000, 32000));
  const e = signals.e.map(s => meanPower(s, 24000, 32000));
  return { startSeconds: 12, endSeconds: 16, measurement: 'unweighted-full-sampled-band',
    reductionDbByMic: d.map((v, i) => 10 * Math.log10(v / e[i])) as unknown as Four<number>,
    aggregateReductionDb: 10 * Math.log10(d.reduce((a, b) => a + b) / e.reduce((a, b) => a + b)) };
}

/** Radix-2 FFT, symmetric Hann, Welch 50% overlap, power / (fs * sum(window^2)). */
export function welchPsd(signal: Float32Array, end: number, fs = 2000): Float32Array | null {
  const size = 1024;
  if (end < size) return null;
  const first = Math.max(0, end - 2048), psd = new Float32Array(513);
  let segments = 0;
  const hannWindow = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
  const scale = fs * hannWindow.reduce((sum, v) => sum + v * v, 0);
  for (let start = first; start + size <= end; start += size / 2) {
    const re = new Float64Array(size), im = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      let reverse = 0;
      for (let b = 0; b < 10; b++) reverse = (reverse << 1) | ((i >>> b) & 1);
      re[reverse] = signal[start + i] * hannWindow[i];
    }
    for (let len = 2; len <= size; len *= 2) {
      for (let base = 0; base < size; base += len) for (let j = 0; j < len / 2; j++) {
        const angle = -2 * Math.PI * j / len, c = Math.cos(angle), s = Math.sin(angle);
        const a = base + j, b = a + len / 2;
        const real = re[b] * c - im[b] * s, imaginary = re[b] * s + im[b] * c;
        re[b] = re[a] - real; im[b] = im[a] - imaginary; re[a] += real; im[a] += imaginary;
      }
    }
    for (let i = 0; i <= size / 2; i++) psd[i] += (re[i] ** 2 + im[i] ** 2) / scale * (i === 0 || i === size / 2 ? 1 : 2);
    segments++;
  }
  return psd.map(v => v / segments);
}

export function analyzeAt(result: RunResult, endSampleExclusive: number,
  selected: { signal: SignalKind; channel: Corner }): AnalysisFrame {
  const end = Math.max(0, Math.min(result.sampleCount, Math.floor(Number.isFinite(endSampleExclusive) ? endSampleExclusive : 0)));
  const microphones = ORDER.map((_, i) => {
    if (end < 1000) return { primaryRmsPa: null, residualRmsPa: null, reductionDb: null };
    const d = meanPower(result.signals.d[i], end - 1000, end), e = meanPower(result.signals.e[i], end - 1000, end);
    return { primaryRmsPa: Math.sqrt(d), residualRmsPa: Math.sqrt(e), reductionDb: d <= 1e-20 || e <= 1e-20 ? null : 10 * Math.log10(d / e) };
  }) as unknown as AnalysisFrame['microphones'];
  const psd = welchPsd(result.signals[selected.signal][ORDER.indexOf(selected.channel)], end);
  const valid = end >= 1000 && microphones.every(m => m.reductionDb !== null);
  return { runId: result.runId, endSampleExclusive: end, valid,
    reason: end < 1000 ? 'warming-up' : valid ? 'ok' : 'below-floor', microphones,
    spectrum: psd ? { ...selected, fftSize: 1024, window: 'hann', binHz: 2000 / 1024, psd } : null };
}

export function syntheticSpl(rmsPa: number): number { return 20 * Math.log10(Math.max(rmsPa, 1e-12) / 20e-6); }
