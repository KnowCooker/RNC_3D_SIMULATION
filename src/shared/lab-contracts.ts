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
export interface LabDivergence { sample: number; message: string }
export interface LabAnalysisOptions { spectrumWeighting?: AcousticWeighting; levelWeighting?: AcousticWeighting; /** Local result time; clamped to available history and current cursor. */ waveformStartSeconds?: number; /** Skip FFTs when collecting convergence history. */ levelsOnly?: boolean }
export type Vec3 = readonly [number, number, number];
export interface ReferenceSensor { id: string; name: string; position: Vec3; /** Visual attachment only; position remains an unexpanded physical coordinate. */ mountPart?: string }
/** Existing fixed source/mic/speaker coordinates. It is not a registered showroom-asset layout. */
export const TEACHING_LAYOUT_ID = 'teaching-fixed-v1';
export interface LabConfig {
  schemaVersion: 'lab-v3';
  /** Missing in legacy lab-v3 runs means TEACHING_LAYOUT_ID. Registered P7+ uses the same layout in geometry and B paths. */
  layoutId?: string;
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
  divergence?: LabDivergence;
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
  divergence?: LabDivergence;
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
export type LabPathKind = 'H' | 'S' | 'Shat';
export interface LabPathSelection { kind: LabPathKind; input: number; output: number }
/** Responses of the actual causal FIR used by the model; phase singularities are null. */
export interface LabPathAnalysis {
  impulse: Float64Array; frequencyHz: number[]; magnitudeDb: (number | null)[];
  phaseDegrees: (number | null)[]; groupDelayMs: (number | null)[]; sampleRateHz: number;
}
export interface LabAnalysis {
  spectrumWeighting?: AcousticWeighting;
  levelWeighting?: AcousticWeighting;
  time: number;
  valid: boolean;
  primarySpl: Four<number | null>;
  residualSpl: Four<number | null>;
  reductionDb: Four<number | null>;
  waveform: Float32Array;
  spectrum: Float32Array | Float64Array | null;
  /** B-computed density level: pressure re (20 µPa)^2/Hz; other signals re 1 unit^2/Hz. */
  spectrumDb: Float32Array | null;
  unit: string;
}
export interface FieldFrame {
  /** Worker-stamped physical layout identity; direct legacy B samples may omit it. */
  layoutId?: string;
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
export function labLayoutId(config: Pick<LabConfig, 'layoutId'>): string {
  return config.layoutId === undefined ? TEACHING_LAYOUT_ID : config.layoutId;
}
/** Reject unknown layouts and unsupported powertrains before computing any paths. */
export function supportedLabLayoutId(config: Pick<LabConfig, 'layoutId'> & Partial<Pick<LabConfig, 'vehicle'>>): string {
  const id = labLayoutId(config);
  const registered = registeredVehicleLayout(id);
  if (registered && registered.id === id) {
    if (config.vehicle !== undefined && config.vehicle !== registered.vehicle) throw new Error(`${registered.name} 当前布局仅支持 ${registered.vehicle==='bev'?'纯电':'增程'}版本`);
    return id;
  }
  if (id !== TEACHING_LAYOUT_ID) throw new Error(`物理布局 ${String(id)} 尚未接入声学路径和声场，不能运行实验`);
  return TEACHING_LAYOUT_ID;
}
/** Conservative 256MiB working budget: worker arrays, transfers, weighted signals
 * and all eight cached 16kHz playback buffers. It is not a browser RAM probe. */
export function labDurationLimit(config: Pick<LabConfig, 'references' | 'taps'>): number {
  const refs = config.references.length;
  const bytesPerSample = 3 * (20 + refs) * 4 + (16 * refs + refs) * 8 + 8 * 4 + 8 * 8 * 4;
  const reserved = 16 * refs * (config.taps + 512) * 8 + 16 * 1024 * 1024;
  return Math.min(300, Math.floor((256 * 1024 * 1024 - reserved) / (2000 * bytesPerSample)));
}
export function defaultLabConfig(): LabConfig {
  return { schemaVersion: 'lab-v3', layoutId: TEACHING_LAYOUT_ID, vehicle: 'bev', sampleRateHz: 2000, durationSeconds: 16,
    adaptationStartsSeconds: 0, seed: 11, taps: 64, stepSize: 0.08, rncEnabled: true,
    speedKph: 60, roadRoughness: 1, treadRoughness: 1, pressureKpa: 240, temperatureC: 20,
    references: SOURCE_POSITIONS.map(([x, , z], i) => ({ id: `ref-${i + 1}`, name: `REF ${['FL', 'FR', 'RL', 'RR'][i]}`, position: [x * 0.85, 0.67, z] })),
    speakerEnabled: [true, true, true, true] };
}

/** Photo-dimension-constrained P7+ BEV experimental layout. Not OEM measured acoustic data.
 * +X left, +Y up, +Z forward; wheelbase 3 m. All positions are assembled metres. */
export const P7_LAYOUT_ID = 'xpeng-p7plus-bev-v1';
export interface LabLayout {
  microphones: Four<Vec3>; speakers: Four<Vec3>; sources: Four<Vec3>;
  floor: number; roof: number;
}
const P7_LAYOUT: LabLayout = {
  microphones: [[.465,1.20,.20],[-.465,1.20,.20],[.49,1.19,-1.0],[-.49,1.19,-1.0]],
  speakers: [[.84,.72,.58],[-.84,.72,.58],[.85,.72,-.65],[-.85,.72,-.65]],
  sources: [[.831,.10,1.5],[-.831,.10,1.5],[.831,.10,-1.5],[-.831,.10,-1.5]],
  floor: .405, roof: 1.43,
};
export function labLayout(config: Pick<LabConfig,'layoutId'> & Partial<Pick<LabConfig,'vehicle'>>): LabLayout {
  const id = supportedLabLayoutId(config);
  return registeredVehicleLayout(id)?.layout ?? { microphones: MIC_POSITIONS, speakers: SPEAKER_POSITIONS, sources: SOURCE_POSITIONS, floor: .55, roof: 1.9 };
}
export function defaultP7Config(): LabConfig {
  return { ...defaultLabConfig(), layoutId: P7_LAYOUT_ID, vehicle: 'bev', references: P7_LAYOUT.sources.map(([x,,z],i) => ({
    id: `ref-${i+1}`, name: `REF ${['FL','FR','RL','RR'][i]}`, position: [x*.82,.59,z], mountPart: `suspension-${i<2?1:-1}`,
  })) };
}

/** Dimension-constrained authored layouts, NOT measured XPeng transfer functions.
 * Four controlled positions are first/second-row left/right. Third rows remain
 * queryable field locations; they are not extra error microphones/controllers. */
export interface RegisteredVehicleLayout {
  id: string; assetId: string; name: string; vehicle: VehicleKind; layout: LabLayout;
  seatZ: readonly number[]; secondRowSeats: 2 | 3;
}
function fourWheelLayout(width:number,wheelbase:number,roof:number,frontSeat:number,rearSeat:number,frontSpeaker:number,rearSpeaker:number):LabLayout {
  const x=width/2-.115, sx=width/2-.15;
  return {sources:[[x,.1,wheelbase/2],[-x,.1,wheelbase/2],[x,.1,-wheelbase/2],[-x,.1,-wheelbase/2]],
    microphones:[[.48,1.24,frontSeat-.14],[-.48,1.24,frontSeat-.14],[.48,1.24,rearSeat-.14],[-.48,1.24,rearSeat-.14]],
    speakers:[[sx,.65,frontSpeaker],[-sx,.65,frontSpeaker],[sx,.65,rearSpeaker],[-sx,.65,rearSpeaker]],floor:.405,roof};
}
export const XPENG_LAB_LAYOUTS: readonly RegisteredVehicleLayout[] = [
  {id:P7_LAYOUT_ID,assetId:'xpeng-p7plus',name:'小鹏 P7+',vehicle:'bev',layout:P7_LAYOUT,seatZ:[.39,-.82],secondRowSeats:3},
  {id:'xpeng-x9-erev-v1',assetId:'xpeng-x9',name:'小鹏 X9',vehicle:'erev',layout:fourWheelLayout(1.988,3.160,1.70,.83,-.43,.915,-.505),seatZ:[.83,-.43,-1.52],secondRowSeats:2},
  {id:'xpeng-l03-bev-v1',assetId:'xpeng-l03',name:'小鹏 MONA L03',vehicle:'bev',layout:fourWheelLayout(1.920,2.850,1.52,.45,-.72,.48,-.635),seatZ:[.45,-.72],secondRowSeats:3},
  {id:'xpeng-m03-bev-v1',assetId:'xpeng-m03',name:'小鹏 MONA M03',vehicle:'bev',layout:fourWheelLayout(1.896,2.815,1.36,.45,-.72,.50,-.61),seatZ:[.45,-.72],secondRowSeats:3},
  {id:'xpeng-gx-erev-v1',assetId:'xpeng-gx',name:'小鹏 GX',vehicle:'erev',layout:fourWheelLayout(1.999,3.115,1.72,.66,-.48,.605,-.60),seatZ:[.66,-.48,-1.50],secondRowSeats:2},
];
export function registeredVehicleLayout(id: string | undefined) { return XPENG_LAB_LAYOUTS.find(row=>row.id===id || row.assetId===id); }
export function defaultXPengConfig(assetId: string): LabConfig {
  const row=registeredVehicleLayout(assetId);if(!row)throw new Error(`未注册车型 ${assetId}`);
  if(row.id===P7_LAYOUT_ID)return defaultP7Config();
  return {...defaultLabConfig(),layoutId:row.id,vehicle:row.vehicle,references:row.layout.sources.map(([x,,z],i)=>({id:`ref-${i+1}`,name:`REF ${['FL','FR','RL','RR'][i]}`,position:[x*.82,.59,z],mountPart:`suspension-${i<2?1:-1}`}))};
}
