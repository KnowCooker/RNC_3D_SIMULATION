import type { Four } from '../../shared/contracts';
import { MIC_POSITIONS, type LabChunk, type LabConfig, type LabLiveSnapshot, type LabResult } from '../../shared/lab-contracts';
import { primaryPath, referencePath, secondaryPath, type SparsePath } from './paths';
import { createSourceShape, sourceParameters } from './sources';
import { validateLabConfig } from './validation';
import { nfxlmsGain } from './nfxlms';

const four = <T>(values: T[]) => values as unknown as Four<T>;
const blank = (channels: number, count: number) => Array.from({ length: channels }, () => new Float32Array(count));
const SHORT_CAPACITY = 512;
const SHORT_MASK = SHORT_CAPACITY - 1;
/** Conservative prefix for points inside the assembled SUV; remote points may need longer paths. */
export const LAB_STREAM_CABIN_PREROLL_SAMPLES = 256;

/**
 * Stateful low-frequency simulator. process boundaries never reset sources, delays, or adaptation.
 * snapshot returns at most maxSamples in chronological order; its first samples are convolution
 * pre-roll when startSample > 0. Request >= 1256 samples for a latest 0.5 s A-weighted field window.
 */
export function createLabStream(input: LabConfig, runId: string, historySamples = 40000) {
  validateLabConfig(input);
  if (!Number.isSafeInteger(historySamples) || historySamples < 2048 || historySamples > 2_000_000) throw new Error('流式历史容量须为2048～2000000个样本');
  const config = structuredClone(input), taps = config.taps, nReferences = config.references.length;
  const active = config.speakerEnabled.flatMap((enabled, i) => enabled ? [i] : []);
  const learning = config.rncEnabled && config.stepSize > 0 && active.length > 0;
  const primary = MIC_POSITIONS.map(point => [0, 1, 2, 3].map(i => primaryPath(config, i, point)));
  const secondary = MIC_POSITIONS.map(point => [0, 1, 2, 3].map(i => secondaryPath(config, i, point)));
  const references = config.references.map(reference => [0, 1, 2, 3].map(i => referencePath(config, i, reference.position)));
  for (const rows of [primary, secondary, references]) for (const row of rows) for (const path of row) {
    if (path.delays.some(delay => delay >= SHORT_CAPACITY)) throw new Error('路径超出流式短延迟容量');
  }
  const arrays: Array<Float32Array | Float64Array | Uint32Array> = [];
  const doubles = () => { const values = new Float64Array(SHORT_CAPACITY * 2); arrays.push(values); return values; };
  const raw = Array.from({ length: 4 }, doubles), q = Array.from({ length: 4 }, doubles);
  const x = Array.from({ length: nReferences }, doubles), u = Array.from({ length: 4 }, doubles);
  const weights = Array.from({ length: 4 }, () => Array.from({ length: nReferences }, () => {
    const values = new Float64Array(taps); arrays.push(values); return values;
  }));
  const filtered = Array.from({ length: 4 }, () => Array.from({ length: 4 }, (_, output) =>
    learning && config.speakerEnabled[output] ? Array.from({ length: nReferences }, doubles) : []));
  const powers = new Float64Array(4), states = Uint32Array.from({ length: 4 }, (_, i) => config.seed + i * 101);
  arrays.push(powers, states);
  const source = sourceParameters(config);
  const shape = createSourceShape(config);
  if (shape.length > SHORT_CAPACITY) throw new Error('源整形滤波器超出流式历史容量');
  arrays.push(shape);
  const historySources = four(blank(4, historySamples));
  const history: LabResult['signals'] = { x: blank(nReferences, historySamples), u: four(blank(4, historySamples)),
    d: four(blank(4, historySamples)), a: four(blank(4, historySamples)), e: four(blank(4, historySamples)) };
  arrays.push(...historySources, ...Object.values(history).flat());
  const storageBytes = arrays.reduce((sum, values) => sum + values.byteLength, 0);
  let count = 0, computeMilliseconds = 0, failure: Error | null = null;
  const put = (values: Float64Array, index: number, value: number) => { values[index] = value; values[index + SHORT_CAPACITY] = value; };
  function pathSample(values: Float64Array, path: SparsePath, end: number) {
    let sum = 0;
    for (let j = 0; j < path.delays.length; j++) sum += path.gains[j] * values[end - path.delays[j]];
    return sum;
  }
  function mixedPath(rows: SparsePath[], end: number) {
    let sum = 0;
    // Match the batch convolution's accumulation order across source and path tap.
    for (let i = 0; i < 4; i++) for (let j = 0; j < rows[i].delays.length; j++) sum += rows[i].gains[j] * q[i][end - rows[i].delays[j]];
    return Math.fround(sum);
  }
  function processBlock(sampleCount: number): LabChunk {
    const started = performance.now(), startSample = count;
    const sources = four(blank(4, sampleCount));
    const signals: LabResult['signals'] = { x: blank(nReferences, sampleCount), u: four(blank(4, sampleCount)),
      d: four(blank(4, sampleCount)), a: four(blank(4, sampleCount)), e: four(blank(4, sampleCount)) };
    for (let n = 0; n < sampleCount; n++) {
      const absolute = count, index = absolute & SHORT_MASK, end = index + SHORT_CAPACITY;
      const historyIndex = absolute % historySamples;
      for (let i = 0; i < 4; i++) {
        let state = states[i]; state ^= state << 13; state ^= state >>> 17; state ^= state << 5; states[i] = state >>> 0;
        put(raw[i], index, ((states[i] + 0.5) / 4294967296) * 2 - 1);
        let broad = 0;
        for (let j = 0; j < shape.length; j++) broad += shape[j] * raw[i][end - j];
        const value = Math.fround(source.amplitude * broad);
        put(q[i], index, value); sources[i][n] = value; historySources[i][historyIndex] = value;
      }
      for (let k = 0; k < nReferences; k++) {
        const value = mixedPath(references[k], end);
        put(x[k], index, value); signals.x[k][n] = value; history.x[k][historyIndex] = value;
      }
      for (let m = 0; m < 4; m++) {
        const value = mixedPath(primary[m], end); signals.d[m][n] = value; history.d[m][historyIndex] = value;
      }
      if (learning) {
        for (const output of active) {
          let drive = 0;
          for (let k = 0; k < nReferences; k++) {
            const w = weights[output][k], inputValues = x[k];
            for (let j = 0; j < taps; j++) drive += w[j] * inputValues[end - j];
          }
          if (!Number.isFinite(drive) || Math.abs(drive) > 100) throw new Error(`FxLMS 数值不稳定，样本 ${absolute}；请降低步长或更改传感器位置`);
          const value = Math.fround(drive); put(u[output], index, value); signals.u[output][n] = value; history.u[output][historyIndex] = value;
        }
        for (let m = 0; m < 4; m++) {
          let anti = 0;
          for (const output of active) anti += pathSample(u[output], secondary[m][output], end);
          const value = Math.fround(anti); signals.a[m][n] = value; history.a[m][historyIndex] = value;
          const error = Math.fround(signals.d[m][n] + value); signals.e[m][n] = error; history.e[m][historyIndex] = error;
        }
        for (const output of active) {
          let change = 0;
          for (let m = 0; m < 4; m++) for (let k = 0; k < nReferences; k++) {
            const values = filtered[m][output][k], current = pathSample(x[k], secondary[m][output], end);
            put(values, index, current);
            change += current ** 2 - values[end - taps] ** 2;
          }
          powers[output] = Math.max(0, powers[output] + change);
        }
        if (absolute >= config.adaptationStartsSeconds * config.sampleRateHz) {
          const gain = nfxlmsGain(config.stepSize, powers);
          const e0 = signals.e[0][n], e1 = signals.e[1][n], e2 = signals.e[2][n], e3 = signals.e[3][n];
          for (const output of active) for (let k = 0; k < nReferences; k++) {
            const w = weights[output][k], f0 = filtered[0][output][k], f1 = filtered[1][output][k], f2 = filtered[2][output][k], f3 = filtered[3][output][k];
            for (let j = 0; j < taps; j++) {
              const at = end - j;
              w[j] -= gain * (e0 * f0[at] + e1 * f1[at] + e2 * f2[at] + e3 * f3[at]);
            }
          }
        }
      } else {
        for (let m = 0; m < 4; m++) { signals.e[m][n] = signals.d[m][n]; history.e[m][historyIndex] = signals.d[m][n]; }
      }
      count++;
    }
    computeMilliseconds += performance.now() - started;
    return { runId, startSample, sampleCount, sources, signals };
  }
  function process(sampleCount: number): LabChunk {
    if (failure) throw failure;
    if (!Number.isSafeInteger(sampleCount) || sampleCount < 1 || sampleCount > 1_000_000) throw new Error('单次流式块须为1～1000000个样本');
    if (!Number.isSafeInteger(count + sampleCount)) throw new Error('样本时钟超出安全整数范围，请开始新实验');
    try { return processBlock(sampleCount); }
    catch (error) {
      // The failed sample may have advanced FIR/PRNG state; a fresh experiment is required.
      failure = error instanceof Error ? error : new Error(String(error));
      throw failure;
    }
  }
  function snapshot(maxSamples = 32000): LabLiveSnapshot {
    if (failure) throw failure;
    if (!Number.isSafeInteger(maxSamples) || maxSamples < 1) throw new Error('快照最大长度须为正安全整数');
    const sampleCount = Math.min(maxSamples, count, historySamples), startSample = count - sampleCount;
    const copy = (values: Float32Array) => {
      const output = new Float32Array(sampleCount), start = startSample % historySamples;
      const first = Math.min(sampleCount, historySamples - start);
      output.set(values.subarray(start, start + first));
      if (first < sampleCount) output.set(values.subarray(0, sampleCount - first), first);
      return output;
    };
    const sources = four(historySources.map(copy));
    const signals: LabResult['signals'] = { x: history.x.map(copy), u: four(history.u.map(copy)), d: four(history.d.map(copy)), a: four(history.a.map(copy)), e: four(history.e.map(copy)) };
    const start = Math.max(0, sampleCount - 4 * config.sampleRateHz);
    const power = (values: Float32Array) => {
      let sum = 0; for (let n = start; n < sampleCount; n++) sum += values[n] ** 2;
      return sampleCount === 0 ? 0 : sum / (sampleCount - start);
    };
    const dp = signals.d.map(power), ep = signals.e.map(power);
    const reduction = (d: number, e: number) => d <= 1e-20 ? 0 : 10 * Math.log10(d / Math.max(1e-20, e));
    const result: LabResult = { runId, config: structuredClone(config), sampleCount, computeMilliseconds, sources, signals,
      metrics: { reductionDbByMic: four(dp.map((value, i) => reduction(value, ep[i]))), aggregateReductionDb: reduction(dp.reduce((sum, value) => sum + value, 0), ep.reduce((sum, value) => sum + value, 0)) } };
    return { startSample, endSample: count, result };
  }
  return { process, snapshot, get sampleCount() { return count; }, get storageBytes() { return storageBytes; }, get historyCapacity() { return historySamples; } };
}
