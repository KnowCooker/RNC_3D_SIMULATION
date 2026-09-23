import { ORDER } from '../../shared/contracts';
import { defaultLabConfig, VEHICLE_NAMES, type FieldFrame, type LabAnalysis, type LabConfig, type LabResult, type LabSelection, type Vec3, type VehicleKind } from '../../shared/lab-contracts';
import { Player, prepareLabPlayback } from '../player';
import { createLabViewer } from '../viewer/lab-viewer';
import { createSignalFlow } from './signal-flow';
import { drawConvergence } from '../charts';
import './style.css';

export interface LabPorts {
  calculate(config: LabConfig, runId: string): Promise<LabResult>;
  field(time: number, points: Vec3[]): Promise<FieldFrame>;
  cancel(): void;
  analyze(result: LabResult, time: number, selection: LabSelection): LabAnalysis;
}
const types = ['ice', 'bev', 'hev', 'erev'] as const;
const modelNotes: Record<VehicleKind, string> = {
  ice: '发动机 → 变速箱 → 传动系统；油箱供油、排气后处理。',
  bev: '底板动力电池 → 逆变器 → 电机/减速器；纯电驱轮。',
  hev: '发动机与电机经功率分流机构协同驱动；独立小容量动力电池。',
  erev: '发动机仅带动发电机；电池与发电机供电，由电机机械驱轮。',
};
function trace(canvas: HTMLCanvasElement, values: number[], spectrum: boolean) {
  const width = canvas.clientWidth, height = canvas.clientHeight, ratio = Math.min(devicePixelRatio, 2);
  canvas.width = width * ratio; canvas.height = height * ratio;
  const context = canvas.getContext('2d')!; context.scale(ratio, ratio);
  const peak = Math.max(0.001, ...values.map(Math.abs));
  const min = spectrum ? -140 : -peak, max = spectrum ? 20 : peak;
  context.font = '10px monospace'; context.fillStyle = '#91a3b9';
  for (let i = 0; i < 4; i++) {
    const y = 15 + i * (height - 38) / 3;
    context.strokeStyle = '#29394a'; context.beginPath(); context.moveTo(40, y); context.lineTo(width - 8, y); context.stroke();
    context.fillText((max - (max - min) * i / 3).toPrecision(3), 0, y + 3);
  }
  context.strokeStyle = spectrum ? '#81baff' : '#78e1bd'; context.beginPath();
  values.forEach((value, i) => {
    const x = 40 + i / Math.max(1, values.length - 1) * (width - 48), y = 15 + (max - value) / (max - min) * (height - 38);
    if (i) context.lineTo(x, y); else context.moveTo(x, y);
  }); context.stroke();
  context.fillText(spectrum ? '0 Hz → 1000 Hz' : '最近 0.20 秒', 42, height - 4);
}
export function mountLab(root: HTMLElement, ports: LabPorts) {
  root.className = 'lab-app';
  root.innerHTML = `
    <header class="lab-header"><div><span class="lab-eyebrow">INTERACTIVE ACOUSTICS / RNC</span><h1>车辆声学实验室</h1></div><span class="lab-badge">完整目标 · 开发中</span><a href="?legacy=1">两周基准版本</a></header>
    <div class="lab-disclosure">原创教学车型 · 公开结构依据 · 合成空间路径 · 16秒预计算回放 · 非实车预测 / 非有限元结果</div>
    <main class="lab-main"><aside class="lab-controls">
      <h2>01 / 车辆与工况</h2><label>动力类型<select id="lab-vehicle">${types.map(key => `<option value="${key}" ${key === 'bev' ? 'selected' : ''}>${VEHICLE_NAMES[key]}</option>`).join('')}</select></label><p id="lab-architecture"></p>
      <label>车速 / km/h<input id="lab-speed" type="range" min="0" max="130" step="5" value="60"><output id="lab-speed-value">60</output></label>
      <label>路面粗糙度 / 相对值<input id="lab-road" type="range" min="0.1" max="3" step="0.1" value="1"><output id="lab-road-value">1</output></label>
      <label>胎面粗糙度 / 相对值<input id="lab-tread" type="range" min="0.1" max="3" step="0.1" value="1"><output id="lab-tread-value">1</output></label>
      <div class="lab-pair"><label>胎压 / kPa<input id="lab-pressure" type="number" min="160" max="320" value="240"></label><label>温度 / °C<input id="lab-temperature" type="number" min="-20" max="50" value="20"></label></div>
      <p class="lab-help">车速和粗糙度改变源能量。胎压/温度用于教学谱峰与阻尼变化，不宣称普适单调关系。</p>
      <h2>02 / 算法与改制</h2><div class="lab-pair"><label>FxLMS 阶数<input id="lab-taps" type="number" min="16" max="128" step="1" value="64"></label><label>归一化步长 μ<input id="lab-step" type="number" min="0" max="0.5" step="0.01" value="0.08"></label></div>
      <label class="lab-check"><input id="lab-rnc" type="checkbox" checked>启用 RNC（更改后重算）</label>
      <label class="lab-check"><input id="lab-edit" type="checkbox">车辆改制：点击结构添加参考传感器</label><p class="lab-help">参考1–8个；右击标记可查看或移除。误差点固定。所有改制将要求重新计算。</p><div id="lab-references"></div>
      <fieldset><legend>车门扬声器</legend><div id="lab-speakers">${ORDER.map((name, i) => `<label class="lab-check"><input type="checkbox" data-speaker="${i}" checked>${name.toUpperCase()}</label>`).join('')}</div></fieldset>
      <button id="lab-calculate" class="lab-primary">计算当前实验</button><button id="lab-cancel" disabled>取消计算</button><p id="lab-status" role="status">准备计算默认实验</p>
    </aside><section class="lab-workspace"><div class="lab-view-heading"><h2>03 / 结构与空间声场</h2><span id="lab-run">尚无实验结果</span></div>
      <div id="lab-viewer"><span class="lab-view-help">左键旋转 · 滚轮缩放 · 右击硬件查看信号</span></div>
      <div class="lab-view-tools"><label>车身<select id="lab-body"><option value="transparent">透明</option><option value="solid">实体</option><option value="hidden">隐藏</option></select></label><button id="lab-explode" aria-pressed="false">分解动画</button><button id="lab-reset">复位</button><label>剖面<select id="lab-section"><option value="none">关闭</option><option value="x">纵剖 X</option><option value="y">水平 Y</option><option value="z">横剖 Z</option></select></label><label>剖面位置 / m<input id="lab-section-position" type="range" min="-2.5" max="2.5" step="0.05" value="0"></label></div>
      <div class="lab-view-tools"><label>声压场<select id="lab-field"><option value="off">关闭</option><option value="residual">残余 e / SPL</option><option value="primary">原始 d / SPL</option></select></label><label>场显示<select id="lab-field-slice"><option value="volume">三维采样体</option><option value="x">中央纵切片</option><option value="y">头部水平切片</option><option value="z">前排横切片</option></select></label><label>传播路径<select id="lab-paths"><option value="none">关闭</option><option value="primary">初级路径</option><option value="secondary">次级路径</option><option value="both">全部</option></select></label><label class="lab-check"><input id="lab-waves" type="checkbox">扬声器波前</label></div>
      <div class="lab-field-note"><span class="lab-colorbar"></span><span>30—80 dB SPL，固定色标；0.5秒RMS</span><span id="lab-field-status">声场未开启</span></div><p class="lab-help">空间场由四轮源和实际扬声器驱动经同一传播模型计算。爆炸只改变展示坐标；波前/路径动画为慢放示意，非实际声速。几何剖面暂未封口。</p>
      <div id="lab-metrics" class="lab-metrics"></div><section class="lab-signals"><h2>04 / 信号流与控制机理</h2><div id="lab-flow"></div></section>
    </section></main>
    <section class="lab-plots"><article><h3 id="lab-signal-title">误差声压 e</h3><canvas id="lab-wave" aria-label="所选信号波形"></canvas></article><article><h3 id="lab-spectrum-title">单边 PSD · Hann 1024</h3><canvas id="lab-spectrum" aria-label="所选信号频谱"></canvas></article><article><h3>四测点收敛 / dB</h3><canvas id="lab-convergence" aria-label="完整实验收敛曲线"></canvas></article></section>
    <footer class="lab-player"><button id="lab-play" disabled>播放</button><button id="lab-replay" disabled>重播</button><span id="lab-time">0.00 / 16 s</span><input id="lab-seek" aria-label="播放进度" type="range" min="0" max="16" step="0.01" value="0" disabled><label>试听座位<select id="lab-seat">${ORDER.map((c, i) => `<option value="${i}">${c.toUpperCase()}</option>`).join('')}</select></label><label>对比<select id="lab-comparison"><option value="e">残余声 e</option><option value="d">原噪声 d</option></select></label><label>音量<input id="lab-volume" aria-label="音量" type="range" min="0" max="0.5" step="0.01" value="0.15"></label><button id="lab-mute" aria-pressed="false">静音</button></footer>
    <div id="lab-context" class="lab-context" role="menu" hidden></div><details class="lab-sources"><summary>公开依据与模型限制</summary><p>结构参考 DOE AFDC、Toyota RAV4 Hybrid、VW ID.4、Stellantis C10 REEV；原型外形为原创，不冒充其量产车型。硬件位置参考 EP3156998B1。源谱/传递参数为有依据的教学假设，尚未实车标定；模型精细度仍在改进。</p><a href="https://afdc.energy.gov/vehicles/how-do-hybrid-electric-cars-work" target="_blank" rel="noreferrer">DOE 结构原理</a> · <a href="https://patents.google.com/patent/EP3156998B1/en" target="_blank" rel="noreferrer">RNC硬件专利</a><p>更完整的逐项来源与适用边界见仓库 docs/research。完整目标仍在开发验证中。</p></details>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#lab-${id}`)!;
  const player = new Player(); player.setVolume(0.15);
  let config = defaultLabConfig(), result: LabResult | null = null, selected: LabSelection = { signal: 'e', channel: 0 };
  let generation = 0, busy = false, exploded = false, muted = false, nextReference = 5, disposed = false;
  let fieldPending = false, fieldEpoch = 0, lastFieldAt = -1, lastFieldClock = 0, lastChart = 0;
  let curves: (number | null)[][] = [[], [], [], []];
  const flow = createSignalFlow($('flow'), (signal, channel) => select({ signal, channel }));
  const viewer = createLabViewer($('viewer'), { select, add: addReference, context });
  function select(value: LabSelection) {
    selected = value; flow.setSelected(value.signal, value.channel);
    if (['d', 'e'].includes(value.signal)) {
      $<HTMLSelectElement>('seat').value = String(value.channel); $<HTMLSelectElement>('comparison').value = value.signal;
      player.setComparison(ORDER[value.channel], value.signal as 'd' | 'e');
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
    $('architecture').textContent = modelNotes[config.vehicle]; viewer.setConfig(config);
    flow.setChannels(config.references.map(r => r.name), [...config.speakerEnabled]); flow.setSelected(selected.signal, selected.channel);
    $('references').replaceChildren();
    config.references.forEach((sensor, i) => {
      const row = document.createElement('div'); row.className = 'lab-reference-row';
      const name = document.createElement('button'); name.textContent = sensor.name; name.onclick = () => select({ signal: 'x', channel: i }); row.append(name);
      const position = document.createElement('small'); position.textContent = sensor.position.map(v => v.toFixed(2)).join(', '); row.append(position);
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
    result = null; player.pause(); player.seek(0); clearField(); clearPlots();
    $('metrics').replaceChildren(); $('run').textContent = '尚无当前实验结果';
    $('signal-title').textContent = '波形：等待当前实验'; $('spectrum-title').textContent = 'PSD：等待当前实验';
  }
  function dirty() {
    ++generation; ports.cancel(); busy = false; clearExperiment();
    $('status').textContent = '配置已改变，请重新计算。旧结果已停止展示。'; $('run').textContent = '待计算配置'; $('metrics').replaceChildren();
    for (const name of ['play', 'replay', 'seek']) ($<HTMLButtonElement>(name)).disabled = true;
    $<HTMLButtonElement>('calculate').disabled = false; $<HTMLButtonElement>('cancel').disabled = true;
    refreshConfig(); clearPlots();
  }
  function addReference(position: Vec3, mountPart?: string) {
    if (config.references.length >= 8) { $('status').textContent = '当前计算上限为8个参考传感器，可先移除已有传感器。'; return; }
    const id = nextReference++;
    config.references.push({ id: `ref-${id}`, name: `REF ${id}`, position, mountPart }); dirty();
  }
  function clearPlots() { trace($('wave'), [], false); trace($('spectrum'), [], true); drawConvergence($('convergence'), [[], [], [], []]); }
  function draw() {
    if (!result) return;
    const analysis = ports.analyze(result, player.currentTime, selected);
    const kind = selected.signal === 'x' ? config.references[selected.channel]?.name : selected.signal === 'q' ? `Q${selected.channel + 1}` : `${selected.signal.toUpperCase()} ${ORDER[selected.channel]?.toUpperCase()}`;
    $('signal-title').textContent = `${kind} / ${analysis.unit} · ${analysis.valid ? player.currentTime.toFixed(2) + ' s' : '准备中'}`;
    $('spectrum-title').textContent = `PSD / (${analysis.unit})²/Hz · ${analysis.spectrum ? 'Hann 1024' : '需0.512秒'}`;
    trace($('wave'), Array.from(analysis.waveform), false);
    trace($('spectrum'), analysis.spectrum ? Array.from(analysis.spectrum, value => 10 * Math.log10(Math.max(value, 1e-14))) : [], true);
    drawConvergence($('convergence'), curves);
    $('metrics').innerHTML = ORDER.map((corner, i) => `<div><strong>${corner.toUpperCase()}</strong><b>${analysis.reductionDb[i] === null ? '准备中' : analysis.reductionDb[i]!.toFixed(1) + ' dB'}</b><small>${analysis.primarySpl[i]?.toFixed(1) ?? '—'} → ${analysis.residualSpl[i]?.toFixed(1) ?? '—'} dB SPL</small></div>`).join('');
  }
  async function calculate() {
    const token = ++generation; ports.cancel(); busy = true; clearExperiment();
    for (const name of ['play', 'replay', 'seek', 'calculate']) $<HTMLButtonElement>(name).disabled = true;
    $<HTMLButtonElement>('cancel').disabled = false; $('status').textContent = '正在计算真实动态MIMO实验…';
    const runId = crypto.randomUUID();
    try {
      const computed = await ports.calculate(structuredClone(config), runId);
      if (token !== generation) return;
      result = computed;
      const audio = prepareLabPlayback(computed); player.load(audio.result);
      player.setComparison(ORDER[Number($<HTMLSelectElement>('seat').value)], $<HTMLSelectElement>('comparison').value as 'd' | 'e');
      curves = [[], [], [], []];
      for (let t = 0.5; t <= 16; t += 0.5) { const a = ports.analyze(result, t, selected); for (let i = 0; i < 4; i++) curves[i].push(a.reductionDb[i]); }
      $('run').textContent = `${VEHICLE_NAMES[result.config.vehicle]} · ${result.config.references.length}×4×4 · ${result.runId.slice(0, 8)}`;
      $('status').textContent = `实验就绪 · ${result.computeMilliseconds.toFixed(0)} ms · 末4秒总改善 ${result.metrics.aggregateReductionDb.toFixed(1)} dB（教学模型）；四座位d/e共用试听衰减 ${audio.gain.toFixed(3)}`;
      for (const name of ['play', 'replay', 'seek']) $<HTMLButtonElement>(name).disabled = false;
      lastFieldAt = -1; fieldPending = false; draw();
    } catch (error) { if (token === generation) $('status').textContent = `计算未完成：${error instanceof Error ? error.message : String(error)}`; }
    finally { if (token === generation) { busy = false; $<HTMLButtonElement>('calculate').disabled = false; $<HTMLButtonElement>('cancel').disabled = true; } }
  }
  $<HTMLSelectElement>('vehicle').onchange = event => { config.vehicle = (event.target as HTMLSelectElement).value as VehicleKind; dirty(); };
  const numeric = { speed: 'speedKph', road: 'roadRoughness', tread: 'treadRoughness', pressure: 'pressureKpa', temperature: 'temperatureC', taps: 'taps', step: 'stepSize' } as const;
  for (const [id, key] of Object.entries(numeric)) $<HTMLInputElement>(id).onchange = () => {
    config[key as typeof numeric[keyof typeof numeric]] = Number($<HTMLInputElement>(id).value);
    const output = root.querySelector(`#lab-${id}-value`); if (output) output.textContent = $<HTMLInputElement>(id).value; dirty();
  };
  $<HTMLInputElement>('rnc').onchange = () => { config.rncEnabled = $<HTMLInputElement>('rnc').checked; dirty(); };
  $<HTMLInputElement>('edit').onchange = () => { viewer.setEditMode($<HTMLInputElement>('edit').checked); refreshConfig(); };
  root.querySelectorAll<HTMLInputElement>('[data-speaker]').forEach(input => { input.onchange = () => { const enabled = [...config.speakerEnabled]; enabled[Number(input.dataset.speaker)] = input.checked; config.speakerEnabled = enabled as unknown as LabConfig['speakerEnabled']; dirty(); }; });
  $('calculate').onclick = () => void calculate(); $('cancel').onclick = () => { dirty(); $('status').textContent = '计算已取消。'; };
  $('body').onchange = () => viewer.setBody($<HTMLSelectElement>('body').value);
  $('explode').onclick = () => { exploded = !exploded; viewer.setExploded(exploded); $('explode').setAttribute('aria-pressed', String(exploded)); };
  $('reset').onclick = () => { viewer.reset(); exploded = false; $('explode').setAttribute('aria-pressed', 'false'); };
  function section() { viewer.setSection($<HTMLSelectElement>('section').value, Number($<HTMLInputElement>('section-position').value)); }
  $('section').onchange = section; $('section-position').oninput = section;
  function fieldOptions() { clearField(); viewer.setField($<HTMLSelectElement>('field').value, $<HTMLSelectElement>('field-slice').value as 'volume' | 'x' | 'y' | 'z'); }
  $('field').onchange = fieldOptions; $('field-slice').onchange = fieldOptions;
  $('paths').onchange = () => viewer.setPaths($<HTMLSelectElement>('paths').value);
  $('waves').onchange = () => viewer.setWaves($<HTMLInputElement>('waves').checked);
  async function play(restart = false) { if (!result) return; if (restart) { player.seek(0); clearField(); } try { await player.play(); } catch (e) { $('status').textContent = `音频未启动：${String(e)}`; } }
  $('play').onclick = () => { if (player.playing || player.starting) player.pause(); else void play(); };
  $('replay').onclick = () => { player.pause(); void play(true); };
  $('seek').oninput = () => { player.seek(Number($<HTMLInputElement>('seek').value)); clearField(); draw(); };
  function comparison() { select({ signal: $<HTMLSelectElement>('comparison').value as 'd' | 'e', channel: Number($<HTMLSelectElement>('seat').value) }); }
  $('seat').onchange = comparison; $('comparison').onchange = comparison;
  $('volume').oninput = () => player.setVolume(Number($<HTMLInputElement>('volume').value));
  $('mute').onclick = () => { muted = !muted; player.setMuted(muted); $('mute').setAttribute('aria-pressed', String(muted)); };
  root.addEventListener('keydown', event => { if (event.key === 'Escape') $('context').hidden = true; });
  const tick = () => {
    if (disposed) return;
    const time = player.currentTime, n = Math.min(31999, Math.floor(time * 2000)), now = performance.now();
    $('play').textContent = player.starting ? '启动中' : player.playing ? '暂停' : '播放'; $('time').textContent = `${time.toFixed(2)} / 16 s`; $<HTMLInputElement>('seek').value = String(time);
    viewer.render(time, selected, result?.signals.u.map(signal => signal[n]) ?? [], result?.sources.map(signal => signal[n]) ?? []);
    flow.render(time, player.playing, !!result?.config.rncEnabled && result.config.stepSize > 0 && time >= 2);
    if (now - lastChart >= 100) { draw(); lastChart = now; }
    if (result && !busy && $<HTMLSelectElement>('field').value !== 'off' && !fieldPending && now - lastFieldClock > 350 && Math.abs(time - lastFieldAt) > 0.15) {
      const token = generation, epoch = fieldEpoch; fieldPending = true; lastFieldAt = time; lastFieldClock = now;
      ports.field(time, viewer.fieldPoints).then(frame => { if (token === generation && epoch === fieldEpoch) { viewer.updateField(frame); $('field-status').textContent = frame.valid ? `空间窗口截至 ${frame.time.toFixed(2)} s` : '声场准备中，需要0.5秒数据'; } }).catch(error => { if (token === generation && epoch === fieldEpoch) $('field-status').textContent = `声场计算失败：${String(error)}`; }).finally(() => { if (token === generation && epoch === fieldEpoch) fieldPending = false; });
    }
    requestAnimationFrame(tick);
  };
  refreshConfig(); requestAnimationFrame(tick); void calculate();
  return () => { disposed = true; player.pause(); ports.cancel(); viewer.dispose(); flow.dispose(); root.replaceChildren(); };
}
