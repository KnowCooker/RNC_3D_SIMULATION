import type { Four } from '../../shared/contracts';
import type { LabConfig, ReferenceSensor } from '../../shared/lab-contracts';
import { compareCases, type CaseComparison, type CaseSnapshot } from './case-compare';

export const CASE_EVIDENCE_FORMAT = 'rnc-case-v1';
export const CASE_EVIDENCE_MAX_BYTES = 64 * 1024;
export const CASE_EVIDENCE_BOUNDARY = '教学仿真摘要：A计权、0–1 kHz、末尾0.5秒；实录声源为未校准V的四轮等效输入，空间路径和声压为教学模型。文件不含原始信号、音频或模型版本哈希，不是实车测量或方案认证。';

export interface CaseEvidence {
  format: typeof CASE_EVIDENCE_FORMAT;
  createdAt: string;
  question: string;
  observation: string;
  interpretation: string;
  decision: string;
  nextCheck: string;
  boundary: typeof CASE_EVIDENCE_BOUNDARY;
  baseline: CaseSnapshot;
  candidate: CaseSnapshot;
}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('案例格式错误：需要对象');
  return value as Record<string, unknown>;
};
const string = (value: unknown, label: string, max: number, allowEmpty = false): string => {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) throw new Error(`案例格式错误：${label}`);
  return value;
};
const number = (value: unknown, label: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`案例格式错误：${label}`);
  return value;
};
const integer = (value: unknown, label: string, min: number, max: number): number => {
  const parsed = number(value, label, min, max);
  if (!Number.isInteger(parsed)) throw new Error(`案例格式错误：${label}`);
  return parsed;
};
const boolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`案例格式错误：${label}`);
  return value;
};
const list = (value: unknown, label: string, length: number): unknown[] => {
  if (!Array.isArray(value) || value.length !== length) throw new Error(`案例格式错误：${label}`);
  return value;
};
const levels = (value: unknown, label: string): Four<number | null> =>
  list(value, label, 4).map((item, i) => item === null ? null : number(item, `${label}[${i}]`, -200, 200)) as unknown as Four<number | null>;

function config(value: unknown): LabConfig {
  const c = object(value);
  if (c.schemaVersion !== 'lab-v3' || c.sampleRateHz !== 2000) throw new Error('案例协议或采样率不受支持');
  if (!['ice', 'bev', 'hev', 'erev'].includes(String(c.vehicle))) throw new Error('案例车型不受支持');
  if (c.sourceMode !== undefined && !['recorded-noise', 'shaped-noise'].includes(String(c.sourceMode))) throw new Error('案例声源不受支持');
  const references = c.references;
  if (!Array.isArray(references) || references.length < 1 || references.length > 8) throw new Error('案例参考传感器数量无效');
  const normalizedReferences = references.map((value, i): ReferenceSensor => {
    const ref = object(value);
    const position = list(ref.position, `参考传感器${i + 1}位置`, 3);
    const mountPart = ref.mountPart === undefined ? undefined : string(ref.mountPart, '安装部件', 80);
    return { id: string(ref.id, '参考传感器ID', 80), name: string(ref.name, '参考传感器名称', 80),
      position: position.map((coordinate, axis) => number(coordinate, `参考传感器${i + 1}坐标${axis}`, -10, 10)) as unknown as ReferenceSensor['position'],
      ...(mountPart === undefined ? {} : { mountPart }) };
  });
  const speakers = list(c.speakerEnabled, '扬声器启禁', 4).map((item, i) => boolean(item, `扬声器${i + 1}`)) as unknown as Four<boolean>;
  const adaptation = number(c.adaptationStartsSeconds, '学习起点', 0, 2);
  if (adaptation !== 0 && adaptation !== 2) throw new Error('案例学习起点无效');
  return {
    schemaVersion: 'lab-v3', sampleRateHz: 2000,
    vehicle: c.vehicle as LabConfig['vehicle'],
    ...(c.sourceMode === undefined ? {} : { sourceMode: c.sourceMode as LabConfig['sourceMode'] }),
    durationSeconds: integer(c.durationSeconds, '时长', 1, 300),
    ...(c.levelOffsetDb === undefined ? {} : { levelOffsetDb: number(c.levelOffsetDb, '教学声压修正', -12, 12) }),
    adaptationStartsSeconds: adaptation,
    seed: integer(c.seed, '随机种子', -2147483648, 2147483647),
    taps: integer(c.taps, '系数数', 16, 128),
    stepSize: number(c.stepSize, '步长', 0, 0.5),
    rncEnabled: boolean(c.rncEnabled, 'RNC状态'),
    speedKph: number(c.speedKph, '车速', 0, 300),
    roadRoughness: number(c.roadRoughness, '路面粗糙度', 0, 5),
    treadRoughness: number(c.treadRoughness, '胎面粗糙度', 0, 5),
    pressureKpa: number(c.pressureKpa, '胎压', 0, 1000),
    temperatureC: number(c.temperatureC, '温度', -100, 100),
    references: normalizedReferences, speakerEnabled: speakers,
  };
}

function snapshot(value: unknown, label: string): CaseSnapshot {
  const s = object(value);
  const parsedConfig = config(s.config);
  const windowEndSeconds = number(s.windowEndSeconds, `${label}窗口`, 0.5, 300);
  if (Math.abs(windowEndSeconds - parsedConfig.durationSeconds) > 1 / parsedConfig.sampleRateHz) throw new Error(`案例${label}窗口与时长不一致`);
  return { runId: string(s.runId, `${label}实验ID`, 120), config: parsedConfig, windowEndSeconds,
    primarySpl: levels(s.primarySpl, `${label}原声`), residualSpl: levels(s.residualSpl, `${label}残余`),
    reductionDb: levels(s.reductionDb, `${label}改善`) };
}

/** Imported records are summaries supplied by the file author, never executable runs. */
export function parseCaseEvidence(json: string): { evidence: CaseEvidence; comparison: CaseComparison } {
  if (new TextEncoder().encode(json).byteLength > CASE_EVIDENCE_MAX_BYTES) throw new Error('案例文件超过64 KiB');
  let raw: Record<string, unknown>;
  try { raw = object(JSON.parse(json) as unknown); } catch { throw new Error('案例不是有效JSON对象'); }
  if (raw.format !== CASE_EVIDENCE_FORMAT) throw new Error('案例版本不受支持');
  if (raw.boundary !== CASE_EVIDENCE_BOUNDARY) throw new Error('案例来源边界不完整');
  const createdAt = string(raw.createdAt, '创建时间', 40);
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('案例创建时间无效');
  const baseline = snapshot(raw.baseline, 'A'), candidate = snapshot(raw.candidate, 'B');
  if (baseline.runId === candidate.runId) throw new Error('案例A/B实验ID相同');
  const evidence: CaseEvidence = { format: CASE_EVIDENCE_FORMAT, createdAt,
    question: string(raw.question, '问题', 240), observation: string(raw.observation, '观察', 1000, true),
    interpretation: raw.interpretation === undefined ? '' : string(raw.interpretation, '人工解释', 1000, true),
    decision: raw.decision === undefined ? '' : string(raw.decision, '临时行动', 1000, true),
    nextCheck: string(raw.nextCheck, '后续核查', 1000, true), boundary: CASE_EVIDENCE_BOUNDARY,
    baseline, candidate };
  return { evidence, comparison: compareCases(baseline, candidate) };
}

export function createCaseEvidence(baseline: CaseSnapshot, candidate: CaseSnapshot, observation: string, nextCheck: string, createdAt = new Date().toISOString(), interpretation = '', decision = ''): string {
  const record: CaseEvidence = { format: CASE_EVIDENCE_FORMAT, createdAt, question: '改变一个条件后，后排会更安静吗？',
    observation: observation.trim(), interpretation: interpretation.trim(), decision: decision.trim(), nextCheck: nextCheck.trim(), boundary: CASE_EVIDENCE_BOUNDARY,
    baseline: structuredClone(baseline), candidate: structuredClone(candidate) };
  const json = JSON.stringify(record, null, 2);
  parseCaseEvidence(json);
  return json;
}
