import { ORDER, type Four, type RunConfig, type RunResult, type DemoError } from '../../shared/contracts';
import { DEFAULT_CONFIG } from '../../shared/defaults';
import { createData, convolve } from './data';
import { steadyMetrics } from '../analysis';

export class EngineError extends Error implements DemoError {
  constructor(public code: DemoError['code'], message: string, public runId: string) { super(message); }
}

export function validateConfig(config: RunConfig, runId = ''): void {
  if (!config || typeof config !== 'object') throw new EngineError('INVALID_CONFIG', '配置必须是对象', runId);
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof RunConfig)[]) {
    const valid = key === 'taps' ? [32, 64].includes(config.taps)
      : key === 'stepSize' ? [0, 0.08].includes(config.stepSize)
      : key === 'seed' ? [11, 29, 47].includes(config.seed)
      : config[key] === DEFAULT_CONFIG[key];
    if (!valid) throw new EngineError('INVALID_CONFIG', `无效配置：${key}`, runId);
  }
}

/** Synchronous pure core; browser integration runs this exclusively in a Worker. */
export function calculateSync(config: RunConfig, runId: string): RunResult {
  validateConfig(config, runId);
  const started = performance.now();
  const { x, d, secondary } = createData(config.seed);
  const nSamples = 32000, taps = config.taps, pad = taps - 1;
  const paddedX = x.map(signal => { const p = new Float64Array(nSamples + pad); p.set(signal, pad); return p; });
  // filtered[error][output][reference][sample + pad], newest tap first below.
  const filtered = secondary.map(row => row.map(path => x.map(signal => {
    const p = new Float64Array(nSamples + pad); p.set(convolve(signal, path), pad); return p;
  })));
  const weights = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => new Float64Array(taps)));
  const blank = () => Array.from({ length: 4 }, () => new Float64Array(nSamples));
  const u = blank(), a = blank(), e = blank();
  for (let n = 0; n < nSamples; n++) {
    const end = n + pad;
    for (let l = 0; l < 4; l++) {
      let drive = 0;
      for (let k = 0; k < 4; k++) {
        const w = weights[l][k], input = paddedX[k];
        for (let j = 0; j < taps; j++) drive += w[j] * input[end - j];
      }
      if (!Number.isFinite(drive) || Math.abs(drive) > 10) throw new EngineError('NUMERIC_FAILURE', `输出越界，样本 ${n}`, runId);
      u[l][n] = drive;
    }
    for (let m = 0; m < 4; m++) {
      let anti = 0;
      for (let l = 0; l < 4; l++) for (let j = 0; j < 16 && j <= n; j++) anti += secondary[m][l][j] * u[l][n - j];
      a[m][n] = anti;
      e[m][n] = d[m][n] + anti;
    }
    // e = d + a -> negative gradient; new weights apply only at the next sample.
    if (n >= 4000 && config.stepSize !== 0) {
      for (let l = 0; l < 4; l++) for (let k = 0; k < 4; k++) {
        const w = weights[l][k];
        const f0 = filtered[0][l][k], f1 = filtered[1][l][k], f2 = filtered[2][l][k], f3 = filtered[3][l][k];
        const e0 = e[0][n], e1 = e[1][n], e2 = e[2][n], e3 = e[3][n];
        for (let j = 0; j < taps; j++) {
          const i = end - j;
          w[j] -= config.stepSize / 4 * (e0 * f0[i] + e1 * f1[i] + e2 * f2[i] + e3 * f3[i]);
        }
      }
    }
  }
  const signals = Object.fromEntries(Object.entries({ x, u, d, a, e }).map(([key, value]) => [key,
    value.map(channel => Float32Array.from(channel)) as unknown as Four<Float32Array>,
  ])) as RunResult['signals'];
  for (const channels of Object.values(signals)) for (const channel of channels) {
    if (channel.length !== nSamples || !channel.every(Number.isFinite)) throw new EngineError('NUMERIC_FAILURE', '结果长度或数值错误', runId);
  }
  return { runId, source: 'computed-browser', config: { ...config }, sampleCount: 32000, order: ORDER,
    units: { x: 'm/s2', u: 'drive', d: 'Pa', a: 'Pa', e: 'Pa' }, signals,
    metrics: steadyMetrics(signals), computeMilliseconds: performance.now() - started };
}
