import { labLayoutId, supportedLabLayoutId } from '../../shared/lab-contracts';
import { compareCases, comparisonLabel, type ComparisonPolicy, type CaseSnapshot } from './case-compare';

export interface CaseReview {
  facts: string[];
  limits: string[];
}

const reading = (value: number | null): string => value === null ? '无有效读数' : `${Math.abs(value) < 0.05 ? 0 : value > 0 ? '+' : ''}${(Math.abs(value) < 0.05 ? 0 : value).toFixed(1)} dB`;

/** Report computed facts and limits only; interpretation and a decision belong to a person. */
export function reviewCase(baseline: CaseSnapshot, candidate: CaseSnapshot, mode: ComparisonPolicy = 'legacy'): CaseReview {
  const comparison = compareCases(baseline, candidate, mode);
  const facts = [
    `比较目的：${comparisonLabel(mode)}。`,
    `车型 A ${baseline.config.vehicle} / B ${candidate.config.vehicle}；实验 A ${baseline.runId.slice(0, 8)} / B ${candidate.runId.slice(0, 8)}。`,
    `物理布局 A ${labLayoutId(baseline.config)} / B ${labLayoutId(candidate.config)}。`,
    `A 末尾 ${baseline.windowEndSeconds.toFixed(1)} s、B 末尾 ${candidate.windowEndSeconds.toFixed(1)} s，各取 0.5 秒窗口，A 计权、0–1 kHz。`,
  ];
  const limits = ['数值来自未实车标定的教学模型；案例摘要不含原始信号，不能用于实车认证。'];
  if (mode !== 'control') limits.unshift('这是工况结果差异，不能解释为 ANC 控制方案的净收益。');
  try { supportedLabLayoutId(baseline.config); supportedLabLayoutId(candidate.config); } catch {
    limits.unshift('文件包含当前版本未接入的物理布局；座位读数仅为文件自报，不支持复算或 A/B 比较。');
  }
  if (!comparison.comparable) {
    limits.unshift(`可比条件不一致：${comparison.conditions.join('、')}。不计算或解释 A/B 差值。`);
    return { facts, limits };
  }
  if (comparison.changes.length === 1) facts.push(`配置唯一变更：${comparison.changes[0]}。`);
  else if (comparison.changes.length > 1) {
    facts.push(`配置改变 ${comparison.changes.length} 项：${comparison.changes.join('、')}。`);
    limits.unshift('多项变量同时改变，不能把结果归因于其中一项；需控制变量补测。');
  } else {
    facts.push('A/B 配置相同，属于重复运行。');
    limits.unshift('没有方案变更，不能据此评价变更效果。');
  }
  facts.push(`后排残余 B−A：左后座 ${reading(comparison.residualDeltaDb[2])}，右后座 ${reading(comparison.residualDeltaDb[3])}；正值表示候选更吵。`);
  if (comparison.residualDeltaDb[2] === null || comparison.residualDeltaDb[3] === null) limits.unshift('后排存在无效读数，不能评价后排整体变化。');
  return { facts, limits };
}
