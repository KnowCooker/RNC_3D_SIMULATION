/** Expanded teaching lab. Kept separate from the immutable demo-v2 fixture contract. */
import type { Four, SignalKind } from './contracts';

export type VehicleKind = 'ice' | 'bev' | 'hev' | 'erev';
export type AcousticWeighting = 'A' | 'Z';
/** Internal ceiling on generated simulation time; pauses do not consume it. No UI setting. */
export const LAB_LIVE_LIMIT_SECONDS = 600;
export const LAB_WAVEFORM_SECONDS = 5;
/** Five seconds at the audio clock plus producer prefetch and causal pre-roll. */
export const LAB_LIVE_HISTORY_SAMPLES = 16384;
export interface LabRncChange { enabled: boolean; effectiveSample: number }
export interface LabAnalysisOptions { spectrumWeighting?: AcousticWeighting; levelWeighting?: AcousticWeighting; /** Skip FFTs when collecting convergence history. */ levelsOnly?: boolean }
export type Vec3 = readonly [number, number, number];
export interface ReferenceSensor { id: string; name: string; position: Vec3; /** Visual attachment only; position remains an unexpanded physical coordinate. */ mountPart?: string }
export interface LabConfig {
  schemaVersion: 'lab-v3';
  /** Omitted in saved runs: retain the original shaped-random source. */
  sourceMode?: 'recorded-noise' | 'shaped-noise';
  vehicle: VehicleKind;
  sampleRateHz: 2000;
  /** Precomputed replay length only. Continuous simulation ignores this field. */
  durationSeconds: number;
  /** Relative to the declared teaching pressure calibration; not a DSP V/Pa sensitivity. */
  levelOffsetDb?: number;
  /** New experiments learn immediately; 2 retains compatibility with saved lab-v3 runs. */
  adaptationStartsSeconds: 0 | 2;
  seed: number;
  taps: number;
  stepSize: number;
  rncEnabled: boolean;
  speedKph: number;
  roadRoughness: number;
  treadRoughness: number;
  pressureKpa: number;
  temperatureC: number;
  references: ReferenceSensor[];
  speakerEnabled: Four<boolean>;
}
export interface LabResult {
  runId: string;
  config: LabConfig;
  sampleCount: number;
  computeMilliseconds: number;
  sources: Four<Float32Array>;
  signals: { x: Float32Array[]; u: Four<Float32Array>; d: Four<Float32Array>; a: Four<Float32Array>; e: Four<Float32Array> };
  metrics: { reductionDbByMic: Four<number>; aggregateReductionDb: number };
}
/** Sequential processed samples. Recorded-source loops never reset the controller or clock. */
export interface LabChunk {
  runId: string;
  startSample: number;
  sampleCount: number;
  sources: Four<Float32Array>;
  signals: LabResult['signals'];
}
/** Chronological bounded history. Result indices are local; bounds are absolute sample indices. */
export interface LabLiveSnapshot {
  startSample: number;
  endSample: number;
  result: LabResult;
}
export interface LabLivePacket { chunk: LabChunk; snapshot: LabLiveSnapshot }
export interface LabSelection { signal: SignalKind | 'q'; channel: number }
export interface LabAnalysis {
  spectrumWeighting?: AcousticWeighting;
  levelWeighting?: AcousticWeighting;
  time: number;
  valid: boolean;
  primarySpl: Four<number | null>;
  residualSpl: Four<number | null>;
  reductionDb: Four<number | null>;
  waveform: Float32Array;
  spectrum: Float32Array | null;
  unit: string;
}
export interface FieldFrame {
  weighting?: AcousticWeighting;
  time: number;
  valid: boolean;
  points: Vec3[];
  primarySpl: Float32Array;
  residualSpl: Float32Array;
  reductionDb: Float32Array;
}
export const VEHICLE_NAMES: Record<VehicleKind, string> = {
  ice: '纯燃油 SUV', bev: '纯电 SUV', hev: '混合动力 SUV', erev: '增程 SUV',
};
export const MIC_POSITIONS: Four<Vec3> = [[0.48, 1.65, 0.4], [-0.48, 1.65, 0.4], [0.48, 1.65, -1.01], [-0.48, 1.65, -1.01]];
export const SPEAKER_POSITIONS: Four<Vec3> = [[0.96, 1.1, 0.65], [-0.96, 1.1, 0.65], [0.96, 1.1, -0.75], [-0.96, 1.1, -0.75]];
export const SOURCE_POSITIONS: Four<Vec3> = [[1, 0.1, 1.45], [-1, 0.1, 1.45], [1, 0.1, -1.45], [-1, 0.1, -1.45]];
/** Conservative 256MiB working budget: worker arrays, transfers, weighted signals
 * and all eight cached 16kHz playback buffers. It is not a browser RAM probe. */
export function labDurationLimit(config: Pick<LabConfig, 'references' | 'taps'>): number {
  const refs = config.references.length;
  const bytesPerSample = 3 * (20 + refs) * 4 + (16 * refs + refs) * 8 + 8 * 4 + 8 * 8 * 4;
  const reserved = 16 * refs * (config.taps + 512) * 8 + 16 * 1024 * 1024;
  return Math.min(300, Math.floor((256 * 1024 * 1024 - reserved) / (2000 * bytesPerSample)));
}
export function defaultLabConfig(): LabConfig {
  return { schemaVersion: 'lab-v3', vehicle: 'bev', sampleRateHz: 2000, durationSeconds: 16,
    adaptationStartsSeconds: 0, seed: 11, taps: 64, stepSize: 0.08, rncEnabled: true,
    speedKph: 60, roadRoughness: 1, treadRoughness: 1, pressureKpa: 240, temperatureC: 20,
    references: SOURCE_POSITIONS.map(([x, , z], i) => ({ id: `ref-${i + 1}`, name: `REF ${['FL', 'FR', 'RL', 'RR'][i]}`, position: [x * 0.85, 0.67, z] })),
    speakerEnabled: [true, true, true, true] };
}
