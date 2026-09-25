import { validateLabConfig } from './validation';
export { validateLabConfig } from './validation';
export { createLabStream, LAB_STREAM_CABIN_PREROLL_SAMPLES } from './stream';
import type { Four } from '../../shared/contracts';
import { MIC_POSITIONS, type FieldFrame, type LabAnalysis, type LabConfig, type LabResult, type LabSelection, type Vec3 } from '../../shared/lab-contracts';
import { meanPower, welchPsd } from '../analysis';
import { applyPath, primaryPath, referencePath, secondaryPath, samplePath, type SparsePath } from './paths';
import { createSources } from './sources';

export const LAB_WINDOW_SAMPLES = 1000;
const POWER_FLOOR = 1e-20;
const four = <T>(values: T[]) => values as unknown as Four<T>;
const spl = (power: number) => 10 * Math.log10(Math.max(POWER_FLOOR, power) / (20e-6) ** 2);
const reduction = (d: number, e: number) => d <= POWER_FLOOR ? 0 : 10 * Math.log10(d / Math.max(POWER_FLOOR, e));

/** Actual multichannel normalized FxLMS; filters W[output][reference][tap], e=d+S*u. */
export function calculateLab(config: LabConfig, runId: string): LabResult {
  validateLabConfig(config);
  const started = performance.now(), count = config.durationSeconds * config.sampleRateHz, taps = config.taps, pad = taps - 1;
  const sources = createSources(config);
  const x = config.references.map(reference => {
    const values = new Float64Array(count);
    for (let i = 0; i < 4; i++) applyPath(sources[i], referencePath(config, i, reference.position), values);
    return Float32Array.from(values);
  });
  const d = four(MIC_POSITIONS.map(point => {
    const values = new Float64Array(count);
    for (let i = 0; i < 4; i++) applyPath(sources[i], primaryPath(config, i, point), values);
    return Float32Array.from(values);
  }));
  const secondary = MIC_POSITIONS.map(point => [0, 1, 2, 3].map(i => secondaryPath(config, i, point)));
  const blank = () => four(Array.from({ length: 4 }, () => new Float32Array(count)));
  const u = blank(), a = blank(), e = blank();
  const active = config.speakerEnabled.flatMap((enabled, i) => enabled ? [i] : []);
  const learning = config.rncEnabled && config.stepSize > 0 && active.length > 0;
  if (learning) {
    const padded = x.map(channel => { const p = new Float64Array(count + pad); p.set(channel, pad); return p; });
    const filtered = secondary.map(row => row.map((path, output) => config.speakerEnabled[output] ? x.map(channel => {
      const p = new Float64Array(count + pad); p.set(applyPath(channel, path), pad); return p;
    }) : []));
    const weights = Array.from({ length: 4 }, () => x.map(() => new Float64Array(taps)));
    const powers = new Float64Array(4);
    for (let n = 0; n < count; n++) {
      const end = n + pad;
      for (const output of active) {
        let drive = 0;
        for (let k = 0; k < x.length; k++) {
          const w = weights[output][k], input = padded[k];
          for (let j = 0; j < taps; j++) drive += w[j] * input[end - j];
        }
        if (!Number.isFinite(drive) || Math.abs(drive) > 100) throw new Error(`FxLMS 数值不稳定，样本 ${n}；请降低步长或更改传感器位置`);
        // Store the actual drive before propagating: field sampling and microphone traces use identical signals.
        u[output][n] = drive;
      }
      for (let m = 0; m < 4; m++) {
        let anti = 0;
        for (const output of active) anti += samplePath(u[output], secondary[m][output], n);
        a[m][n] = anti;
        e[m][n] = d[m][n] + a[m][n];
      }
      for (const output of active) {
        let change = 0;
        for (let m = 0; m < 4; m++) for (let k = 0; k < x.length; k++) {
          const f = filtered[m][output][k], leaving = end - taps;
          change += f[end] ** 2 - (leaving >= 0 ? f[leaving] ** 2 : 0);
        }
        powers[output] = Math.max(0, powers[output] + change);
      }
      if (n < config.adaptationStartsSeconds * config.sampleRateHz) continue;
      const error0 = e[0][n], error1 = e[1][n], error2 = e[2][n], error3 = e[3][n];
      // Joint energy also accounts for coherent loudspeaker columns of the multichannel plant.
      const gain = config.stepSize / (1e-6 + powers.reduce((sum, power) => sum + power, 0));
      for (const output of active) {
        for (let k = 0; k < x.length; k++) {
          const w = weights[output][k], f0 = filtered[0][output][k], f1 = filtered[1][output][k], f2 = filtered[2][output][k], f3 = filtered[3][output][k];
          for (let j = 0; j < taps; j++) {
            const index = end - j;
            w[j] -= gain * (error0 * f0[index] + error1 * f1[index] + error2 * f2[index] + error3 * f3[index]);
          }
        }
      }
    }
  } else {
    for (let m = 0; m < 4; m++) e[m].set(d[m]);
  }
  const start = count - config.sampleRateHz * 4;
  const dp = d.map(channel => meanPower(channel, start, count)), ep = e.map(channel => meanPower(channel, start, count));
  const signals = { x, u, d, a, e };
  for (const channels of Object.values(signals)) for (const channel of channels) {
    if (!channel.every(Number.isFinite)) throw new Error('计算出现非有限数值');
  }
  return { runId, config: structuredClone(config), sampleCount: count, sources, signals,
    metrics: { reductionDbByMic: four(dp.map((power, i) => reduction(power, ep[i]))),
      aggregateReductionDb: reduction(dp.reduce((s, p) => s + p, 0), ep.reduce((s, p) => s + p, 0)) },
    computeMilliseconds: performance.now() - started };
}

const endAt = (result: LabResult, time: number) => Math.min(result.sampleCount, Math.max(0, Math.floor((Number.isFinite(time) ? time : 0) * result.config.sampleRateHz)));

export function analyzeLab(result: LabResult, time: number, selection: LabSelection): LabAnalysis {
  const end = endAt(result, time), prepared = end >= LAB_WINDOW_SAMPLES;
  const signal = selection.signal === 'q' ? result.sources[selection.channel] : result.signals[selection.signal]?.[selection.channel];
  if (!signal) throw new Error('所选信号通道不存在');
  const dp = result.signals.d.map(channel => prepared ? meanPower(channel, end - LAB_WINDOW_SAMPLES, end) : null);
  const ep = result.signals.e.map(channel => prepared ? meanPower(channel, end - LAB_WINDOW_SAMPLES, end) : null);
  return { time: end / result.config.sampleRateHz, valid: prepared && dp.every(power => power !== null && power > POWER_FLOOR),
    primarySpl: four(dp.map(power => power === null || power <= POWER_FLOOR ? null : spl(power))),
    residualSpl: four(ep.map(power => power === null || power <= POWER_FLOOR ? null : spl(power))),
    reductionDb: four(dp.map((power, i) => power === null || power <= POWER_FLOOR || ep[i] === null ? null : reduction(power, ep[i]!))),
    waveform: signal.slice(Math.max(0, end - 400), end), spectrum: welchPsd(signal, end, result.config.sampleRateHz),
    unit: selection.signal === 'q' ? 'm/s²（等效轮端激励）' : selection.signal === 'x' ? 'm/s²' : selection.signal === 'u' ? 'drive' : 'Pa' };
}

function accumulateWindow(input: Float32Array, path: SparsePath, start: number, target: Float64Array) {
  for (let j = 0; j < path.delays.length; j++) {
    const delay = path.delays[j], gain = path.gains[j];
    const first = Math.max(0, delay - start);
    for (let i = first; i < target.length; i++) target[i] += input[start + i - delay] * gain;
  }
}

/** Every field point reuses the physical q/P/u/S system, never microphone interpolation or target colours. */
export function sampleField(result: LabResult, time: number, points: Vec3[]): FieldFrame {
  if (points.length > 4096 || points.some(point => point.length !== 3 || !point.every(Number.isFinite))) throw new Error('声场点必须为有限三维坐标，单次最多4096点');
  const end = endAt(result, time), prepared = end >= LAB_WINDOW_SAMPLES;
  const primarySpl = new Float32Array(points.length).fill(NaN), residualSpl = new Float32Array(points.length).fill(NaN), reductionDb = new Float32Array(points.length).fill(NaN);
  let hasEnergy = false;
  if (prepared) for (let p = 0; p < points.length; p++) {
    const d = new Float64Array(LAB_WINDOW_SAMPLES), a = new Float64Array(LAB_WINDOW_SAMPLES);
    for (let i = 0; i < 4; i++) {
      accumulateWindow(result.sources[i], primaryPath(result.config, i, points[p]), end - LAB_WINDOW_SAMPLES, d);
      if (result.config.speakerEnabled[i]) accumulateWindow(result.signals.u[i], secondaryPath(result.config, i, points[p]), end - LAB_WINDOW_SAMPLES, a);
    }
    let dp = 0, ep = 0;
    for (let i = 0; i < LAB_WINDOW_SAMPLES; i++) { dp += d[i] ** 2; ep += (d[i] + a[i]) ** 2; }
    dp /= LAB_WINDOW_SAMPLES; ep /= LAB_WINDOW_SAMPLES;
    if (dp > POWER_FLOOR) {
      hasEnergy = true;
      primarySpl[p] = spl(dp); residualSpl[p] = spl(ep); reductionDb[p] = reduction(dp, ep);
    }
  }
  return { time: end / result.config.sampleRateHz, valid: prepared && hasEnergy, points: points.map(point => [...point] as Vec3), primarySpl, residualSpl, reductionDb };
}
