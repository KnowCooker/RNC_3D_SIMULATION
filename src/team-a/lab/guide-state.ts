import type { FieldFrame, LabConfig } from '../../shared/lab-contracts';
import { compareCases, type CaseSnapshot } from './case-compare';

export type GuideStage = 'mode' | 'baseline-run' | 'baseline-save' | 'road' | 'candidate-run' | 'repair' | 'field' | 'listen' | 'review';

export interface GuideInput {
  realtime: boolean;
  busy: boolean;
  config: LabConfig;
  currentRunId: string | null;
  currentValid: boolean;
  baseline: CaseSnapshot | null;
  candidate: CaseSnapshot | null;
  candidateFieldReady: boolean;
  heardOriginal: boolean;
  heardResidual: boolean;
}

export interface GuideState {
  stage: GuideStage;
  index: number;
  title: string;
  detail: string;
  action: string;
  blocked: boolean;
}

/** The guided spatial observation must end at the same sample as the A/B seat summary. */
export function isFieldAtComparisonWindow(field: Pick<FieldFrame, 'valid' | 'time' | 'weighting'>, mode: string, sampleCount: number, sampleRateHz: number): boolean {
  if (mode !== 'residual' || field.weighting !== 'A' || !field.valid || !Number.isFinite(field.time) || !Number.isInteger(sampleCount) || sampleCount <= 0 || !Number.isFinite(sampleRateHz) || sampleRateHz <= 0) return false;
  return Math.abs(field.time - sampleCount / sampleRateHz) <= 1 / sampleRateHz + Number.EPSILON;
}

/** Guidance follows recorded experiments; a button press alone never advances evidence. */
export function guideState(input: GuideInput): GuideState {
  const step = (stage: GuideStage, index: number, title: string, detail: string, action: string, blocked = false): GuideState =>
    ({ stage, index, title, detail, action, blocked });
  if (input.realtime) return step('mode', 0, '采用可复核的预计算实验', '切换后运行两次完整实验；实时连续模式仍可在退出引导后使用。', '切换到预计算');
  if (!input.baseline) {
    if (input.currentRunId && input.currentValid && !input.busy) return step('baseline-save', 1, '锁定基线 A', '保存当前运行的末尾 0.5 秒 A 计权四座结果，作为路面场景对照的基准。', '保存当前实验为 A');
    return step('baseline-run', 0, '运行基线 A', '当前车型和工况将进入真实 Worker；未得到有效结果前不会保存基线。', '计算基线 A', input.busy);
  }
  if (input.currentRunId && input.currentRunId !== input.baseline.runId) {
    if (!input.currentValid || !input.candidate) return step('repair', 2, '候选 B 数据不足', '本次实验未得到有效的末尾声压窗口；保留基线 A，请修正配置后重算。', '查看实验配置', true);
    const comparison = compareCases(input.baseline, input.candidate);
    if (!comparison.comparable) return step('repair', 2, '比较条件不一致', `${comparison.conditions.join('、')}不一致；不能计算 A/B 差值。基线 A 仍保留。`, '查看实验配置', true);
    if (comparison.changes.length !== 1) return step('repair', 2, '需要恰好一个变量', comparison.changes.length ? `当前改变了 ${comparison.changes.length} 项，不能把变化归因于其中一项。` : '两次配置完全相同，尚无候选条件。', '查看实验配置', true);
    if (!input.candidateFieldReady) return step('field', 3, '查看候选 B 的车内声场', `已得到单变量比较：${comparison.changes[0]}。查看候选末尾同一 0.5 秒窗口的残余声场和四座数值；同车参数化模型未经实车标定。`, '显示候选声场');
    if (!input.heardOriginal || !input.heardResidual) return step('listen', 4, '同座位、同片段公平试听', `A/B 数值已可复核。${input.heardOriginal ? '原声已试听；' : '先试听原声 d；'}${input.heardResidual ? '残差已试听。' : '再试听残差 e。'}试听切换不改变数值结果。`, input.heardOriginal ? '试听残差 e' : '试听原声 d');
    return step('review', 5, '形成有边界的工程判断', `单变量 ${comparison.changes[0]}；四座差值来自同窗计算。请区分自动事实、人工解释和待补测，不把教学结果签收为实车结论。`, '打开工程评审卡');
  }
  // Reuse the A/B contract before spending time on a candidate run. The copied
  // window is only a configuration probe; its pressure values are never shown.
  const planned = compareCases(input.baseline, { ...input.baseline, config: input.config });
  if (!planned.comparable || planned.changes.length > 1) return step('repair', 2, '先恢复可比条件', !planned.comparable
    ? `${planned.conditions.join('、')}已改变；请恢复与基线 A 相同的实验条件。`
    : `当前改变了 ${planned.changes.length} 项；引导演示需要只保留一项变化。`, '查看实验配置', true);
  if (planned.changes.length === 0) return step('road', 2, '只改变路面粗糙度', '在三维道路选择另一种路面；它会同步声学粗糙度并使旧实验失效。车型、车速、素材和其余参数保持不变。', '在三维道路切换路面');
  return step('candidate-run', 2, '计算候选 B', '配置已改变，需由真实 Worker 重新计算；其余条件相同且仅改变路面时才显示场景差值，不解释为ANC控制方案净收益。', '计算候选 B', input.busy);
}
