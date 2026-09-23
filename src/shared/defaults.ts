import type { Corner, RunConfig } from './contracts';

export const DEFAULT_CONFIG: RunConfig = Object.freeze({
  schemaVersion: 'demo-v2', vehicleId: 'teaching-bev-rwd',
  pathProfileId: 'synthetic-4x4x4-v1', algorithm: 'fxlms',
  sampleRateHz: 2000, durationSeconds: 16, adaptationStartsSeconds: 2,
  road: 'asphalt', speedKph: 60, seed: 11, taps: 64, stepSize: 0.08,
});
export const CORNER_NAMES: Record<Corner, string> = {
  fl: '前左 / 驾驶位', fr: '前右', rl: '后左', rr: '后右',
};
