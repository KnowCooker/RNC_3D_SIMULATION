import { ORDER } from '../../shared/contracts';
import { defaultLabConfig, labDurationLimit, VEHICLE_NAMES, type AcousticWeighting, type LabAnalysisOptions, type FieldFrame, type LabAnalysis, type LabConfig, type LabLivePacket, type LabLiveSnapshot, type LabResult, type LabSelection, type Vec3, type VehicleKind } from '../../shared/lab-contracts';
import { Player, prepareLabPlayback } from '../player';
import { LivePlayer } from '../player/live-player';
import { createLabViewer } from '../viewer/lab-viewer';
import { createSignalFlow } from './signal-flow';
import { drawSignalComparison, plot, splFrame, splRange, visibleSplFrames, ORIGINAL_COLOR, RESULT_COLOR, type SplFrame } from './plots';
import './style.css';

export interface LabPorts {
  calculate(config: LabConfig, runId: string): Promise<LabResult>;
  startLive(config: LabConfig, runId: string): Promise<void>;
  pullLive(sampleCount: number): Promise<LabLivePacket>;
  field(time: number, points: Vec3[], weighting?: AcousticWeighting): Promise<FieldFrame>;
  cancel(): void;
  analyze(result: LabResult, time: number, selection: LabSelection, options?: LabAnalysisOptions): LabAnalysis;
}
const types = ['ice', 'bev', 'hev', 'erev'] as const;
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
    <div class="lab-disclosure">实录频谱驱动的合成信号 · 基准：纯电 / 40 km/h / 粗糙路 · 合成空间路径 · <span id="lab-disclosure-mode">16秒预计算回放</span> · 实录为未校准V；图中Pa/SPL为教学尺度，非实测声压</div>
    <main class="lab-main"><aside class="lab-controls">
      <h2>01 / 车辆与工况</h2><label>运行方式<select id="lab-mode"><option value="replay">计算后回放</option><option value="live">实时连续仿真</option></select></label><p id="lab-mode-help">一次计算完整实验，可定位和重放。</p><label>动力类型<select id="lab-vehicle">${types.map(key => `<option value="${key}" ${key === 'bev' ? 'selected' : ''}>${VEHICLE_NAMES[key]}</option>`).join('')}</select></label><p id="lab-architecture"></p>
      <label>车速 / km/h<input id="lab-speed" type="range" min="0" max="130" step="5" value="60"><output id="lab-speed-value">60</output></label>
      <label>路面粗糙度 / 相对值<input id="lab-road" type="range" min="0.1" max="3" step="0.1" value="1"><output id="lab-road-value">1</output></label>
      <label>胎面粗糙度 / 相对值<input id="lab-tread" type="range" min="0.1" max="3" step="0.1" value="1"><output id="lab-tread-value">1</output></label>
      <div class="lab-pair"><label>胎压 / kPa<input id="lab-pressure" type="number" min="160" max="320" value="240"></label><label>温度 / °C<input id="lab-temperature" type="number" min="-20" max="50" value="20"></label></div>
      <p class="lab-help">实录频谱基准为40 km/h粗糙路，粗糙度1代表该相对基准。车速/粗糙度缩放能量，胎压/温度伸缩谱形，均为教学外推；保留实录低频，不加入固定纯音。</p>
      <label>教学声压修正 / dB<input id="lab-level-offset" type="number" min="-12" max="12" step="1" value="0"></label><p class="lab-help">40 km/h基准工况四座平均约60 dBA（0–1 kHz），属教学标定；不是原始V换算的实测值。</p><label>预计算时长 / s<input id="lab-duration" type="number" min="1" step="1" value="16"></label><p id="lab-duration-help" class="lab-help"></p><h2>02 / 算法与改制</h2><div class="lab-pair"><label>NFxLMS 系数数<input id="lab-taps" type="number" min="16" max="128" step="1" value="64"></label><label>归一化步长 μ<input id="lab-step" type="number" min="0" max="0.5" step="0.01" value="0.08"></label></div><p class="lab-help">FIR数学阶数为系数数减1。参数/改制变化将结束当前运行并重新开始学习。</p>
      <label class="lab-check"><input id="lab-rnc" type="checkbox" checked>启用 RNC（更改后重算）</label>
      <label class="lab-check"><input id="lab-edit" type="checkbox">车辆改制：点击结构添加参考传感器</label><p class="lab-help">参考1–8个；右击标记可查看或移除。误差点固定。所有改制将要求重新计算。</p><div id="lab-references"></div><p id="lab-mount-warning" role="status" hidden></p>
      <fieldset><legend>车门扬声器</legend><div id="lab-speakers">${ORDER.map((name, i) => `<label class="lab-check"><input type="checkbox" data-speaker="${i}" checked>${name.toUpperCase()}</label>`).join('')}</div></fieldset>
      <button id="lab-calculate" class="lab-primary">计算当前实验</button><button id="lab-cancel" disabled>取消计算</button><p id="lab-status" role="status">准备计算默认实验</p>
    </aside><section class="lab-workspace"><div class="lab-view-heading"><h2>03 / 结构与空间声场</h2><span id="lab-run">尚无实验结果</span></div>
      <div id="lab-viewer"><span class="lab-view-help">左键旋转 · 滚轮缩放 · 右击硬件查看信号</span></div>
      <div class="lab-view-tools"><label>车身<select id="lab-body"><option value="transparent">透明</option><option value="solid">实体</option><option value="hidden">隐藏</option></select></label><button id="lab-explode" aria-pressed="false">分解动画</button><button id="lab-reset">复位</button><label>剖面<select id="lab-section"><option value="none">关闭</option><option value="x">纵剖 X</option><option value="y">水平 Y</option><option value="z">横剖 Z</option></select></label><label>剖面位置 / m<input id="lab-section-position" type="range" min="-2.5" max="2.5" step="0.05" value="0"></label></div>
      <div class="lab-view-tools"><label>声压场<select id="lab-field"><option value="off">关闭</option><option value="residual">残余 e / SPL</option><option value="primary">原始 d / SPL</option></select></label><label>场显示<select id="lab-field-slice"><option value="volume">三维采样体</option><option value="x">中央纵切片</option><option value="y">头部水平切片</option><option value="z">前排横切片</option></select></label><label>传播路径<select id="lab-paths"><option value="none">关闭</option><option value="primary">初级路径</option><option value="secondary">次级路径</option><option value="both">全部</option></select></label><label class="lab-check"><input id="lab-waves" type="checkbox">扬声器波前</label></div>
      <div class="lab-field-note"><span class="lab-colorbar"></span><span id="lab-field-scale">30—80 dBA，固定色标；0.5秒RMS</span><span id="lab-field-status">声场未开启</span></div><p class="lab-help">空间场由四轮源和实际扬声器驱动经同一传播模型计算。爆炸只改变展示坐标；波前/路径动画为慢放示意，非实际声速。闭合实体按真实截面封口；薄面和开管仅显示截线。</p>
      <div id="lab-metrics" class="lab-metrics"></div><section class="lab-signals"><h2>04 / 信号流与控制机理</h2><div id="lab-flow"></div></section>
    </section></main>
    <div class="lab-view-tools lab-analysis-tools"><label>声压频谱计权<select id="lab-spectrum-weight"><option value="A">A 计权</option><option value="Z">线性（Z）</option></select></label><label>总声压级<select id="lab-level-weight"><option value="A">dBA</option><option value="Z">dB（线性 / Z）</option></select></label><label>频谱下限 / Hz<input id="lab-freq-min" type="number" min="0" max="999" value="20"></label><label>频谱上限 / Hz<input id="lab-freq-max" type="number" min="1" max="1000" value="500"></label><span id="lab-analysis-help">计权仅用于分析；时域和试听保持原信号。总声压级统计0–1 kHz，不随频谱显示范围改变。</span></div><section class="lab-plots">
      <article><h3 id="lab-signal-title">误差声压 e</h3><p id="lab-wave-legend" class="lab-plot-legend"></p><canvas id="lab-wave" aria-label="时域图：所选信号与原始噪声"></canvas></article>
      <article><h3 id="lab-spectrum-title">单边 PSD · Hann 1024</h3><p id="lab-spectrum-legend" class="lab-plot-legend"></p><canvas id="lab-spectrum" aria-label="频域图：所选信号与原始噪声"></canvas></article>
      <section class="lab-convergence-panel"><h3 id="lab-convergence-title">收敛 · 总声压级</h3><p class="lab-plot-legend"><span class="lab-original-key">原始噪声 d</span><span class="lab-result-key">降噪后 e</span> · <span id="lab-level-legend">0–1 kHz / A计权 / 0.5秒窗口</span></p><p id="lab-convergence-status" class="lab-help">从首个有效窗口开始，随播放时间刷新；实时模式保留最近120秒。</p><canvas id="lab-convergence" aria-label="所选座位总声压级收敛图"></canvas></section>
    </section>
    <footer class="lab-player"><button id="lab-play" disabled>播放</button><button id="lab-replay" disabled>重播</button><span id="lab-time">0.00 / 16 s</span><input id="lab-seek" aria-label="播放进度" type="range" min="0" max="16" step="0.01" value="0" disabled><label>座位（图表 / 试听）<select id="lab-seat">${seatNames.map((name, i) => `<option value="${i}">${name}</option>`).join('')}</select></label><button id="lab-rnc-on" aria-pressed="true" aria-describedby="lab-audition-state" title="仅切换原声/降噪后试听，不重置实验">RNC ON</button><span id="lab-audition-state" role="status">正在试听：降噪后 e</span><label>音量<input id="lab-volume" aria-label="音量" type="range" min="0" max="0.5" step="0.01" value="0.15"></label><button id="lab-mute" aria-pressed="false">静音</button></footer>
    <div id="lab-context" class="lab-context" role="menu" hidden></div><details class="lab-sources"><summary>公开依据与模型限制</summary><p>结构参考 DOE AFDC、Toyota RAV4 Hybrid、VW ID.4、Stellantis C10 REEV；原型外形为原创，不冒充其量产车型。硬件位置参考 EP3156998B1。源谱/传递参数为有依据的教学假设，尚未实车标定；模型精细度仍在改进。</p><a href="https://afdc.energy.gov/vehicles/how-do-hybrid-electric-cars-work" target="_blank" rel="noreferrer">DOE 结构原理</a> · <a href="https://patents.google.com/patent/EP3156998B1/en" target="_blank" rel="noreferrer">RNC硬件专利</a><p>更完整的逐项来源与适用边界见仓库 docs/research。完整目标仍在开发验证中。</p></details>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#lab-${id}`)!;
  const player = new Player(); player.setVolume(0.15);
  const livePlayer = new LivePlayer(); livePlayer.setVolume(0.15);
  let config = defaultLabConfig(), result: LabResult | null = null, selected: LabSelection = { signal: 'e', channel: 0 };
  let generation = 0, busy = false, exploded = false, muted = false, nextReference = 5, disposed = false;
  let realtime = false, liveSession = false, livePullPending = false, liveSnapshot: LabLiveSnapshot | null = null;
  let backgroundPaused = false, audition: 'd' | 'e' = 'e';
  let fieldPending = false, fieldInFlight = 0, fieldEpoch = 0, lastFieldAt = -1, lastFieldClock = 0, lastChart = 0;
  let curves: Record<AcousticWeighting, SplFrame[]> = { A: [], Z: [] };
  let spectrumWeighting: AcousticWeighting = 'A', levelWeighting: AcousticWeighting = 'A';
  let frequencyRange: [number, number] = [20, 500];
  const levelUnit = () => levelWeighting === 'A' ? 'dBA' : 'dB';
  const flow = createSignalFlow($('flow'), (signal, channel) => select({ signal, channel }));
  const viewer = createLabViewer($('viewer'), { select, add: addReference, context });
  const transport = () => liveSession ? livePlayer : player;
  const timeOffset = () => liveSnapshot ? liveSnapshot.startSample / config.sampleRateHz : 0;
  const mountIssues = () => (viewer as typeof viewer & { getMountIssues?: () => { sensorId: string; mountPart: string }[] }).getMountIssues?.() ?? [];
  function select(value: LabSelection) {
    selected = value; flow.setSelected(value.signal, value.channel);
    if (['d', 'e'].includes(value.signal)) {
      $<HTMLSelectElement>('seat').value = String(value.channel); audition = value.signal as 'd' | 'e';
      $('rnc-on').setAttribute('aria-pressed', String(audition === 'e'));
      $('audition-state').textContent = audition === 'e' ? '正在试听：降噪后 e' : '正在试听：原始噪声 d';
      player.setComparison(ORDER[value.channel], value.signal as 'd' | 'e');
      livePlayer.setComparison(ORDER[value.channel], value.signal as 'd' | 'e');
    }
    $('context').hidden = true; draw();
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
    const limit = labDurationLimit(config);
    $<HTMLInputElement>('duration').max = String(limit);
    $<HTMLInputElement>('duration').disabled = realtime;
    $<HTMLInputElement>('seek').max = String(config.durationSeconds);
    $('duration-help').textContent = realtime ? '实时模式持续计算，无固定截止时间；使用有界历史缓存。' : `当前配置上限 ${limit} 秒（保守256 MiB工作预算）；参考越多上限越低，实际速度取决于设备。超过录音长度时连续合成新样本。`;
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
    result = null; liveSession = false; livePullPending = false; liveSnapshot = null; backgroundPaused = false; livePlayer.reset();
    curves = { A: [], Z: [] };
    player.pause(); player.seek(0); clearField(); clearPlots();
    $('metrics').replaceChildren(); $('run').textContent = '尚无当前实验结果';
    $('signal-title').textContent = '波形：等待当前实验'; $('spectrum-title').textContent = 'PSD：等待当前实验';
  }
  function dirty() {
    ++generation; ports.cancel(); busy = false; clearExperiment();
    $('status').textContent = realtime ? '配置已改变，请启动新的实时实验；学习状态已重置。' : '配置已改变，请重新计算。旧结果已停止展示。'; $('run').textContent = '待计算配置'; $('metrics').replaceChildren();
    for (const name of ['play', 'replay', 'seek']) ($<HTMLButtonElement>(name)).disabled = true;
    $<HTMLButtonElement>('calculate').disabled = false; $<HTMLButtonElement>('cancel').disabled = true;
    refreshConfig(); clearPlots();
  }
  function addReference(position: Vec3, mountPart?: string) {
    if (config.references.length >= 8) { $('status').textContent = '当前计算上限为8个参考传感器，可先移除已有传感器。'; return; }
    const id = nextReference++;
    config.references.push({ id: `ref-${id}`, name: `REF ${id}`, position, mountPart }); dirty();
  }
  function drawSpl(time: number) {
    const visible = visibleSplFrames(curves[levelWeighting], time, 0.5), range = splRange(visible);
    const start = Math.max(0.5, time - 120), end = Math.max(start + 1, time);
    const mic = Number($<HTMLSelectElement>('seat').value);
    $('convergence-title').textContent = `收敛 · ${seatNames[mic]} · 总声压级`;
    $('convergence').setAttribute('aria-label', `${seatNames[mic]}总声压级收敛图`);
    plot($<HTMLCanvasElement>('convergence'), [
        { x: visible.map(f => f.time), values: visible.map(f => f.primary[mic]), color: ORIGINAL_COLOR },
        { x: visible.map(f => f.time), values: visible.map(f => f.residual[mic]), color: RESULT_COLOR },
      ], { x: [start, end], y: range, xLabel: '实验时间 / s', yLabel: `总声压级 / ${levelUnit()}`,
        empty: time < 0.5 ? '采集中 · 首窗 0.5 s' : '声压低于计算底限' });
    $('convergence-status').textContent = `截至 ${time.toFixed(2)} s · 0.5秒窗口 · ${liveSession ? '最近120秒' : '随播放显示，无未来数据'}`;
  }
  function clearPlots() {
    plot($('wave'), [], { x: [0, 0.2], y: [-1, 1], xLabel: '实验时间 / s', yLabel: 'Pa' });
    plot($('spectrum'), [], { x: frequencyRange, y: [-140, 20], xLabel: '频率 / Hz', yLabel: 'PSD / dB' });
    drawSpl(0);
  }
  function draw() {
    if (!result) return;
    const time = transport().currentTime, offset = timeOffset(), localTime = Math.max(0, time - offset);
    const options = { spectrumWeighting, levelWeighting };
    const analysis = ports.analyze(result, localTime, selected, options);
    const seat = ['d', 'e', 'a'].includes(selected.signal) ? selected.channel : Number($<HTMLSelectElement>('seat').value);
    const original = selected.signal === 'd' ? analysis : ports.analyze(result, localTime, { signal: 'd', channel: seat }, options);
    const unavailable = localTime < 0.5 ? '准备中' : '声压低于计算底限';
    const kind = selected.signal === 'x' ? config.references[selected.channel]?.name : selected.signal === 'q' ? `Q${selected.channel + 1}` : `${selected.signal.toUpperCase()} ${ORDER[selected.channel]?.toUpperCase()}`;
    $('signal-title').textContent = `时域 · ${kind} / ${analysis.unit}`;
    $('spectrum-title').textContent = `频域 · ${kind} · PSD · ${analysis.spectrumWeighting}计权 · ${analysis.spectrum ? 'Hann 1024' : '需0.512秒数据'}`;
    const mixed = analysis.unit !== 'Pa';
    const legend = `<span class="lab-original-key">原声 d · ${ORDER[seat].toUpperCase()}${mixed ? '（右轴 Pa）' : ''}</span>${selected.signal === 'd' ? '' : `<span class="lab-result-key">${kind}${mixed ? '（左轴）' : ''}</span>`}`;
    $('wave-legend').innerHTML = legend;
    $('spectrum-legend').innerHTML = legend.replace('右轴 Pa', '右轴') + `<span> dB re 1 (${analysis.unit})²/Hz${mixed ? `；原声 re 1 Pa²/Hz（${spectrumWeighting}计权）；非声压通道保持线性` : ''}</span>`;
    drawSignalComparison($('wave'), analysis, original, config.sampleRateHz, offset, false, selected.signal === 'd');
    drawSignalComparison($('spectrum'), analysis, original, config.sampleRateHz, offset, true, selected.signal === 'd', frequencyRange);
    if (liveSession && localTime >= 0.5 && time - (curves.A.at(-1)?.time ?? 0) >= 0.1) {
      for (const weighting of ['A', 'Z'] as const) {
        curves[weighting].push(splFrame(time, weighting === levelWeighting ? analysis : ports.analyze(result, localTime, selected, { levelWeighting: weighting, levelsOnly: true })));
        while (curves[weighting].length && curves[weighting][0].time < time - 120) curves[weighting].shift();
      }
    }
    drawSpl(time);
    $('metrics').innerHTML = ORDER.map((corner, i) => `<div><strong>${corner.toUpperCase()}</strong><b>${analysis.reductionDb[i] === null ? unavailable : analysis.reductionDb[i]!.toFixed(1) + ' dB'}</b><small>${analysis.primarySpl[i]?.toFixed(1) ?? '—'} → ${analysis.residualSpl[i]?.toFixed(1) ?? '—'} ${levelUnit()}</small></div>`).join('');
  }
  async function calculate() {
    if (mountIssues().length) { $('status').textContent = '请先修正缺失的传感器安装部件。'; return; }
    if (realtime) { await startLive(); return; }
    const token = ++generation; ports.cancel(); busy = true; clearExperiment();
    for (const name of ['play', 'replay', 'seek', 'calculate']) $<HTMLButtonElement>(name).disabled = true;
    $<HTMLButtonElement>('cancel').disabled = false; $('status').textContent = '正在计算真实动态MIMO实验…';
    const runId = crypto.randomUUID();
    try {
      const computed = await ports.calculate(structuredClone(config), runId);
      if (token !== generation) return;
      result = computed;
      const audio = prepareLabPlayback(computed); player.load(audio.result);
      player.setComparison(ORDER[Number($<HTMLSelectElement>('seat').value)], audition);
      curves = { A: [], Z: [] };
      for (let frame = 5; frame <= config.durationSeconds * 10; frame++) { const time = frame / 10; for (const weighting of ['A','Z'] as const) curves[weighting].push(splFrame(time, ports.analyze(result, time, selected, { levelWeighting: weighting, levelsOnly: true }))); }
      $('run').textContent = `${VEHICLE_NAMES[result.config.vehicle]} · ${result.config.references.length}×4×4 · ${result.runId.slice(0, 8)}`;
      $('status').textContent = `实验就绪 · ${result.computeMilliseconds.toFixed(0)} ms · 末${Math.min(4, config.durationSeconds)}秒线性总改善 ${result.metrics.aggregateReductionDb.toFixed(1)} dB（教学模型）；四座位d/e共用试听衰减 ${audio.gain.toFixed(3)}`;
      for (const name of ['play', 'replay', 'seek']) $<HTMLButtonElement>(name).disabled = false;
      lastFieldAt = -1; fieldPending = false; draw();
    } catch (error) { if (token === generation) $('status').textContent = `计算未完成：${error instanceof Error ? error.message : String(error)}`; }
    finally { if (token === generation) { busy = false; $<HTMLButtonElement>('calculate').disabled = false; $<HTMLButtonElement>('cancel').disabled = true; } }
  }
  async function startLive() {
    const token = ++generation; ports.cancel(); busy = true; clearExperiment();
    for (const name of ['play', 'replay', 'seek', 'calculate']) $<HTMLButtonElement>(name).disabled = true;
    $<HTMLButtonElement>('cancel').disabled = false; $('status').textContent = '正在启动持续计算与同步试听…';
    const id = crypto.randomUUID();
    try {
      // Resume audio within the user's gesture; the worker does not precalculate an entire experiment.
      await Promise.all([livePlayer.start(), ports.startLive(structuredClone(config), id)]);
      if (token !== generation) return;
      if (document.hidden) { livePlayer.pause(); backgroundPaused = true; }
      liveSession = true;
      livePlayer.setComparison(ORDER[Number($<HTMLSelectElement>('seat').value)], audition);
      $('run').textContent = `${VEHICLE_NAMES[config.vehicle]} · 实时 ${config.references.length}×4×4 · ${id.slice(0, 8)}`;
      for (const name of ['play', 'replay']) $<HTMLButtonElement>(name).disabled = false;
      await pumpLive();
    } catch (error) {
      if (token === generation) { ports.cancel(); clearExperiment(); $('status').textContent = `实时启动失败：${String(error)}`; }
    } finally {
      if (token === generation) { busy = false; $<HTMLButtonElement>('calculate').disabled = false; $<HTMLButtonElement>('cancel').disabled = !liveSession; }
    }
  }
  // Cover observed ~0.6 s first-view and ~1 s tab-scheduling stalls. Each pull
  // adds 0.2 s, so the queue stays below the player's 2 s hard limit and the
  // 2.048 s rolling snapshot still contains the 0.5 s analysis window at the
  // audio clock time. Rendering never follows the producer's ahead position.
  const liveBufferTargetSeconds = 1.2;
  async function pumpLive() {
    if (!liveSession || !livePlayer.playing || livePullPending) return;
    const token = generation; livePullPending = true;
    try {
      while (token === generation && liveSession && livePlayer.playing && livePlayer.bufferedUntil - livePlayer.currentTime < liveBufferTargetSeconds) {
        const packet = await ports.pullLive(400);
        if (token !== generation) return;
        livePlayer.enqueue(packet.chunk); liveSnapshot = packet.snapshot; result = packet.snapshot.result;
      }
    } catch (error) {
      if (token === generation) { dirty(); $('status').textContent = `实时运行已停止：${String(error)}`; }
    } finally { if (token === generation) livePullPending = false; }
  }
  $('mode').onchange = () => {
    realtime = $<HTMLSelectElement>('mode').value === 'live'; dirty();
    refreshConfig();
    $('mode-help').textContent = realtime ? '持续产生新样本，保留滤波器与权重；暂停冻结时间。修改参数需重新启动。试听八路共用动态安全包络，不改变物理数据。' : '一次计算完整实验，可定位和重放。';
    $('calculate').textContent = realtime ? '启动 / 重启实时实验' : '计算当前实验';
    $('cancel').textContent = realtime ? '结束实时实验' : '取消计算';
    $('replay').textContent = realtime ? '重新开始' : '重播';
  };
  $<HTMLSelectElement>('vehicle').onchange = event => { config.vehicle = (event.target as HTMLSelectElement).value as VehicleKind; dirty(); };
  const numeric = { speed: 'speedKph', road: 'roadRoughness', tread: 'treadRoughness', pressure: 'pressureKpa', temperature: 'temperatureC', taps: 'taps', step: 'stepSize', duration: 'durationSeconds', 'level-offset': 'levelOffsetDb' } as const;
  for (const [id, key] of Object.entries(numeric)) $<HTMLInputElement>(id).onchange = () => {
    config[key as typeof numeric[keyof typeof numeric]] = Number($<HTMLInputElement>(id).value);
    const output = root.querySelector(`#lab-${id}-value`); if (output) output.textContent = $<HTMLInputElement>(id).value; dirty();
  };
  $<HTMLInputElement>('rnc').onchange = () => { config.rncEnabled = $<HTMLInputElement>('rnc').checked; dirty(); };
  $<HTMLInputElement>('edit').onchange = () => { viewer.setEditMode($<HTMLInputElement>('edit').checked); refreshConfig(); };
  root.querySelectorAll<HTMLInputElement>('[data-speaker]').forEach(input => { input.onchange = () => { const enabled = [...config.speakerEnabled]; enabled[Number(input.dataset.speaker)] = input.checked; config.speakerEnabled = enabled as unknown as LabConfig['speakerEnabled']; dirty(); }; });
  $('calculate').onclick = () => void calculate(); $('cancel').onclick = () => { dirty(); $('status').textContent = realtime ? '实时实验已结束。再次启动将重新学习。' : '计算已取消。'; };
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
  $('paths').onchange = () => viewer.setPaths($<HTMLSelectElement>('paths').value);
  function analysisOptions() {
    spectrumWeighting = $<HTMLSelectElement>('spectrum-weight').value as AcousticWeighting;
    levelWeighting = $<HTMLSelectElement>('level-weight').value as AcousticWeighting;
    $('level-legend').textContent = `0–1 kHz / ${levelWeighting}计权 / 0.5秒窗口`;
    $('field-scale').textContent = `30—80 ${levelUnit()}，固定色标；0.5秒RMS`;
    clearField(); if (result) draw(); else clearPlots();
  }
  $('spectrum-weight').onchange = analysisOptions; $('level-weight').onchange = analysisOptions;
  function frequencyOptions() {
    const min = Number($<HTMLInputElement>('freq-min').value), max = Number($<HTMLInputElement>('freq-max').value);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 1000 || min >= max) {
      $('analysis-help').textContent = '请输入有效频谱范围：0 ≤ 下限 < 上限 ≤ 1000 Hz。当前图保留上次有效范围。'; return;
    }
    frequencyRange = [min, max];
    $('analysis-help').textContent = '计权仅用于分析；时域和试听保持原信号。总声压级统计0–1 kHz，不随频谱显示范围改变。';
    if (result) draw(); else clearPlots();
  }
  $('freq-min').onchange = frequencyOptions; $('freq-max').onchange = frequencyOptions;
  $('waves').onchange = () => viewer.setWaves($<HTMLInputElement>('waves').checked);
  async function play(restart = false) { if (!result) return; if (restart) { player.seek(0); clearField(); } try { await player.play(); } catch (e) { $('status').textContent = `音频未启动：${String(e)}`; } }
  $('play').onclick = () => {
    if (liveSession) {
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
  $('replay').onclick = () => { if (liveSession) void calculate(); else { player.pause(); void play(true); } };
  $('seek').oninput = () => { player.seek(Number($<HTMLInputElement>('seek').value)); clearField(); draw(); };
  function comparison() {
    const seat = Number($<HTMLSelectElement>('seat').value);
    player.setComparison(ORDER[seat], audition); livePlayer.setComparison(ORDER[seat], audition);
    $('rnc-on').setAttribute('aria-pressed', String(audition === 'e'));
    $('audition-state').textContent = audition === 'e' ? '正在试听：降噪后 e' : '正在试听：原始噪声 d';
    draw();
  }
  $('seat').onchange = () => {
    // Return from hardware inspection to paired seat pressure traces. Audition stays independent.
    selected = { signal: 'e', channel: Number($<HTMLSelectElement>('seat').value) };
    flow.setSelected(selected.signal, selected.channel);
    if (!result) clearPlots();
    comparison();
  };
  $('rnc-on').onclick = () => { audition = audition === 'e' ? 'd' : 'e'; comparison(); };
  $('volume').oninput = () => { const volume = Number($<HTMLInputElement>('volume').value); player.setVolume(volume); livePlayer.setVolume(volume); };
  $('mute').onclick = () => { muted = !muted; player.setMuted(muted); livePlayer.setMuted(muted); $('mute').setAttribute('aria-pressed', String(muted)); };
  root.addEventListener('keydown', event => { if (event.key === 'Escape') $('context').hidden = true; });
  const tick = () => {
    if (disposed) return;
    const active = transport(), time = active.currentTime, n = Math.max(0, Math.min((result?.sampleCount ?? 1) - 1, Math.floor((time - timeOffset()) * 2000))), now = performance.now();
    $('play').textContent = active.starting ? '启动中' : active.playing ? '暂停' : '播放'; $('time').textContent = liveSession ? `${time.toFixed(2)} s · 实时` : `${time.toFixed(2)} / ${config.durationSeconds} s`; $<HTMLInputElement>('seek').value = String(time);
    viewer.render(time, selected, result?.signals.u.map(signal => signal[n]) ?? [], result?.sources.map(signal => signal[n]) ?? []);
    flow.render(time, active.playing, !!result?.config.rncEnabled && result.config.stepSize > 0 && time >= result.config.adaptationStartsSeconds);
    if (liveSession) {
      void pumpLive();
      if (!busy) $('status').textContent = `${livePlayer.starting ? '正在恢复试听' : !livePlayer.playing ? '实时已暂停' : livePlayer.status === 'buffering' ? '等待新样本' : '实时运行'} · ${time.toFixed(1)} s · 缓冲 ${(livePlayer.bufferedUntil - time).toFixed(2)} s · 共同安全增益 ${livePlayer.safetyGain.toFixed(3)} · 补缓冲 ${livePlayer.underruns} 次`;
    }
    if (now - lastChart >= 100) { draw(); lastChart = now; }
    if (result && !busy && $<HTMLSelectElement>('field').value !== 'off' && !fieldPending && fieldInFlight < 2 && now - lastFieldClock > 350 && Math.abs(time - lastFieldAt) > 0.15) {
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
  refreshConfig(); requestAnimationFrame(tick); void calculate();
  return () => { disposed = true; ++generation; ++fieldEpoch; liveSession = false; livePullPending = false; document.removeEventListener('visibilitychange', visibility); player.pause(); livePlayer.dispose(); ports.cancel(); viewer.dispose(); flow.dispose(); root.replaceChildren(); };
}
