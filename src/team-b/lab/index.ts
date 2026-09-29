import { finiteSignal, finiteWeight, LabDivergenceError } from './divergence';
import { validateLabConfig } from './validation';
export { validateLabConfig } from './validation';
export { createLabStream, LAB_STREAM_CABIN_PREROLL_SAMPLES } from './stream';
import type { Four } from '../../shared/contracts';
import { LAB_WAVEFORM_SECONDS, MIC_POSITIONS, type AcousticWeighting, type LabAnalysisOptions, type FieldFrame, type LabAnalysis, type LabConfig, type LabResult, type LabSelection, type Vec3 } from '../../shared/lab-contracts';
import { meanPower, welchPsd } from '../analysis';
import { applyPath, primaryPath, referencePath, secondaryPath, samplePath, type SparsePath } from './paths';
import { createSources } from './sources';
import { A_WEIGHTING_HISTORY, weightedPower, weightedSpectrum } from './weighting';
import { nfxlmsGain } from './nfxlms';
import type { RecordedNoise } from './recorded-noise';
export { decodeRecordedNoise, type RecordedNoise } from './recorded-noise';

export const LAB_WINDOW_SAMPLES = 1000;
const POWER_FLOOR = 1e-20;
const four = <T>(values: T[]) => values as unknown as Four<T>;
const spl = (power: number) => 10 * Math.log10(Math.max(POWER_FLOOR, power) / (20e-6) ** 2);
const reduction = (d: number, e: number) => d <= POWER_FLOOR ? 0 : 10 * Math.log10(d / Math.max(POWER_FLOOR, e));

/** Actual multichannel normalized FxLMS; filters W[output][reference][tap], e=d+S*u. */
export function calculateLab(config: LabConfig, runId: string, recording?: RecordedNoise): LabResult {
  validateLabConfig(config);
  const started = performance.now(), count = config.durationSeconds * config.sampleRateHz, taps = config.taps, pad = taps - 1;
  const sources = createSources(config, recording);
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
  let completed=count, divergence: LabResult['divergence'];
  if (learning) {
    const padded = x.map(channel => { const p = new Float64Array(count + pad); p.set(channel, pad); return p; });
    const filtered = secondary.map(row => row.map((path, output) => config.speakerEnabled[output] ? x.map(channel => {
      const p = new Float64Array(count + pad); p.set(applyPath(channel, path), pad); return p;
    }) : []));
    const weights = Array.from({ length: 4 }, () => x.map(() => new Float64Array(taps)));
    const powers = new Float64Array(4);
    let n=0;
    try { for (; n < count; n++) {
      const end = n + pad;
      for (const output of active) {
        let drive = 0;
        for (let k = 0; k < x.length; k++) {
          const w = weights[output][k], input = padded[k];
          for (let j = 0; j < taps; j++) drive += w[j] * input[end - j];
        }
        // Store the actual drive before propagating: field sampling and microphone traces use identical signals.
        u[output][n] = finiteSignal(drive,n);
      }
      for (let m = 0; m < 4; m++) {
        let anti = 0;
        for (const output of active) anti += samplePath(u[output], secondary[m][output], n);
        a[m][n] = finiteSignal(anti,n);
        e[m][n] = finiteSignal(d[m][n] + a[m][n],n);
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
      const gain = nfxlmsGain(config.stepSize, powers);
      for (const output of active) {
        for (let k = 0; k < x.length; k++) {
          const w = weights[output][k], f0 = filtered[0][output][k], f1 = filtered[1][output][k], f2 = filtered[2][output][k], f3 = filtered[3][output][k];
          for (let j = 0; j < taps; j++) {
            const index = end - j;
            w[j] = finiteWeight(w[j] - gain * (error0 * f0[index] + error1 * f1[index] + error2 * f2[index] + error3 * f3[index]),n);
          }
        }
      }
    }
    } catch (error) {
      if (!(error instanceof LabDivergenceError)) throw error;
      completed=n; divergence=error.detail;
    }
  } else {
    for (let m = 0; m < 4; m++) e[m].set(d[m]);
  }
  const start = Math.max(0, completed - config.sampleRateHz * 4);
  const dp = d.map(channel => completed ? meanPower(channel, start, completed) : 0), ep = e.map(channel => completed ? meanPower(channel, start, completed) : 0);
  const trim=(channels:readonly Float32Array[])=>channels.map(channel=>channel.slice(0,completed));
  const signals = divergence ? {x:trim(x),u:four(trim(u)),d:four(trim(d)),a:four(trim(a)),e:four(trim(e))} : { x, u, d, a, e };
  for (const channels of Object.values(signals)) for (const channel of channels) {
    if (!channel.every(Number.isFinite)) throw new Error('计算出现非有限数值');
  }
  return { runId, config: structuredClone(config), sampleCount: completed, sources:divergence?four(trim(sources)):sources, signals, ...(divergence?{divergence}:{}),
    metrics: { reductionDbByMic: four(dp.map((power, i) => reduction(power, ep[i]))),
      aggregateReductionDb: reduction(dp.reduce((s, p) => s + p, 0), ep.reduce((s, p) => s + p, 0)) },
    computeMilliseconds: performance.now() - started };
}

const endAt = (result: LabResult, time: number) => Math.min(result.sampleCount, Math.max(0, Math.floor((Number.isFinite(time) ? time : 0) * result.config.sampleRateHz)));

/** Keep ordinary PSD bit-for-bit; scale extreme windows before squaring into Float32 PSD. */
function labPsd(signal: Float32Array, end: number, fs: number): Float32Array | Float64Array | null {
  const start=Math.max(0,end-2048);
  let peak=0; for(let i=start;i<end;i++) peak=Math.max(peak,Math.abs(signal[i]));
  if (peak <= 1e10) return welchPsd(signal,end,fs);
  if (!Number.isFinite(peak)) return null;
  const scaled=signal.slice(start,end).map(value=>value/peak);
  const density=welchPsd(scaled,scaled.length,fs);
  return density ? Float64Array.from(density,value=>value*peak*peak) : null;
}

export function analyzeLab(result: LabResult, time: number, selection: LabSelection, options: LabAnalysisOptions = {}): LabAnalysis {
  const end = endAt(result, time), prepared = end >= LAB_WINDOW_SAMPLES;
  const signal = selection.signal === 'q' ? result.sources[selection.channel] : result.signals[selection.signal]?.[selection.channel];
  if (!signal) throw new Error('所选信号通道不存在');
  const levelWeighting = options.levelWeighting ?? 'Z';
  // A-weighting describes sound pressure; vibration/drive spectra retain their physical linear units.
  const spectrumWeighting = ['d','a','e'].includes(selection.signal) ? options.spectrumWeighting ?? 'Z' : 'Z';
  const dp = result.signals.d.map(channel => prepared ? weightedPower(channel, end - LAB_WINDOW_SAMPLES, end, levelWeighting) : null);
  const ep = result.signals.e.map(channel => prepared ? weightedPower(channel, end - LAB_WINDOW_SAMPLES, end, levelWeighting) : null);
  const pressure = ['d', 'a', 'e'].includes(selection.signal);
  const spectrum = options.levelsOnly ? null : weightedSpectrum(labPsd(signal, end, result.config.sampleRateHz), result.config.sampleRateHz, spectrumWeighting);
  const requestedStart = options.waveformStartSeconds;
  const waveStart = requestedStart !== undefined && Number.isFinite(requestedStart)
    ? Math.max(0, Math.min(end, Math.floor(requestedStart * result.config.sampleRateHz)))
    : Math.max(0, end - LAB_WAVEFORM_SECONDS * result.config.sampleRateHz);
  return { spectrumWeighting, levelWeighting, time: end / result.config.sampleRateHz, valid: prepared && dp.every(power => power !== null && power > POWER_FLOOR),
    primarySpl: four(dp.map(power => power === null || power <= POWER_FLOOR ? null : spl(power))),
    residualSpl: four(ep.map(power => power === null || power <= POWER_FLOOR ? null : spl(power))),
    reductionDb: four(dp.map((power, i) => power === null || power <= POWER_FLOOR || ep[i] === null ? null : reduction(power, ep[i]!))),
    waveform: options.levelsOnly ? new Float32Array() : signal.slice(waveStart, end), spectrum,
    spectrumDb: spectrum ? Float32Array.from(spectrum, value => 10 * Math.log10(Math.max(value, 1e-24) / (pressure ? (20e-6) ** 2 : 1))) : null,
    unit: selection.signal === 'q' ? result.config.sourceMode === 'recorded-noise' ? '相对幅值' : 'm/s²（等效轮端激励）' : selection.signal === 'x' ? 'm/s²' : selection.signal === 'u' ? 'drive' : 'Pa' };
}

function accumulateWindow(input: Float32Array, path: SparsePath, start: number, target: Float64Array) {
  for (let j = 0; j < path.delays.length; j++) {
    const delay = path.delays[j], gain = path.gains[j];
    const first = Math.max(0, delay - start);
    for (let i = first; i < target.length; i++) target[i] += input[start + i - delay] * gain;
  }
}

/** Every field point reuses the physical q/P/u/S system, never microphone interpolation or target colours. */
export function sampleField(result: LabResult, time: number, points: Vec3[], weighting: AcousticWeighting = 'Z'): FieldFrame {
  if (points.length > 4096 || points.some(point => point.length !== 3 || !point.every(Number.isFinite))) throw new Error('声场点必须为有限三维坐标，单次最多4096点');
  const end = endAt(result, time), prepared = end >= LAB_WINDOW_SAMPLES;
  const primarySpl = new Float32Array(points.length).fill(NaN), residualSpl = new Float32Array(points.length).fill(NaN), reductionDb = new Float32Array(points.length).fill(NaN);
  let hasEnergy = false;
  if (prepared) for (let p = 0; p < points.length; p++) {
    const pre = weighting === 'A' ? Math.min(A_WEIGHTING_HISTORY, end - LAB_WINDOW_SAMPLES) : 0;
    const d = new Float64Array(LAB_WINDOW_SAMPLES + pre), a = new Float64Array(LAB_WINDOW_SAMPLES + pre);
    for (let i = 0; i < 4; i++) {
      accumulateWindow(result.sources[i], primaryPath(result.config, i, points[p]), end - LAB_WINDOW_SAMPLES - pre, d);
      if (result.config.speakerEnabled[i]) accumulateWindow(result.signals.u[i], secondaryPath(result.config, i, points[p]), end - LAB_WINDOW_SAMPLES - pre, a);
    }
    let dp = 0, ep = 0;
    if (weighting === 'A') {
      dp = weightedPower(Float32Array.from(d), pre, d.length, weighting);
      ep = weightedPower(Float32Array.from(d, (v, i) => Math.fround(v) + Math.fround(a[i])), pre, d.length, weighting);
    } else {
      for (let i = 0; i < LAB_WINDOW_SAMPLES; i++) { dp += d[i] ** 2; ep += (d[i] + a[i]) ** 2; }
      dp /= LAB_WINDOW_SAMPLES; ep /= LAB_WINDOW_SAMPLES;
    }
    if (dp > POWER_FLOOR) {
      hasEnergy = true;
      primarySpl[p] = spl(dp); residualSpl[p] = spl(ep); reductionDb[p] = reduction(dp, ep);
    }
  }
  return { weighting, time: end / result.config.sampleRateHz, valid: prepared && hasEnergy, points: points.map(point => [...point] as Vec3), primarySpl, residualSpl, reductionDb };
}
