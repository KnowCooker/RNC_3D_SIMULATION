/** Fixed 4-reference, 4-output, 4-error teaching demo contract. */
export type Four<T> = readonly [T, T, T, T];
export const ORDER = ['fl', 'fr', 'rl', 'rr'] as const;
export type Corner = typeof ORDER[number];
export type SignalKind = 'x' | 'u' | 'd' | 'a' | 'e';
export interface RunConfig {
  schemaVersion: 'demo-v2';
  vehicleId: 'teaching-bev-rwd';
  pathProfileId: 'synthetic-4x4x4-v1';
  algorithm: 'fxlms';
  sampleRateHz: 2000;
  durationSeconds: 16;
  adaptationStartsSeconds: 2;
  road: 'asphalt';
  speedKph: 60;
  seed: 11 | 29 | 47;
  taps: 32 | 64;
  stepSize: 0 | 0.08;
}
export interface SteadyMetrics {
  startSeconds: 12;
  endSeconds: 16;
  measurement: 'unweighted-full-sampled-band';
  reductionDbByMic: Four<number>;
  aggregateReductionDb: number;
}
export interface RunResult {
  runId: string;
  source: 'computed-browser' | 'reference-replay';
  config: RunConfig;
  sampleCount: 32000;
  order: typeof ORDER;
  units: { x: 'm/s2'; u: 'drive'; d: 'Pa'; a: 'Pa'; e: 'Pa' };
  signals: Record<SignalKind, Four<Float32Array>>;
  metrics: SteadyMetrics;
  computeMilliseconds: number | null;
}
export interface AnalysisFrame {
  runId: string;
  endSampleExclusive: number;
  valid: boolean;
  reason: 'ok' | 'warming-up' | 'below-floor';
  microphones: Four<{
    primaryRmsPa: number | null;
    residualRmsPa: number | null;
    reductionDb: number | null;
  }>;
  spectrum: {
    signal: SignalKind;
    channel: Corner;
    fftSize: 1024;
    window: 'hann';
    binHz: number;
    /** One-sided PSD, squared signal unit per Hz; 513 bins. */
    psd: Float32Array;
  } | null;
}
export interface DemoEngine {
  calculate(config: RunConfig, runId: string): Promise<RunResult>;
  analyzeAt(result: RunResult, endSampleExclusive: number,
    selected: { signal: SignalKind; channel: Corner }): AnalysisFrame;
}
export interface DemoError {
  code: 'INVALID_CONFIG' | 'NUMERIC_FAILURE' | 'BUSY' | 'CANCELLED';
  message: string;
  runId: string;
}
