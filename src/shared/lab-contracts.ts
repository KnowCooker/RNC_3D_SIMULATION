/** Expanded teaching lab. Kept separate from the immutable demo-v2 fixture contract. */
import type { Four, SignalKind } from './contracts';

export type VehicleKind = 'ice' | 'bev' | 'hev' | 'erev';
export type Vec3 = readonly [number, number, number];
export interface ReferenceSensor { id: string; name: string; position: Vec3; /** Visual attachment only; position remains an unexpanded physical coordinate. */ mountPart?: string }
export interface LabConfig {
  schemaVersion: 'lab-v3';
  vehicle: VehicleKind;
  sampleRateHz: 2000;
  durationSeconds: 16;
  adaptationStartsSeconds: 2;
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
/** Sequential new samples from a persistent processor; never a repeated prerecorded segment. */
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
export function defaultLabConfig(): LabConfig {
  return { schemaVersion: 'lab-v3', vehicle: 'bev', sampleRateHz: 2000, durationSeconds: 16,
    adaptationStartsSeconds: 2, seed: 11, taps: 64, stepSize: 0.08, rncEnabled: true,
    speedKph: 60, roadRoughness: 1, treadRoughness: 1, pressureKpa: 240, temperatureC: 20,
    references: SOURCE_POSITIONS.map(([x, , z], i) => ({ id: `ref-${i + 1}`, name: `REF ${['FL', 'FR', 'RL', 'RR'][i]}`, position: [x * 0.85, 0.67, z] })),
    speakerEnabled: [true, true, true, true] };
}
