import type { LabDivergence, LabPathAnalysis, LabPathSelection } from '../../shared/lab-contracts';
import { ORDER } from '../../shared/contracts';
import { defaultLabConfig, labDurationLimit, labLayoutId, supportedLabLayoutId, LAB_LIVE_LIMIT_SECONDS, LAB_WAVEFORM_SECONDS, VEHICLE_NAMES, type AcousticWeighting, type LabAnalysisOptions, type FieldFrame, type LabAnalysis, type LabConfig, type LabLivePacket, type LabLiveSnapshot, type LabResult, type LabRncChange, type LabSelection, type Vec3, type VehicleKind } from '../../shared/lab-contracts';
import { Player, prepareLabPlayback } from '../player';
import { LivePlayer } from '../player/live-player';
import { createLabViewer } from '../viewer/lab-viewer';
import { captureCase, compareCases, type CaseSnapshot } from './case-compare';
import { CASE_EVIDENCE_BOUNDARY, CASE_EVIDENCE_MAX_BYTES, createCaseEvidence, parseCaseEvidence } from './case-evidence';
import { reviewCase } from './case-review';
import { createSignalFlow } from './signal-flow';
import { drawSignalComparison, plot, splFrame, splRange, visibleSplFrames, ORIGINAL_COLOR, RESULT_COLOR, type SplFrame } from './plots';
import { bindPlotSettings, plotSettingsMarkup } from './plot-settings';
import './style.css';
import './game-ui.css';

export interface LabPorts {
  calculate(config: LabConfig, runId: string): Promise<LabResult>;
  startLive(config: LabConfig, runId: string): Promise<void>;
  pullLive(sampleCount: number): Promise<LabLivePacket>;
  setLiveRnc(enabled: boolean): Promise<LabRncChange>;
  field(time: number, points: Vec3[], weighting?: AcousticWeighting): Promise<FieldFrame>;
  cancel(): void;
  analyzePath?(config: LabConfig, selection: LabPathSelection): LabPathAnalysis;
  analyze(result: LabResult, time: number, selection: LabSelection, options?: LabAnalysisOptions): LabAnalysis;
}
const types = ['ice', 'bev', 'hev', 'erev'] as const;
const replayDurations = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const defaultReplayDuration = 20;
const clockText = (seconds: number) => {
  const ticks = Math.floor(Math.max(0, seconds) * 100);
  return `${Math.floor(ticks / 6000).toString().padStart(2, '0')}:${((ticks % 6000) / 100).toFixed(2).padStart(5, '0')}`;
};
const seatNames = ['左前座 · FL', '右前座 · FR', '左后座 · RL', '右后座 · RR'];
const modelNotes: Record<VehicleKind, string> = {
  ice: '发动机 → 变速箱 → 传动系统；油箱供油、排气后处理。',
  bev: '底板动力电池 → 逆变器 → 电机/减速器；纯电驱轮。',
  hev: '发动机与电机经功率分流机构协同驱动；独立小容量动力电池。',
  erev: '发动机仅带动发电机；电池与发电机供电，由电机机械驱轮。',
};
export function mountLab(root: HTMLElement, ports: LabPorts) {
  root.className = 'lab-app';
  root.innerHTML = `
    <header class="lab-header"><div><span class="lab-eyebrow">INTERACTIVE ACOUSTICS / RNC</span><h1>车辆声学实验室</h1></div><span class="lab-badge">完整目标 · 开发中</span><a href="?legacy=1">两周基准版本</a></header>
    <div class="lab-disclosure"><span id="lab-source-disclosure">实录初级噪声驱动的四轮等效声源</span> · 基准：纯电 / 40 km/h / 粗糙路 · 合成空间路径 · <span id="lab-disclosure-mode">实时分块仿真 · 保留学习状态</span> · 实录为未校准V；图中Pa/SPL为教学尺度，非实测声压</div>
    <main class="lab-main"><aside id="lab-controls" class="lab-controls"><button id="lab-controls-close" type="button">返回三维场景</button>
      <h2>01 / 车辆与工况</h2><label>运行方式<select id="lab-mode"><option value="live" selected>实时连续仿真</option><option value="replay">计算后回放</option></select></label><p id="lab-mode-help"></p><label>声源素材<select id="lab-source-mode"><option value="recorded-noise" selected>实录初级噪声 · 四轮声源</option><option value="shaped-noise">随机噪声 · 实录谱形整形</option></select></label><p id="lab-source-help" class="lab-help"></p><label>动力类型<select id="lab-vehicle">${types.map(key => `<option value="${key}" ${key === 'bev' ? 'selected' : ''}>${VEHICLE_NAMES[key]}</option>`).join('')}</select></label><p id="lab-architecture"></p>
      <label>车速 / km/h<input id="lab-speed" type="range" min="10" max="130" step="5" value="60"><output id="lab-speed-value">60</output></label>
      <label>路面粗糙度 / 相对值<input id="lab-road" type="range" min="0.1" max="3" step="0.1" value="0.6"><output id="lab-road-value">0.6</output></label>
      <p id="lab-road-acoustic-note" class="lab-road-acoustic-note" role="status">平整沥青 · 声学粗糙度 0.6 已同步。</p>
      <label>胎面粗糙度 / 相对值<input id="lab-tread" type="range" min="0.1" max="3" step="0.1" value="1"><output id="lab-tread-value">1</output></label>
      <div class="lab-pair"><label>胎压 / kPa<input id="lab-pressure" type="number" min="160" max="320" value="240"></label><label>温度 / °C<input id="lab-temperature" type="number" min="-20" max="50" value="20"></label></div>
      <p id="lab-parameters-help" class="lab-help"></p>
      <label>教学声压修正 / dB<input id="lab-level-offset" type="number" min="-12" max="12" step="1" value="0"></label><p id="lab-calibration-help" class="lab-help"></p><div id="lab-duration-control"><label>预计算时长<select id="lab-duration">${replayDurations.map(seconds => `<option value="${seconds}" ${seconds === defaultReplayDuration ? 'selected' : ''}>${seconds} s</option>`).join('')}</select></label><p id="lab-duration-help" class="lab-help"></p></div><h2>02 / 算法与改制</h2><div class="lab-pair"><label>NFxLMS 系数数<input id="lab-taps" type="number" min="16" max="128" step="1" value="64"></label><label>归一化步长 μ<input id="lab-step" type="number" min="0" step="any" value="0.08"></label></div><p class="lab-help">FIR数学阶数为系数数减1。步长≥0，无预设上限；数值溢出自动暂停。试听单独保护，图表保留真实幅值。参数变化需重新学习。</p>
      <label id="lab-rnc-config" class="lab-check"><input id="lab-rnc" type="checkbox" checked>启用 RNC（更改后重算）</label>
      <label class="lab-check"><input id="lab-edit" type="checkbox">车辆改制：点击结构添加参考传感器</label><p class="lab-help">参考1–8个；右击标记可查看或移除。误差点固定。所有改制将要求重新计算。</p><div id="lab-references"></div><p id="lab-mount-warning" role="status" hidden></p>
      <fieldset><legend>车门扬声器</legend><div id="lab-speakers">${ORDER.map((name, i) => `<label class="lab-check"><input type="checkbox" data-speaker="${i}" checked>${name.toUpperCase()}</label>`).join('')}</div></fieldset>
      <button id="lab-calculate" class="lab-primary">启动 / 重启实时实验</button><button id="lab-cancel" disabled>结束实时实验</button><p id="lab-status" role="status">实时仿真已就绪，点击“启动 / 重启实时实验”开始计算与试听。</p>
    </aside><section class="lab-workspace"><div class="lab-view-heading"><div><span class="lab-stage-kicker">LIVE 3D / INTERACTIVE BAY</span><h2>03 / 结构与空间声场</h2></div><span id="lab-run">尚无实验结果</span><button id="lab-controls-toggle" type="button" aria-controls="lab-controls" aria-expanded="true">收起控制台</button></div>
      <section id="lab-case" class="lab-case" aria-labelledby="lab-case-title"><div class="lab-case-intro"><span class="lab-stage-kicker">ENGINEERING QUESTION / 方案对比</span><h3 id="lab-case-title">改变一个条件后，后排会更安静吗？</h3><p>保存一次预计算实验作为基线 A，修改配置并重算候选 B。比较取两次实验末尾同一 0.5 秒窗、A 计权 0–1 kHz；当前声学路径使用教学固定布局，尚未与写实车型配准。</p></div><div class="lab-case-actions"><button id="lab-case-save" type="button" disabled>保存当前实验为基线 A</button><button id="lab-case-clear" type="button" disabled>清除基线</button></div><p id="lab-case-state" class="lab-case-state" role="status">先切换到计算后回放，运行一次实验。</p><div id="lab-case-results" class="lab-case-results" hidden></div><details class="lab-case-evidence"><summary>工程评审卡 / 案例证据</summary><p>自动事实与限制由 A/B 数据计算；解释、行动和补测由工程师填写。导入仅供查看，不恢复实验或原始音频。</p><div id="lab-case-review-current" class="lab-review-facts" hidden></div><label>人工观察 · 看到什么<textarea id="lab-case-observation" maxlength="1000" rows="2" placeholder="例如：右后座残余声压升高。"></textarea></label><label>人工解释 · 可能原因<textarea id="lab-case-interpretation" maxlength="1000" rows="2" placeholder="这是待验证假设；多变量变化时不能单因子归因。"></textarea></label><label>临时行动 · 下一步怎么处理<textarea id="lab-case-decision" maxlength="1000" rows="2" placeholder="例如：先保留基线方案，补测后再决策。"></textarea></label><label>待补测事项<textarea id="lab-case-next-check" maxlength="1000" rows="2" placeholder="例如：保持车速不变，复测不同路面。"></textarea></label><div class="lab-case-actions"><button id="lab-case-export" type="button" disabled>导出当前 A/B 评审摘要</button><label class="lab-case-import">导入 JSON 复核<input id="lab-case-import" type="file" accept="application/json,.json"></label></div><p id="lab-case-evidence-state" role="status">导出需要当前页面中完成两次预计算实验。</p><div id="lab-case-imported" class="lab-case-results" hidden></div></details></section>
      <div id="lab-viewer"><span class="lab-view-help">左键旋转 · 滚轮缩放 · 右击硬件查看信号</span></div>
      <div class="lab-view-tools"><label>车身<select id="lab-body"><option value="transparent">透明</option><option value="solid">实体</option><option value="hidden">隐藏</option></select></label><button id="lab-explode" aria-pressed="false">分解动画</button><button id="lab-reset">复位</button><label>剖面<select id="lab-section"><option value="none">关闭</option><option value="x">纵剖 X</option><option value="y">水平 Y</option><option value="z">横剖 Z</option></select></label><label>剖面位置 / m<input id="lab-section-position" type="range" min="-2.5" max="2.5" step="0.05" value="0"></label></div>
      <div class="lab-view-tools"><label>声压场<select id="lab-field"><option value="off">关闭</option><option value="residual">残余 e / SPL</option><option value="primary">原始 d / SPL</option></select></label><label>声场 / 指标计权<select id="lab-field-weight"><option value="A">A 计权</option><option value="Z">Z（不计权）</option></select></label><label>场显示<select id="lab-field-slice"><option value="volume">三维采样体</option><option value="x">中央纵切片</option><option value="y">头部水平切片</option><option value="z">前排横切片</option></select></label><label>传播路径<select id="lab-paths"><option value="none">关闭</option><option value="primary">初级路径</option><option value="secondary">次级路径</option><option value="both">全部</option></select></label><label class="lab-check"><input id="lab-waves" type="checkbox">扬声器波前</label></div>
      <div class="lab-field-note"><span class="lab-colorbar"></span><span id="lab-field-scale">30—80 dBA，固定色标；0.5秒RMS</span><span id="lab-field-status">声场未开启</span></div><p class="lab-help">空间场由四轮源和实际扬声器驱动经同一传播模型计算。爆炸只改变展示坐标；波前/路径动画为慢放示意，非实际声速。闭合实体按真实截面封口；薄面和开管仅显示截线。</p>
      <div id="lab-metrics" class="lab-metrics"></div><section class="lab-signals"><h2>04 / 信号流与控制机理</h2><div id="lab-flow"></div></section>
    </section></main>
    <section class="lab-plots">
      <article><div class="lab-plot-heading"><h3 id="lab-signal-title">时域</h3>${plotSettingsMarkup('wave')}</div><p id="lab-wave-legend" class="lab-plot-legend"></p><canvas id="lab-wave" aria-label="时域图"></canvas></article>
      <article><div class="lab-plot-heading"><h3 id="lab-spectrum-title">频谱</h3>${plotSettingsMarkup('spectrum')}</div><p id="lab-spectrum-legend" class="lab-plot-legend"></p><canvas id="lab-spectrum" aria-label="频谱图"></canvas></article>
      <article class="lab-convergence-panel"><div class="lab-plot-heading"><h3 id="lab-convergence-title">收敛</h3>${plotSettingsMarkup('convergence')}</div><p id="lab-convergence-legend" class="lab-plot-legend"></p><canvas id="lab-convergence" aria-label="所选座位总声压级收敛图"></canvas></article>
    </section>
    <footer class="lab-player"><button id="lab-play" disabled>播放</button><button id="lab-replay" disabled>重播</button><span id="lab-time">0.00 / ${defaultReplayDuration} s</span><input id="lab-seek" aria-label="播放进度" type="range" min="0" max="${defaultReplayDuration}" step="0.01" value="0" disabled><label>座位（图表 / 试听）<select id="lab-seat">${seatNames.map((name, i) => `<option value="${i}">${name}</option>`).join('')}</select></label><button id="lab-rnc-on" aria-pressed="true" aria-describedby="lab-audition-state" title="仅切换原声/降噪后试听，不重置实验">RNC ON</button><span id="lab-audition-state" role="status">正在试听：降噪后 e</span><label>音量<input id="lab-volume" aria-label="音量" type="range" min="0" max="0.5" step="0.01" value="0.15"></label><button id="lab-mute" aria-pressed="false">静音</button></footer>
    <div id="lab-context" class="lab-context" role="menu" hidden></div><details class="lab-sources"><summary>公开依据与模型限制</summary><p>结构参考 DOE AFDC、Toyota RAV4 Hybrid、VW ID.4、Stellantis C10 REEV；原型外形为原创，不冒充其量产车型。硬件位置参考 EP3156998B1。源谱/传递参数为有依据的教学假设，尚未实车标定；模型精细度仍在改进。</p><a href="https://afdc.energy.gov/vehicles/how-do-hybrid-electric-cars-work" target="_blank" rel="noreferrer">DOE 结构原理</a> · <a href="https://patents.google.com/patent/EP3156998B1/en" target="_blank" rel="noreferrer">RNC硬件专利</a><p>更完整的逐项来源与适用边界见仓库 docs/research。完整目标仍在开发验证中。</p></details>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#lab-${id}`)!;
  // Keep transport and ANC feedback next to the 3D scene; mechanism is the last section.
  const playerPanel=root.querySelector<HTMLElement>('.lab-player')!;
  const plotsPanel=root.querySelector<HTMLElement>('.lab-plots')!;
  const signalsPanel=root.querySelector<HTMLElement>('.lab-signals')!;
  const viewTools=[...root.querySelectorAll<HTMLElement>('.lab-workspace>.lab-view-tools')];
  $('viewer').after(...viewTools,root.querySelector<HTMLElement>('.lab-field-note')!,playerPanel); playerPanel.after($('metrics')); $('metrics').after(plotsPanel);
  root.append($('case')); root.append(signalsPanel);
  const player = new Player(); player.setVolume(0.15);
  const livePlayer = new LivePlayer(); livePlayer.setVolume(0.15);
  let config: LabConfig = { ...defaultLabConfig(), sourceMode: 'recorded-noise', durationSeconds: defaultReplayDuration }, result: LabResult | null = null, selected: LabSelection = { signal: 'e', channel: 0 };
  let caseBaseline: CaseSnapshot | null = null;
  // Match the viewer's initial smooth asphalt rather than starting with two road states.
  config.roadRoughness = 0.6;
  let generation = 0, busy = false, exploded = false, muted = false, nextReference = 5, disposed = false;
  let realtime = true, liveSession = false, livePullPending = false, liveSnapshot: LabLiveSnapshot | null = null;
  let backgroundPaused = false, audition: 'd' | 'e' = 'e';
  let liveRncEnabled = true, liveAudibleRnc = true, liveRncPending = false;
  let liveRncChange: LabRncChange | null = null, liveRncError = '';
  let fieldPending = false, fieldInFlight = 0, fieldEpoch = 0, lastFieldAt = -1, lastFieldClock = 0, lastChart = 0;
  let curves: Record<AcousticWeighting, SplFrame[]> = { A: [], Z: [] };
  let levelWeighting: AcousticWeighting = 'A';
  let halted: LabDivergence | null = null;
  const chartSettings = bindPlotSettings(root, () => { if (result) draw(); else clearPlots(); });
  const caseLevel = (value: number | null) => value === null ? '—' : value.toFixed(1);
  const caseDelta = (value: number | null) => value === null ? '—' : `${Math.abs(value) < 0.05 ? '' : value > 0 ? '+' : ''}${(Math.abs(value) < 0.05 ? 0 : value).toFixed(1)}`;
  function appendReviewFacts(target: HTMLElement, base: CaseSnapshot, candidate: CaseSnapshot) {
    const review = reviewCase(base, candidate);
    const heading = document.createElement('strong'); heading.textContent = '自动整理 · 事实与判断边界';
    const facts = document.createElement('ul'); facts.className = 'lab-review-fact-list';
    for (const item of review.facts) { const li = document.createElement('li'); li.textContent = item; facts.append(li); }
    const limits = document.createElement('ul'); limits.className = 'lab-review-limit-list';
    for (const item of review.limits) { const li = document.createElement('li'); li.textContent = item; limits.append(li); }
    target.append(heading, facts, limits);
  }
  function candidateCase(): CaseSnapshot | null {
    if (halted || !caseBaseline || !result || realtime || result.runId === caseBaseline.runId) return null;
    try { return captureCase(result, ports.analyze(result, result.sampleCount / result.config.sampleRateHz, { signal: 'e', channel: 0 }, { levelWeighting: 'A', levelsOnly: true })); }
    catch { return null; }
  }
  function renderCase() {
    const state = $('case-state'), output = $('case-results');
    const reviewOutput = $('case-review-current'); reviewOutput.replaceChildren(); reviewOutput.hidden = true;
    const save = $<HTMLButtonElement>('case-save'), clear = $<HTMLButtonElement>('case-clear');
    save.disabled = !!halted || realtime || busy || !result;
    clear.disabled = !caseBaseline;
    $<HTMLButtonElement>('case-export').disabled = busy || !candidateCase();
    output.replaceChildren(); output.hidden = true;
    if (!caseBaseline) {
      state.textContent = realtime ? '先切换到“计算后回放”，运行一次实验并保存基线 A。' : result ? '当前实验已就绪；保存为基线 A，再修改一个条件并重新计算。' : '运行一次预计算实验后，可保存基线 A。';
      return;
    }
    if (!result || result.runId === caseBaseline.runId || realtime) {
      state.textContent = realtime ? '基线 A 已保留在本页内存中；切回预计算模式运行候选 B。' : `基线 A 已保存（${caseBaseline.runId.slice(0, 8)}）；修改配置后重新计算候选 B。`;
      return;
    }
    const candidate = candidateCase();
    if (!candidate) {
      state.textContent = '候选 B 的末尾窗口没有有效声压数据，无法对比；基线 A 仍保留。';
      return;
    }
    const comparison = compareCases(caseBaseline, candidate);
    appendReviewFacts(reviewOutput, caseBaseline, candidate); reviewOutput.hidden = false;
    if (!comparison.comparable) {
      state.textContent = `两次实验的${comparison.conditions.join('、')}不同，不能直接计算方案差值。请恢复相同条件后重跑；基线 A 仍保留。`;
      return;
    }
    const change = comparison.changes.length === 1 ? `仅改变：${comparison.changes[0]}。` : comparison.changes.length > 1 ? `改变了 ${comparison.changes.length} 项：${comparison.changes.join('、')}；不能把结果归因于其中一项。` : '配置未改变；这是同配置的重复运行。';
    state.textContent = `${change} A ${caseBaseline.runId.slice(0, 8)} → B ${candidate.runId.slice(0, 8)}；后排残余变化 RL ${caseDelta(comparison.residualDeltaDb[2])}、RR ${caseDelta(comparison.residualDeltaDb[3])} dB。`;
    const table = document.createElement('table');
    const header = document.createElement('tr');
    for (const label of ['座位', 'A 原声→残余 / 改善', 'B 原声→残余 / 改善', 'B−A 原声', 'B−A 残余', 'B−A 改善']) { const cell = document.createElement('th'); cell.textContent = label; header.append(cell); }
    table.append(header);
    for (let i = 0; i < 4; i++) {
      const row = document.createElement('tr');
      for (const value of [seatNames[i], `${caseLevel(caseBaseline.primarySpl[i])}→${caseLevel(caseBaseline.residualSpl[i])} / ${caseLevel(caseBaseline.reductionDb[i])}`, `${caseLevel(candidate.primarySpl[i])}→${caseLevel(candidate.residualSpl[i])} / ${caseLevel(candidate.reductionDb[i])}`, caseDelta(comparison.primaryDeltaDb[i]), caseDelta(comparison.residualDeltaDb[i]), caseDelta(comparison.reductionDeltaDb[i])]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      table.append(row);
    }
    const sourceNote = caseBaseline.config.sourceMode === 'recorded-noise' ? '实录仅为四轮等效声源' : '随机声源按实录谱形整形';
    const note = document.createElement('p'); note.textContent = `物理布局 ${labLayoutId(caseBaseline.config)}；原声/残余：dBA；改善/差值：dB。B−A 残余正值表示候选更吵，B−A 改善正值表示候选控制效果更好。A、B 均为末尾 ${caseBaseline.windowEndSeconds.toFixed(1)} s 的 0.5 秒窗，A 计权、0–1 kHz；${sourceNote}，声压为教学尺度。基线仅保存在当前页面，刷新后清除。`;
    output.append(table, note); output.hidden = false;
  }
  const levelUnit = () => levelWeighting === 'A' ? 'dBA' : 'dB';
  let visualRoad: { name: string; roughness: number } | null = { name: '平整沥青', roughness: 0.6 };
  const roadNames = { smooth: '平整沥青', coarse: '粗糙沥青', gravel: '碎石路' } as const;
  const flow = createSignalFlow($('flow'), () => {}, () => drawInspector());
  let cachedPathKey = '';
  let cachedPath: LabPathAnalysis | null = null;
  const viewer = createLabViewer($('viewer'), {
    select, add: addReference, context,
    roadPreset(surface, roughness) {
      visualRoad = { name: roadNames[surface], roughness };
      if (config.roadRoughness !== roughness) {
        config.roadRoughness = roughness;
        $<HTMLInputElement>('road').value = String(roughness);
        $('road-value').textContent = roughness.toFixed(1);
        updateRoadNote();
        dirty();
      } else updateRoadNote();
    },
  });
  const controlsToggle = $<HTMLButtonElement>('controls-toggle');
  const controlsClose = $<HTMLButtonElement>('controls-close');
  function setControlsCollapsed(collapsed: boolean) {
    root.classList.toggle('lab-controls-collapsed', collapsed);
    controlsToggle.setAttribute('aria-expanded', String(!collapsed));
    controlsToggle.textContent = collapsed ? '展开控制台' : '收起控制台';
  }
  controlsToggle.onclick = () => {
    const collapsed = !root.classList.contains('lab-controls-collapsed');
    setControlsCollapsed(collapsed);
    if (!collapsed && matchMedia('(max-width: 680px)').matches) controlsClose.focus();
  };
  controlsClose.onclick = () => { setControlsCollapsed(true); controlsToggle.focus(); };
  const narrowViewport = matchMedia('(max-width: 680px)');
  const onNarrowViewport = (event: MediaQueryListEvent) => { if (event.matches) setControlsCollapsed(true); };
  narrowViewport.addEventListener('change', onNarrowViewport);
  if (narrowViewport.matches) setControlsCollapsed(true);
  function updateRoadNote() {
    const actual = config.roadRoughness.toFixed(1);
    const applied = result?.config.roadRoughness === config.roadRoughness;
    $('road-acoustic-note').textContent = visualRoad
      ? config.roadRoughness === visualRoad.roughness
        ? `${visualRoad.name} · 声学粗糙度 ${actual} 已同步；${applied ? '当前实验已采用。' : '重新运行后生效。'}`
        : `手动粗糙度 ${actual} 将用于声学计算；三维路面仍显示${visualRoad.name}材质。`
      : `尚未选择三维路面预设；声学计算使用当前粗糙度 ${actual}。`;
  }
  const transport = () => liveSession ? livePlayer : player;
  const displayTime = () => halted ? halted.sample/config.sampleRateHz : transport().currentTime;
  const timeOffset = () => liveSnapshot ? liveSnapshot.startSample / config.sampleRateHz : 0;
  const mountIssues = () => (viewer as typeof viewer & { getMountIssues?: () => { sensorId: string; mountPart: string }[] }).getMountIssues?.() ?? [];
  function select(value: LabSelection) {
    flow.openSignal(value.signal, value.channel);
    $('context').hidden = true;
    $('flow').scrollIntoView({block:'start',behavior:'smooth'});
    drawInspector();
  }
  function drawInspector() {
    const inspected=flow.getInspection();
    if (!inspected || inspected.type === 'info') return;
    const offset=timeOffset(), localTime=Math.max(0,displayTime()-offset);
    if (inspected.type === 'signal') {
      const weighting=root.querySelector<HTMLSelectElement>('[data-sf-weight]')!.value as AcousticWeighting;
      const analysis=result ? ports.analyze(result,localTime,inspected.value,{spectrumWeighting:weighting}) : null;
      flow.drawInspection(analysis,null,config.sampleRateHz,offset);
    } else {
      const key=JSON.stringify([config,inspected.value]);
      if(key!==cachedPathKey){
        try { cachedPath=ports.analyzePath?.(config,inspected.value)??null; }
        catch(error) { cachedPath=null; $('status').textContent=error instanceof Error ? error.message : String(error); }
        cachedPathKey=key;
      }
      flow.drawInspection(null,cachedPath,config.sampleRateHz,offset);
    }
  }
  function context(value: LabSelection, x: number, y: number) {
    const menu = $('context'); menu.replaceChildren();
    const inspect = document.createElement('button'); inspect.textContent = '查看信号与频谱'; inspect.setAttribute('role', 'menuitem'); inspect.onclick = () => select(value); menu.append(inspect);
    if (value.signal === 'x' && $<HTMLInputElement>('edit').checked) {
      const remove = document.createElement('button'); remove.textContent = '移除此参考传感器'; remove.disabled = config.references.length <= 1;
      remove.onclick = () => { config.references.splice(value.channel, 1); selected = { signal: 'e', channel: 0 }; dirty(); menu.hidden = true; }; menu.append(remove);
    }
    menu.style.left = `${Math.min(x, innerWidth - 230)}px`; menu.style.top = `${Math.min(y, innerHeight - 110)}px`; menu.hidden = false; inspect.focus();
  }
  function refreshConfig() {
    const recorded = config.sourceMode === 'recorded-noise';
    $('source-disclosure').textContent = recorded ? '实录初级噪声驱动的四轮等效声源' : '实录频谱驱动的随机合成信号';
    $('source-help').textContent = recorded ? '四路耳旁原声分别放置在四轮位置，按同一时钟平滑循环40秒素材。初级路径保留空间传播，不重复叠加振动转噪声的谱形。' : '独立随机激励经实录参考谱形整形，再经初级路径生成车内噪声。每次继续生成新样本。';
    $('parameters-help').textContent = recorded ? '实录基准为40 km/h粗糙路。速度/粗糙度仅缩放幅值，温度改变幅值与传播；保持录音原频率，胎压在此模式不参与计算。参考x由等效声源合成，未使用实录振动。' : '实录频谱基准为40 km/h粗糙路，粗糙度1代表该相对基准。车速/粗糙度缩放能量，胎压/温度伸缩谱形，均为教学外推；保留实录低频，不加入固定纯音。';
    $<HTMLInputElement>('pressure').disabled = recorded;
    flow.setSourceMode(recorded);
    const limit = Math.min(90, Math.floor(labDurationLimit(config) / 10) * 10);
    const duration = $<HTMLSelectElement>('duration');
    for (const option of duration.options) option.disabled = Number(option.value) > limit;
    if (!realtime) config.durationSeconds = Math.min(config.durationSeconds, limit);
    duration.value = String(config.durationSeconds); duration.disabled = realtime;
    $('duration-control').hidden = realtime;
    $('rnc-config').hidden = realtime;
    $('seek').hidden = realtime;
    $('mode-help').textContent = realtime ? '连续计算并始终试听残差 e。RNC OFF 冻结控制系数、扬声器驱动置零；重新开启沿用权重学习。暂停保留状态，重新开始或修改参数后重新学习。' : '一次计算完整实验，可定位和重放；RNC ON/OFF仅切换固定的残差/原声试听。';
    $('calculate').textContent = realtime ? '启动 / 重启实时实验' : '计算当前实验';
    $('cancel').textContent = realtime ? '结束实时实验' : '取消计算';
    $('replay').textContent = realtime ? '重新开始' : '重播';
    refreshRncControl();
    $<HTMLInputElement>('seek').max = String(config.durationSeconds);
    $('calibration-help').textContent = recorded ? '实录基准：纯电、40 km/h、粗糙路，副驾驶200–300 Hz平均谱峰约48 dBA/Hz（参考20 μPa）。瞬时谱随素材波动；单点幅度匹配，非完整实车标定。' : '随机模式保留40 km/h粗糙路、四座平均约60 dBA的教学尺度。';
    $('duration-help').textContent = limit === 90 ? `可选10–90秒，每10秒一档。${recorded ? '超过素材长度时平滑循环，学习状态连续。' : '超过录音长度时连续合成新样本。'}` : `当前参考通道配置可选10–${limit}秒；较长档位超出内存预算，已禁用。`;
    $('disclosure-mode').textContent = realtime ? '实时分块仿真 · 保留学习状态' : `${config.durationSeconds}秒预计算回放`;
    $('architecture').textContent = modelNotes[config.vehicle]; viewer.setConfig(config);
    const issues = mountIssues();
    $('mount-warning').hidden = issues.length === 0;
    $('mount-warning').textContent = issues.length ? `当前车型缺少安装部件：${issues.map(i => i.mountPart).join('、')}。请在改制模式移除对应参考并重新安装，之后再运行。` : '';
    flow.setChannels(config.references.map(r => r.name), [...config.speakerEnabled]); flow.setSelected(selected.signal, selected.channel);
    $('references').replaceChildren();
    config.references.forEach((sensor, i) => {
      const row = document.createElement('div'); row.className = 'lab-reference-row';
      const name = document.createElement('button'); name.textContent = sensor.name; name.onclick = () => select({ signal: 'x', channel: i }); row.append(name);
      const position = document.createElement('small'); position.textContent = issues.some(issue => issue.sensorId === sensor.id) ? '安装件缺失' : sensor.position.map(v => v.toFixed(2)).join(', '); row.append(position);
      const remove = document.createElement('button'); remove.textContent = '移除'; remove.setAttribute('aria-label', `移除 ${sensor.name}`); remove.disabled = config.references.length <= 1 || !$<HTMLInputElement>('edit').checked;
      remove.onclick = () => { config.references.splice(i, 1); selected = { signal: 'e', channel: 0 }; dirty(); }; row.append(remove); $('references').append(row);
    });
  }
  function clearField() {
    ++fieldEpoch; fieldPending = false; lastFieldAt = -1;
    viewer.updateField({ valid: false, time: 0, points: [], primarySpl: new Float32Array(), residualSpl: new Float32Array(), reductionDb: new Float32Array() });
    $('field-status').textContent = $<HTMLSelectElement>('field').value === 'off' ? '声场未开启' : '等待当前实验声场';
  }
  function clearExperiment() {
    halted = null; result = null; liveSession = false; livePullPending = false; liveSnapshot = null; backgroundPaused = false; livePlayer.reset();
    liveRncPending = false; liveRncChange = null; liveRncError = ''; liveAudibleRnc = liveRncEnabled;
    curves = { A: [], Z: [] };
    player.pause(); player.seek(0); clearField(); clearPlots();
    $('metrics').replaceChildren(); $('run').textContent = '尚无当前实验结果';
    $('signal-title').textContent = '波形：等待当前实验'; $('spectrum-title').textContent = 'PSD：等待当前实验';
    renderCase();
  }
  function dirty() {
    ++generation; ports.cancel(); busy = false; clearExperiment();
    $('status').textContent = realtime ? '配置已改变，请启动新的实时实验；学习状态已重置。' : '配置已改变，请重新计算。旧结果已停止展示。'; $('run').textContent = '待计算配置'; $('metrics').replaceChildren();
    for (const name of ['play', 'replay', 'seek']) ($<HTMLButtonElement>(name)).disabled = true;
    $<HTMLButtonElement>('calculate').disabled = false; $<HTMLButtonElement>('cancel').disabled = true;
    refreshConfig(); clearPlots();
    renderCase();
  }
  function addReference(position: Vec3, mountPart?: string) {
    if (config.references.length >= 8) { $('status').textContent = '当前计算上限为8个参考传感器，可先移除已有传感器。'; return; }
    const id = nextReference++;
    config.references.push({ id: `ref-${id}`, name: `REF ${id}`, position, mountPart }); dirty();
  }
  function drawSpl(time: number) {
    const settings = chartSettings.convergence;
    const visible = visibleSplFrames(curves[settings.weighting], time, 0.5);
    const mic = Number($<HTMLSelectElement>('seat').value);
    const x = settings.x ?? [0, Math.max(5, time)] as [number,number];
    const inView = visible.filter(frame => frame.time >= x[0] && frame.time <= x[1]);
    const range = splRange(inView.map(frame => ({ time:frame.time, primary: settings.showOriginal ? [frame.primary[mic]] : [], residual:[frame.residual[mic]] })));
    $('convergence-title').textContent = `收敛 · ${ORDER[mic].toUpperCase()}`;
    $('convergence').setAttribute('aria-label', `${seatNames[mic]}总声压级收敛图`);
    $('convergence-legend').innerHTML = `${settings.showOriginal ? '<span class="lab-original-key">原声 d</span>' : ''}<span class="lab-result-key">残差 e</span>`;
    plot($<HTMLCanvasElement>('convergence'), [
        ...(settings.showOriginal ? [{ x: visible.map(f => f.time), values: visible.map(f => f.primary[mic]), color: ORIGINAL_COLOR }] : []),
        { x: visible.map(f => f.time), values: visible.map(f => f.residual[mic]), color: RESULT_COLOR },
      ], { x, y: settings.y ?? range, xLabel: '实验时间 / s', yLabel: `总声压级 / ${settings.weighting === 'A' ? 'dBA' : 'dBZ'}`,
        empty: time < 0.5 ? '等待数据' : '当前范围无数据' });
  }
  function clearPlots() {
    root.querySelectorAll<HTMLInputElement>('[data-axis-auto="rightY"]').forEach(input => { input.closest('fieldset')!.hidden = true; });
    $('signal-title').textContent = '时域'; $('spectrum-title').textContent = '频谱';
    $('wave-legend').replaceChildren(); $('spectrum-legend').replaceChildren();
    plot($('wave'), [], { x: chartSettings.wave.x ?? [0, LAB_WAVEFORM_SECONDS], y: chartSettings.wave.y ?? [-1, 1], xLabel: '实验时间 / s', yLabel: 'Pa' });
    plot($('spectrum'), [], { x: chartSettings.spectrum.x ?? [chartSettings.spectrum.xScale === 'log' ? 2000/1024 : 0,1000], xScale: chartSettings.spectrum.xScale, y: chartSettings.spectrum.y ?? [0,70], xLabel: '频率 / Hz', yLabel: `PSD / ${chartSettings.spectrum.weighting === 'A' ? 'dBA' : 'dBZ'}/Hz` });
    drawSpl(0); drawInspector();
  }
  function draw() {
    drawInspector();
    if (!result) return;
    const time = displayTime(), offset = timeOffset(), localTime = Math.max(0, time - offset);
    const spectrumWeighting = chartSettings.spectrum.weighting;
    const options = { spectrumWeighting, levelWeighting,
      waveformStartSeconds: chartSettings.wave.x ? Math.max(0,chartSettings.wave.x[0]-offset) : undefined };
    const analysis = ports.analyze(result, localTime, selected, options);
    const seat = ['d', 'e', 'a'].includes(selected.signal) ? selected.channel : Number($<HTMLSelectElement>('seat').value);
    const original = selected.signal === 'd' ? analysis : ports.analyze(result, localTime, { signal: 'd', channel: seat }, options);
    const unavailable = localTime < 0.5 ? halted ? '不足0.5秒' : '准备中' : '声压低于计算底限';
    const kind = selected.signal === 'x' ? config.references[selected.channel]?.name : selected.signal === 'q' ? `Q${selected.channel + 1}` : `${selected.signal.toUpperCase()} ${ORDER[selected.channel]?.toUpperCase()}`;
    $('signal-title').textContent = `时域 · ${kind}`;
    $('spectrum-title').textContent = `频谱 · ${kind}`;
    const mixed = analysis.unit !== 'Pa';
    root.querySelectorAll<HTMLInputElement>('[data-axis-auto="rightY"]').forEach(input => { input.closest('fieldset')!.hidden = !mixed; });
    for (const chart of ['wave','spectrum'] as const) {
      const show = chartSettings[chart].showOriginal;
      $(chart+'-legend').innerHTML = `${show ? `<span class="lab-original-key">原声 d · ${ORDER[seat].toUpperCase()}${mixed ? '（右轴）' : ''}</span>` : ''}${selected.signal === 'd' ? '' : `<span class="lab-result-key">${kind}${mixed && show ? '（左轴）' : ''}</span>`}`;
    }
    drawSignalComparison($('wave'), analysis, original, config.sampleRateHz, offset, false, selected.signal === 'd', undefined, chartSettings.wave);
    drawSignalComparison($('spectrum'), analysis, original, config.sampleRateHz, offset, true, selected.signal === 'd', undefined, chartSettings.spectrum);
    if (liveSession && localTime >= 0.5 && time - (curves.A.at(-1)?.time ?? 0) >= 0.1) {
      for (const weighting of ['A', 'Z'] as const) {
        curves[weighting].push(splFrame(time, weighting === levelWeighting ? analysis : ports.analyze(result, localTime, selected, { levelWeighting: weighting, levelsOnly: true })));
      }
    }
    drawSpl(time);
    $('metrics').innerHTML = ORDER.map((corner, i) => `<div><strong>${corner.toUpperCase()}</strong><b>${analysis.reductionDb[i] === null ? unavailable : analysis.reductionDb[i]!.toFixed(1) + ' dB'}</b><small>${analysis.primarySpl[i]?.toFixed(1) ?? '—'} → ${analysis.residualSpl[i]?.toFixed(1) ?? '—'} ${levelUnit()}</small></div>`).join('');
  }
  async function calculate() {
    if (mountIssues().length) { $('status').textContent = '请先修正缺失的传感器安装部件。'; return; }
    try { supportedLabLayoutId(config); }
    catch (error) { $('status').textContent = error instanceof Error ? error.message : String(error); return; }
    if (realtime) { await startLive(); return; }
    const token = ++generation; ports.cancel(); busy = true; clearExperiment();
    for (const name of ['play', 'replay', 'seek', 'calculate']) $<HTMLButtonElement>(name).disabled = true;
    $<HTMLButtonElement>('cancel').disabled = false; $('status').textContent = '正在计算真实动态MIMO实验…';
    const runId = crypto.randomUUID();
    try {
      const computed = await ports.calculate(structuredClone(config), runId);
      if (token !== generation) return;
      result = computed;
      updateRoadNote();
      let audioGain=0;
      if (computed.divergence) stopDiverged(computed.divergence);
      else { const audio=prepareLabPlayback(computed); player.load(audio.result); audioGain=audio.gain; }
      player.setComparison(ORDER[Number($<HTMLSelectElement>('seat').value)], audition);
      curves = { A: [], Z: [] };
      for (let frame = 5; frame <= result.sampleCount / config.sampleRateHz * 10; frame++) { const time = frame / 10; for (const weighting of ['A','Z'] as const) curves[weighting].push(splFrame(time, ports.analyze(result, time, selected, { levelWeighting: weighting, levelsOnly: true }))); }
      $('run').textContent = `${VEHICLE_NAMES[result.config.vehicle]} · 布局 ${labLayoutId(result.config)} · ${result.config.references.length}×4×4 · ${result.runId.slice(0, 8)}`;
      $('status').textContent = `实验就绪 · ${result.computeMilliseconds.toFixed(0)} ms · 末${Math.min(4, config.durationSeconds)}秒线性总改善 ${result.metrics.aggregateReductionDb.toFixed(1)} dB（教学模型）；四座位d/e共用试听衰减 ${audioGain.toFixed(3)}`;
      for (const name of ['play', 'replay', 'seek']) $<HTMLButtonElement>(name).disabled = false;
      if (halted) stopDiverged(halted);
      lastFieldAt = -1; fieldPending = false; draw();
    } catch (error) { if (token === generation) $('status').textContent = `计算未完成：${error instanceof Error ? error.message : String(error)}`; }
    finally { if (token === generation) { busy = false; $<HTMLButtonElement>('calculate').disabled = false; $<HTMLButtonElement>('cancel').disabled = true; renderCase(); } }
  }
  async function startLive() {
    try { supportedLabLayoutId(config); }
    catch (error) { $('status').textContent = error instanceof Error ? error.message : String(error); return; }
    const token = ++generation; ports.cancel(); busy = true; clearExperiment();
    for (const name of ['play', 'replay', 'seek', 'calculate']) $<HTMLButtonElement>(name).disabled = true;
    $<HTMLButtonElement>('cancel').disabled = false; $('status').textContent = '正在启动持续计算与同步试听…';
    const id = crypto.randomUUID();
    try {
      // Resume audio within the user's gesture; the worker does not precalculate an entire experiment.
      await Promise.all([livePlayer.start(), ports.startLive(structuredClone({ ...config, rncEnabled: liveRncEnabled }), id)]);
      if (token !== generation) return;
      if (document.hidden) { livePlayer.pause(); backgroundPaused = true; }
      liveSession = true;
      livePlayer.setComparison(ORDER[Number($<HTMLSelectElement>('seat').value)], 'e');
      $('run').textContent = `${VEHICLE_NAMES[config.vehicle]} · 布局 ${labLayoutId(config)} · 实时 ${config.references.length}×4×4 · ${id.slice(0, 8)}`;
      for (const name of ['play', 'replay']) $<HTMLButtonElement>(name).disabled = false;
      await pumpLive();
    } catch (error) {
      if (token === generation) { ports.cancel(); clearExperiment(); $('status').textContent = `实时启动失败：${String(error)}`; }
    } finally {
      if (token === generation) { busy = false; $<HTMLButtonElement>('calculate').disabled = false; $<HTMLButtonElement>('cancel').disabled = !liveSession; }
    }
  }
  function stopDiverged(detail: LabDivergence) {
    halted=detail; livePlayer.pause(); player.pause(); clearField();
    for (const name of ['play','seek','rnc-on']) $<HTMLButtonElement>(name).disabled=true;
    $('play').textContent='已发散 · 已暂停'; $('replay').textContent='重新开始';
    $('status').textContent=detail.message;
    renderCase();
  }
  // Cover observed ~0.6 s first-view and ~1 s tab-scheduling stalls. Each pull
  // adds 0.2 s, so the queue stays below the player's 2 s hard limit and the
  // 8.192 s rolling snapshot still contains the 5 s waveform at the
  // audio clock time. Rendering never follows the producer's ahead position.
  const liveBufferTargetSeconds = 1.2;
  async function pumpLive() {
    if (halted || !liveSession || !livePlayer.playing || livePullPending) return;
    const token = generation; livePullPending = true;
    try {
      while (token === generation && liveSession && livePlayer.playing && livePlayer.bufferedUntil - livePlayer.currentTime < liveBufferTargetSeconds) {
        const remaining = LAB_LIVE_LIMIT_SECONDS * config.sampleRateHz - Math.round(livePlayer.bufferedUntil * config.sampleRateHz);
        if (remaining <= 0) { livePlayer.finish(); break; }
        const packet = await ports.pullLive(Math.min(400, remaining));
        if (token !== generation) return;
        const firstPacket = !result;
        liveSnapshot = packet.snapshot; result = packet.snapshot.result;
        if (packet.chunk.divergence) { stopDiverged(packet.chunk.divergence); draw(); break; }
        livePlayer.enqueue(packet.chunk);
        if (firstPacket) updateRoadNote();
      }
    } catch (error) {
      if (token === generation) { dirty(); $('status').textContent = `实时运行已停止：${String(error)}`; }
    } finally { if (token === generation) livePullPending = false; }
  }
  $('mode').onchange = () => {
    realtime = $<HTMLSelectElement>('mode').value === 'live'; dirty();
  };
  $('source-mode').onchange = () => { config.sourceMode = $<HTMLSelectElement>('source-mode').value as LabConfig['sourceMode']; dirty(); };
  $<HTMLSelectElement>('vehicle').onchange = event => { config.vehicle = (event.target as HTMLSelectElement).value as VehicleKind; dirty(); };
  $('duration').onchange = () => { config.durationSeconds = Number($<HTMLSelectElement>('duration').value); dirty(); };
  const numeric = { speed: 'speedKph', road: 'roadRoughness', tread: 'treadRoughness', pressure: 'pressureKpa', temperature: 'temperatureC', taps: 'taps', step: 'stepSize', 'level-offset': 'levelOffsetDb' } as const;
  for (const [id, key] of Object.entries(numeric)) $<HTMLInputElement>(id).onchange = () => {
    config[key as typeof numeric[keyof typeof numeric]] = Number($<HTMLInputElement>(id).value);
    const output = root.querySelector(`#lab-${id}-value`); if (output) output.textContent = $<HTMLInputElement>(id).value; dirty();
    if (id === 'road') updateRoadNote();
  };
  $<HTMLInputElement>('rnc').onchange = () => { config.rncEnabled = $<HTMLInputElement>('rnc').checked; dirty(); };
  $<HTMLInputElement>('edit').onchange = () => { viewer.setEditMode($<HTMLInputElement>('edit').checked); refreshConfig(); };
  root.querySelectorAll<HTMLInputElement>('[data-speaker]').forEach(input => { input.onchange = () => { const enabled = [...config.speakerEnabled]; enabled[Number(input.dataset.speaker)] = input.checked; config.speakerEnabled = enabled as unknown as LabConfig['speakerEnabled']; dirty(); }; });
  $('calculate').onclick = () => void calculate(); $('cancel').onclick = () => { dirty(); $('status').textContent = realtime ? '实时实验已结束。再次启动将重新学习。' : '计算已取消。'; };
  $('case-save').onclick = () => {
    if (realtime || busy || !result) return;
    try {
      caseBaseline = captureCase(result, ports.analyze(result, result.sampleCount / result.config.sampleRateHz, { signal: 'e', channel: 0 }, { levelWeighting: 'A', levelsOnly: true }));
      renderCase();
    } catch (error) { $('case-state').textContent = error instanceof Error ? error.message : String(error); }
  };
  $('case-clear').onclick = () => { caseBaseline = null; renderCase(); };
  $('case-export').onclick = () => {
    const candidate = candidateCase();
    if (!caseBaseline || !candidate || busy) return;
    try {
      const json = createCaseEvidence(caseBaseline, candidate, $<HTMLTextAreaElement>('case-observation').value, $<HTMLTextAreaElement>('case-next-check').value, new Date().toISOString(), $<HTMLTextAreaElement>('case-interpretation').value, $<HTMLTextAreaElement>('case-decision').value);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `rnc-case-${new Date().toISOString().slice(0, 10)}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('case-evidence-state').textContent = `已导出 ${link.download}；这是教学模型摘要，不含原始信号。`;
    } catch (error) { $('case-evidence-state').textContent = error instanceof Error ? error.message : String(error); }
  };
  $<HTMLInputElement>('case-import').onchange = async event => {
    const input = event.currentTarget as HTMLInputElement, file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const output = $('case-imported'); output.replaceChildren(); output.hidden = true;
    try {
      if (file.size > CASE_EVIDENCE_MAX_BYTES) throw new Error('案例文件超过64 KiB');
      const { evidence, comparison } = parseCaseEvidence(await file.text());
      const heading = document.createElement('strong'); heading.textContent = `导入案例 · ${evidence.question}`;
      const provenance = document.createElement('p');
      const sourceName = (mode: LabConfig['sourceMode']) => mode === 'recorded-noise' ? '实录初级噪声 · 四轮等效声源' : '随机噪声 · 实录谱形整形';
      provenance.textContent = `文件自报时间 ${evidence.createdAt}；A ${evidence.baseline.runId}（${sourceName(evidence.baseline.config.sourceMode)}，布局 ${labLayoutId(evidence.baseline.config)}）→ B ${evidence.candidate.runId}（${sourceName(evidence.candidate.config.sourceMode)}，布局 ${labLayoutId(evidence.candidate.config)}）。`;
      const summary = document.createElement('p');
      summary.textContent = comparison.comparable
        ? `${comparison.changes.length === 1 ? `单变量：${comparison.changes[0]}` : comparison.changes.length > 1 ? `改变 ${comparison.changes.length} 项，不能单因子归因：${comparison.changes.join('、')}` : '配置未改变；重复实验'}。后排 B−A 残余：RL ${caseDelta(comparison.residualDeltaDb[2])} dB，RR ${caseDelta(comparison.residualDeltaDb[3])} dB。`
        : `条件不一致（${comparison.conditions.join('、')}），不计算 A/B 差值。`;
      const table = document.createElement('table');
      const reviewOutput = document.createElement('div'); reviewOutput.className = 'lab-review-facts';
      appendReviewFacts(reviewOutput, evidence.baseline, evidence.candidate);
      const header = document.createElement('tr');
      for (const label of ['座位', 'A 原声 / 残余 / 改善', 'B 原声 / 残余 / 改善', 'B−A 残余']) { const cell = document.createElement('th'); cell.textContent = label; header.append(cell); }
      table.append(header);
      for (let i = 0; i < 4; i++) {
        const row = document.createElement('tr');
        for (const value of [seatNames[i], `${caseLevel(evidence.baseline.primarySpl[i])} / ${caseLevel(evidence.baseline.residualSpl[i])} / ${caseLevel(evidence.baseline.reductionDb[i])}`, `${caseLevel(evidence.candidate.primarySpl[i])} / ${caseLevel(evidence.candidate.residualSpl[i])} / ${caseLevel(evidence.candidate.reductionDb[i])}`, caseDelta(comparison.residualDeltaDb[i])]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
        table.append(row);
      }
      const notes = document.createElement('p'); notes.className = 'lab-review-human'; notes.textContent = `人工观察：${evidence.observation || '未填写'}\n人工解释（待验证）：${evidence.interpretation || '未填写'}\n临时行动：${evidence.decision || '未填写'}\n待补测事项：${evidence.nextCheck || '未填写'}`;
      const boundary = document.createElement('p'); boundary.textContent = CASE_EVIDENCE_BOUNDARY;
      output.append(heading, provenance, summary, reviewOutput, table, notes, boundary); output.hidden = false;
      $('case-evidence-state').textContent = `已导入 ${file.name}；文件内容未经签名验证，仅供只读复核，不改变当前实验。`;
    } catch (error) { $('case-evidence-state').textContent = error instanceof Error ? error.message : String(error); }
  };
  $('body').onchange = () => viewer.setBody($<HTMLSelectElement>('body').value);
  $('explode').onclick = () => { exploded = !exploded; viewer.setExploded(exploded); $('explode').setAttribute('aria-pressed', String(exploded)); };
  $('reset').onclick = () => { viewer.reset(); exploded = false; $('explode').setAttribute('aria-pressed', 'false'); };
  function section() {
    const points = viewer.fieldPoints;
    viewer.setSection($<HTMLSelectElement>('section').value, Number($<HTMLInputElement>('section-position').value));
    if (viewer.fieldPoints !== points) clearField();
  }
  $('section').onchange = section; $('section-position').oninput = section;
  function fieldOptions() { clearField(); viewer.setField($<HTMLSelectElement>('field').value, $<HTMLSelectElement>('field-slice').value as 'volume' | 'x' | 'y' | 'z'); }
  $('field').onchange = fieldOptions; $('field-slice').onchange = fieldOptions;
  $('field-weight').onchange = () => {
    levelWeighting = $<HTMLSelectElement>('field-weight').value as AcousticWeighting;
    $('field-scale').textContent = `30—80 ${levelUnit()}，固定色标；0.5秒RMS`;
    clearField(); if (result) draw();
  };
  $('paths').onchange = () => viewer.setPaths($<HTMLSelectElement>('paths').value);
  $('waves').onchange = () => viewer.setWaves($<HTMLInputElement>('waves').checked);
  async function play(restart = false) { if (!result) return; if (restart) { player.seek(0); clearField(); } try { await player.play(); } catch (e) { $('status').textContent = `音频未启动：${String(e)}`; } }
  $('play').onclick = () => {
    if (halted) return;
    if (liveSession) {
      if (livePlayer.ended) return;
      if (livePlayer.playing || livePlayer.starting) livePlayer.pause();
      else {
        const token = generation;
        void livePlayer.start().then(() => {
          if (token !== generation) return;
          if (document.hidden) { livePlayer.pause(); backgroundPaused = true; } else return pumpLive();
        }).catch(e => { if (token === generation) $('status').textContent = `实时试听未恢复：${String(e)}`; });
      }
    }
    else if (player.playing || player.starting) player.pause(); else void play();
  };
  $('replay').onclick = () => { if (liveSession || halted) void calculate(); else { player.pause(); void play(true); } };
  $('seek').oninput = () => { player.seek(Number($<HTMLInputElement>('seek').value)); clearField(); draw(); };
  function comparison() {
    const seat = Number($<HTMLSelectElement>('seat').value);
    player.setComparison(ORDER[seat], audition); livePlayer.setComparison(ORDER[seat], 'e');
    refreshRncControl();
    draw();
  }
  function refreshRncControl() {
    const enabled = realtime ? liveRncEnabled : audition === 'e';
    const button = $<HTMLButtonElement>('rnc-on');
    button.textContent = enabled ? 'RNC ON' : 'RNC OFF';
    button.setAttribute('aria-pressed', String(enabled));
    button.title = realtime ? '开关实时控制；关闭时冻结权重并将扬声器驱动置零' : '仅切换已计算的残差/原声试听';
    button.disabled = !!halted || realtime && (busy || liveRncPending || (liveSession && livePlayer.bufferedUntil >= LAB_LIVE_LIMIT_SECONDS));
    $('audition-state').textContent = halted ? '发散已暂停 · 试听已停止' : realtime
      ? `实时试听：残差 e · ${liveRncError || (liveRncPending ? '正在切换，随新样本生效' : liveAudibleRnc ? '自适应控制' : '权重冻结 / 输出关闭')}`
      : audition === 'e' ? '回放试听：残差 e' : '回放试听：原始噪声 d';
  }
  async function toggleRnc() {
    if (!realtime) { audition = audition === 'e' ? 'd' : 'e'; comparison(); return; }
    if (liveRncPending || (liveSession && livePlayer.bufferedUntil >= LAB_LIVE_LIMIT_SECONDS)) return;
    const previous = liveRncEnabled, token = generation;
    liveRncEnabled = !previous; liveRncError = '';
    if (!liveSession) { liveAudibleRnc = liveRncEnabled; refreshRncControl(); return; }
    liveRncPending = true; refreshRncControl();
    try {
      const change = await ports.setLiveRnc(liveRncEnabled);
      if (token === generation) liveRncChange = change;
    } catch (error) {
      if (token === generation) { liveRncEnabled = previous; liveRncPending = false; liveRncError = `切换未完成：${String(error)}`; refreshRncControl(); }
    }
  }
  $('seat').onchange = () => {
    // Return from hardware inspection to paired seat pressure traces. Audition stays independent.
    selected = { signal: 'e', channel: Number($<HTMLSelectElement>('seat').value) };
    if (!result) clearPlots();
    comparison();
  };
  $('rnc-on').onclick = () => void toggleRnc();
  $('volume').oninput = () => { const volume = Number($<HTMLInputElement>('volume').value); player.setVolume(volume); livePlayer.setVolume(volume); };
  $('mute').onclick = () => { muted = !muted; player.setMuted(muted); livePlayer.setMuted(muted); $('mute').setAttribute('aria-pressed', String(muted)); };
  root.addEventListener('keydown', event => { if (event.key === 'Escape') $('context').hidden = true; });
  const tick = () => {
    if (disposed) return;
    const active = transport(), time = displayTime(), n = Math.max(0, Math.min((result?.sampleCount ?? 1) - 1, Math.floor((time - timeOffset()) * 2000))), now = performance.now();
    if (liveRncChange && time * config.sampleRateHz >= liveRncChange.effectiveSample) {
      liveAudibleRnc = liveRncChange.enabled; liveRncPending = false; liveRncChange = null;
    }
    refreshRncControl();
    const ended = liveSession && livePlayer.ended;
    $('play').textContent = halted ? '已发散 · 已暂停' : ended ? '已结束' : active.starting ? '启动中' : active.playing ? '暂停' : '播放';
    if (ended || halted) $<HTMLButtonElement>('play').disabled = true;
    $('time').textContent = realtime ? `累计 ${clockText(time)}${ended ? ' · 已结束' : ''}` : `${clockText(time)} / ${clockText(config.durationSeconds)}`; $<HTMLInputElement>('seek').value = String(time);
    viewer.render(time, selected, result?.signals.u.map(signal => signal[n] ?? 0) ?? [], result?.sources.map(signal => signal[n] ?? 0) ?? []);
    flow.render(time, active.playing, !!result && (liveSession ? liveAudibleRnc : result.config.rncEnabled) && result.config.stepSize > 0 && time >= result.config.adaptationStartsSeconds);
    if (liveSession && !halted) {
      void pumpLive();
      if (!busy) $('status').textContent = ended ? '实时实验已达到10分钟运行上限并自动结束；收敛曲线已保留，点击“重新开始”可开启新实验。' : `${livePlayer.starting ? '正在恢复试听' : !livePlayer.playing ? '实时已暂停' : livePlayer.status === 'buffering' ? '等待新样本' : '实时运行'} · ${time.toFixed(1)} s · 缓冲 ${(livePlayer.bufferedUntil - time).toFixed(2)} s · 共同安全增益 ${livePlayer.safetyGain.toFixed(3)} · 补缓冲 ${livePlayer.underruns} 次`;
    }
    if (halted) $('status').textContent=halted.message;
    if (now - lastChart >= 100) { draw(); lastChart = now; }
    if (result && !halted && !busy && $<HTMLSelectElement>('field').value !== 'off' && !fieldPending && fieldInFlight < 2 && now - lastFieldClock > 350 && Math.abs(time - lastFieldAt) > 0.15) {
      const token = generation, epoch = fieldEpoch, points = viewer.fieldPoints;
      fieldPending = true; fieldInFlight++; lastFieldAt = time; lastFieldClock = now;
      ports.field(time, points, levelWeighting).then(frame => { if (token === generation && epoch === fieldEpoch) { viewer.updateField(frame); $('field-status').textContent = frame.valid ? `空间窗口截至 ${frame.time.toFixed(2)} s` : frame.time < 0.5 ? '声场准备中，需要0.5秒数据' : '当前工况声压低于计算底限（如停车），无有效声场'; } }).catch(error => { if (token === generation && epoch === fieldEpoch) $('field-status').textContent = `声场计算失败：${String(error)}`; }).finally(() => { fieldInFlight--; if (token === generation && epoch === fieldEpoch) fieldPending = false; });
    }
    requestAnimationFrame(tick);
  };
  const visibility = () => {
    if (document.hidden && realtime && (liveSession || busy || livePlayer.starting || livePlayer.playing)) { livePlayer.pause(); backgroundPaused = true; }
    else if (!document.hidden && backgroundPaused) { backgroundPaused = false; $('status').textContent = '后台期间实时实验已暂停，请点击播放继续。'; draw(); }
  };
  document.addEventListener('visibilitychange', visibility);
  // Audio startup requires the user's gesture. Loading the page only prepares live controls.
  refreshConfig(); clearPlots(); renderCase(); requestAnimationFrame(tick);
  return () => { disposed = true; ++generation; ++fieldEpoch; liveSession = false; livePullPending = false; document.removeEventListener('visibilitychange', visibility); narrowViewport.removeEventListener('change', onNarrowViewport); player.pause(); livePlayer.dispose(); ports.cancel(); viewer.dispose(); flow.dispose(); root.replaceChildren(); };
}
