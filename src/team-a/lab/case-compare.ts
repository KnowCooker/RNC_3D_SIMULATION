import type { Four } from '../../shared/contracts';
import { labLayoutId, supportedLabLayoutId, TEACHING_LAYOUT_ID, type LabAnalysis, type LabConfig, type LabResult } from '../../shared/lab-contracts';

/** A small evidence snapshot, not a copy of the audio buffers or a calibrated vehicle test. */
export interface CaseSnapshot {
  runId: string;
  config: LabConfig;
  windowEndSeconds: number;
  primarySpl: Four<number | null>;
  residualSpl: Four<number | null>;
  reductionDb: Four<number | null>;
}

export interface CaseComparison {
  comparable: boolean;
  conditions: string[];
  changes: string[];
  primaryDeltaDb: Four<number | null>;
  residualDeltaDb: Four<number | null>;
  reductionDeltaDb: Four<number | null>;
}

const clean = (value: number | null): number | null => value !== null && Number.isFinite(value) ? value : null;
const four = <T, U>(input: Four<T>, map: (value: T, index: number) => U): Four<U> =>
  [map(input[0], 0), map(input[1], 1), map(input[2], 2), map(input[3], 3)];

export function captureCase(result: LabResult, analysis: LabAnalysis): CaseSnapshot {
  if (result.divergence) throw new Error('发散实验不能保存为完整比较案例');
  if (analysis.levelWeighting !== 'A' || analysis.time < 0.5 || !analysis.valid) throw new Error('基线需要有效的末尾0.5秒A计权窗口');
  return {
    runId: result.runId,
    config: { ...structuredClone(result.config), layoutId: supportedLabLayoutId(result.config) },
    windowEndSeconds: analysis.time,
    primarySpl: four(analysis.primarySpl, clean),
    residualSpl: four(analysis.residualSpl, clean),
    reductionDb: four(analysis.reductionDb, clean),
  };
}

export function compareCases(base: CaseSnapshot, candidate: CaseSnapshot): CaseComparison {
  const a = base.config, b = candidate.config;
  const conditions: string[] = [];
  const check = (matches: boolean, label: string) => { if (!matches) conditions.push(label); };
  check(a.schemaVersion === b.schemaVersion && a.sampleRateHz === b.sampleRateHz, '计算协议/采样率');
  check(labLayoutId(a) === labLayoutId(b) && labLayoutId(a) === TEACHING_LAYOUT_ID, '物理布局身份');
  check(a.vehicle === b.vehicle, '车型');
  check((a.sourceMode ?? 'shaped-noise') === (b.sourceMode ?? 'shaped-noise'), '声源素材');
  check(a.seed === b.seed, '声源种子');
  check(a.durationSeconds === b.durationSeconds && a.sampleRateHz * base.windowEndSeconds === b.sampleRateHz * candidate.windowEndSeconds, '采样时长/末尾时间窗');
  check(a.adaptationStartsSeconds === b.adaptationStartsSeconds, '学习起点');
  check(a.speedKph === b.speedKph, '车速');
  check(a.treadRoughness === b.treadRoughness && a.pressureKpa === b.pressureKpa && a.temperatureC === b.temperatureC, '轮胎/环境工况');
  check((a.levelOffsetDb ?? 0) === (b.levelOffsetDb ?? 0), '教学声压修正');

  const changes: string[] = [];
  if (a.roadRoughness !== b.roadRoughness) changes.push(`路面粗糙度 ${a.roadRoughness.toFixed(1)} → ${b.roadRoughness.toFixed(1)}`);
  if (a.taps !== b.taps) changes.push(`系数数 ${a.taps} → ${b.taps}`);
  if (a.stepSize !== b.stepSize) changes.push(`步长 ${a.stepSize} → ${b.stepSize}`);
  if (a.rncEnabled !== b.rncEnabled) changes.push(`RNC ${a.rncEnabled ? '开' : '关'} → ${b.rncEnabled ? '开' : '关'}`);
  if (JSON.stringify(a.references) !== JSON.stringify(b.references)) changes.push('参考传感器布置');
  if (JSON.stringify(a.speakerEnabled) !== JSON.stringify(b.speakerEnabled)) changes.push('扬声器启禁');
  const delta = (left: Four<number | null>, right: Four<number | null>): Four<number | null> =>
    four(left, (value, i) => conditions.length || value === null || right[i] === null ? null : right[i]! - value);
  return {
    comparable: conditions.length === 0,
    conditions,
    changes,
    primaryDeltaDb: delta(base.primarySpl, candidate.primarySpl),
    residualDeltaDb: delta(base.residualSpl, candidate.residualSpl),
    reductionDeltaDb: delta(base.reductionDb, candidate.reductionDb),
  };
}
