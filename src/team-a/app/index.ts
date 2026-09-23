import type { AnalysisFrame, Corner, DemoEngine, RunResult, SignalKind } from '../../shared/contracts';
import { ORDER } from '../../shared/contracts';
import { CORNER_NAMES, DEFAULT_CONFIG } from '../../shared/defaults';
import { createViewer } from '../viewer';
import { Player } from '../player';
import { drawConvergence, drawSpectrum, drawWaveform } from '../charts';
import './style.css';

export interface AppPorts {
  engine: DemoEngine & { cancel(): void };
  loadReference(): Promise<RunResult>;
  syntheticSpl(rmsPa: number): number;
  referenceOnly: boolean;
}

export async function mountApp(root: HTMLElement, ports: AppPorts) {
  root.innerHTML = `
    <header><div class="brand"><span class="brand-icon">◈</span><div><strong>RNC <em>LAB</em></strong><small>四通道路噪主动控制 · 工程预览</small></div></div><div class="top-meta"><span class="pill">4 × 4 × 4 FxLMS</span><span>纯电 SUV / 固定沥青 / 60 km/h</span></div></header>
    <div class="notice"><span class="status-dot"></span>合成教学模型 · 预计算回放 · 非实车预测 <span id="source">正在加载参考数据</span></div>
    <main>
      <aside class="left-panel"><div class="section-label">01 / 实验配置</div><h2>固定工况，小步验证</h2><p class="muted">4 路参考 → 4 个扬声器 → 4 个误差点</p>
        <label>滤波器系数数<select id="taps"><option value="64">64 taps</option><option value="32">32 taps</option></select></label>
        <label>学习步长 μ<select id="step"><option value="0.08">0.08 · 启用学习</option><option value="0">0 · 无控制基线</option></select></label>
        <label>固定随机种子<select id="seed"><option>11</option><option>29</option><option>47</option></select></label>
        <button id="calculate" class="primary">计算新实验</button><button id="cancel" hidden>取消计算</button><button id="reference" class="subtle">载入参考算例</button>
        <p id="status" role="status" aria-live="polite">读取经过验证的默认算例…</p>
        <div class="divider"></div><div class="section-label">02 / 硬件与信号</div><div id="hardware"></div>
        <div class="source-key">● 4 轮激励源：独立合成噪声<br>● REF：悬架单轴振动参考<br>● OUT：车门扬声器驱动<br>● MIC：头枕附近误差声压</div>
      </aside>
      <section class="center-panel"><div class="viewer-top"><div><div class="section-label">03 / 车辆与点位</div><h2>看见控制系统</h2></div><span class="pill quiet">+Y 上 · +Z 车头 · +X 左侧</span></div>
        <div id="viewer"><div class="viewer-hint">拖动旋转 · 滚轮缩放 · 点击彩色硬件点</div></div>
        <div class="view-tools"><select id="body" aria-label="车身显示"><option value="transparent">半透明车身</option><option value="hidden">隐藏车身</option><option value="solid">实体车身</option></select><button id="explode">分层展开</button><button id="reset">复位视角与结构</button><span id="fps">— fps</span></div>
        <div class="flow"><span>轮端激励 x</span><i>→</i><span>16 组 FxLMS 滤波器</span><i>→</i><span>扬声器 u</span><i>→</i><span>16 条次级路径</span><i>→</i><strong>e = d + a</strong></div>
      </section>
      <aside class="right-panel"><div class="section-label">04 / 声压与降噪</div><h2>四个误差点</h2><p class="muted">0.5 s 滑动 RMS · 全采样频带 · 未计权</p><div id="metrics"></div><div class="scale"><span>残余合成 SPL</span><div></div><span>30 ← → 80 dB</span></div>
        <div class="steady"><small>后 4 秒总功率降噪</small><strong id="aggregate">—<em> dB</em></strong><span>由完整实验结果计算</span></div>
        <p class="muted small">颜色只代表 4 个测点，不代表连续三维声场。前 2 秒关闭控制，随后开始学习。</p>
      </aside>
      <section class="charts"><article><div class="chart-title"><strong id="wave-title">MIC FL · e / Pa</strong><span>原声灰色 / 所选信号绿色</span></div><canvas id="wave"></canvas></article><article><div class="chart-title"><strong>单边 PSD</strong><span id="psd-unit">dB re 1 Pa²/Hz · Hann 1024</span></div><canvas id="spectrum"></canvas></article><article><div class="chart-title"><strong>四点收敛 · dB</strong><span>FL / FR / RL / RR</span></div><canvas id="convergence"></canvas></article></section>
    </main>
    <footer><div class="transport"><button id="play" class="primary" disabled>播放</button><button id="replay" disabled>重播</button><span id="time">00.00 / 16.00 s</span></div><input id="seek" type="range" min="0" max="16" step="0.01" value="0" aria-label="播放进度" disabled><div class="listen"><select id="mic" aria-label="试听座位">${ORDER.map(c => `<option value="${c}">${CORNER_NAMES[c]}</option>`).join('')}</select><select id="comparison" aria-label="声音对比"><option value="e">对比 RNC 结果</option><option value="d">对比原噪声</option></select><button id="mute">静音</button><input id="volume" type="range" min="0" max="1" step="0.01" value="0.25" aria-label="音量"></div></footer>
    <div class="diagnostics" id="diagnostics">接口 demo-v2 · 教学路径 synthetic-4x4x4-v1</div>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const player = new Player();
  let result: RunResult | null = null, busy = false, muted = false, exploded = false;
  let selected: { signal: SignalKind; channel: Corner } = { signal: 'e', channel: 'fl' };
  let frame: AnalysisFrame | null = null, curves: number[][] = [], lastCharts = -1, requestId = '';
  function select(signal: SignalKind, channel: Corner) {
    selected = { signal, channel }; lastCharts = -1;
    const unit = signal === 'x' ? 'm/s²' : signal === 'u' ? 'drive' : 'Pa';
    $('wave-title').textContent = `${channel.toUpperCase()} · ${signal} / ${unit}`;
    $('psd-unit').textContent = `dB re 1 (${unit})²/Hz · Hann 1024`;
    root.querySelectorAll<HTMLButtonElement>('[data-signal]').forEach(b => b.classList.toggle('selected', b.dataset.signal === signal && b.dataset.corner === channel));
    if (['d', 'e', 'a'].includes(signal)) { $<HTMLSelectElement>('mic').value = channel; updateComparison(); }
  }
  $('hardware').innerHTML = ([['x', 'REF / 振动参考'], ['u', 'OUT / 扬声器'], ['e', 'MIC / 误差点']] as const).map(([kind, title]) =>
    `<div class="hardware-group ${kind}"><span>${title}</span><div>${ORDER.map(c => `<button data-signal="${kind}" data-corner="${c}" title="${CORNER_NAMES[c]}">${c.toUpperCase()}</button>`).join('')}</div></div>`).join('');
  root.querySelectorAll<HTMLButtonElement>('[data-signal]').forEach(b => { b.onclick = () => select(b.dataset.signal as SignalKind, b.dataset.corner as Corner); });
  let viewer: ReturnType<typeof createViewer> | null = null;
  try { viewer = createViewer($('viewer'), select); } catch (error) { $('viewer').textContent = `三维视图无法启动：${String(error)}。可继续验证数据与试听。`; }
  $('body').onchange = () => viewer?.setBody($<HTMLSelectElement>('body').value);
  $('explode').onclick = () => { exploded = !exploded; viewer?.setExploded(exploded); $('explode').textContent = exploded ? '收起结构' : '分层展开'; };
  $('reset').onclick = () => { viewer?.reset(); exploded = false; $('explode').textContent = '分层展开'; $<HTMLSelectElement>('body').value = 'transparent'; };
  function updateComparison() { player.setComparison($<HTMLSelectElement>('mic').value as Corner, $<HTMLSelectElement>('comparison').value as 'd' | 'e'); }
  $('mic').onchange = () => select($<HTMLSelectElement>('comparison').value as 'd' | 'e', $<HTMLSelectElement>('mic').value as Corner);
  $('comparison').onchange = () => select($<HTMLSelectElement>('comparison').value as 'd' | 'e', $<HTMLSelectElement>('mic').value as Corner);
  $('volume').oninput = () => player.setVolume(Number($<HTMLInputElement>('volume').value));
  $('mute').onclick = () => { muted = !muted; player.setMuted(muted); $('mute').textContent = muted ? '取消静音' : '静音'; };
  $('seek').oninput = () => { player.seek(Number($<HTMLInputElement>('seek').value)); lastCharts = -1; };
  async function play() { try { await player.play(); } catch (e) { $('status').textContent = `音频启动失败：${String(e)}`; } }
  $('play').onclick = () => player.playing ? player.pause() : void play();
  $('replay').onclick = () => { player.seek(0); void play(); };
  function setBusy(value: boolean) {
    busy = value;
    for (const id of ['calculate', 'reference', 'taps', 'step', 'seed']) ($<HTMLButtonElement | HTMLSelectElement>(id)).disabled = value || (ports.referenceOnly && id !== 'reference');
    for (const id of ['play', 'replay', 'seek']) $<HTMLButtonElement | HTMLInputElement>(id).disabled = value || !result;
    $('cancel').hidden = !value || ports.referenceOnly;
  }
  function useResult(next: RunResult) {
    result = next; player.load(next); frame = null; lastCharts = -1;
    $('source').textContent = next.source === 'reference-replay' ? '参考算例回放' : '浏览器计算 · 预计算回放';
    $('aggregate').innerHTML = `${next.metrics.aggregateReductionDb.toFixed(2)}<em> dB</em>`;
    $('diagnostics').textContent = `runId: ${next.runId} | source: ${next.source} | seed=${next.config.seed} · taps=${next.config.taps} · μ=${next.config.stepSize} | ${next.computeMilliseconds === null ? '参考数据' : `计算 ${next.computeMilliseconds.toFixed(0)} ms`} | sampleCount=32000`;
    $('status').textContent = `就绪：${next.config.taps} taps / μ ${next.config.stepSize} / seed ${next.config.seed}。修改参数后需重新计算。`;
    curves = ORDER.map(() => []);
    for (let sample = 1000; sample <= 32000; sample += 500) {
      const f = ports.engine.analyzeAt(next, sample, selected);
      f.microphones.forEach((m, i) => curves[i].push(m.reductionDb ?? 0));
    }
    drawConvergence($<HTMLCanvasElement>('convergence'), curves);
  }
  $('calculate').onclick = async () => {
    if (busy) return;
    player.pause(); setBusy(true); requestId = crypto.randomUUID(); const id = requestId;
    const config = { ...DEFAULT_CONFIG, taps: Number($<HTMLSelectElement>('taps').value) as 32 | 64,
      stepSize: Number($<HTMLSelectElement>('step').value) as 0 | 0.08, seed: Number($<HTMLSelectElement>('seed').value) as 11 | 29 | 47 };
    $('status').textContent = 'Worker 正在计算 16 秒实验…';
    try { const next = await ports.engine.calculate(config, id); if (id === requestId) useResult(next); }
    catch (error) { $('status').textContent = `计算未完成：${(error as Error).message}。${result ? '下方仍是上一次实验，可点击播放继续。' : ''}`; }
    finally { setBusy(false); }
  };
  $('cancel').onclick = () => ports.engine.cancel();
  async function reference() {
    player.pause(); setBusy(true);
    try { useResult(await ports.loadReference()); }
    catch (error) { $('status').textContent = `参考数据加载失败：${String(error)}`; }
    finally { setBusy(false); }
  }
  $('reference').onclick = () => { if (!busy) void reference(); };
  select('e', 'fl');
  let fpsTime = performance.now(), count = 0;
  function render(now: number) {
    const time = player.currentTime;
    $('play').textContent = player.playing ? '暂停' : '播放';
    $('time').textContent = `${time.toFixed(2).padStart(5, '0')} / 16.00 s`;
    $<HTMLInputElement>('seek').value = String(time);
    if (result && (lastCharts < 0 || now - lastCharts > 100)) {
      const end = Math.floor(time * 2000); frame = ports.engine.analyzeAt(result, end, selected); lastCharts = now;
      drawWaveform($<HTMLCanvasElement>('wave'), result, end, selected); drawSpectrum($<HTMLCanvasElement>('spectrum'), frame);
      drawConvergence($<HTMLCanvasElement>('convergence'), curves);
      $('metrics').innerHTML = frame.microphones.map((m, i) => `<div class="metric-card"><div><strong>${ORDER[i].toUpperCase()}</strong><span>${CORNER_NAMES[ORDER[i]]}</span><b>${m.reductionDb === null ? '准备中' : `${m.reductionDb.toFixed(1)} dB`}</b></div><p>原声 ${m.primaryRmsPa === null ? '—' : ports.syntheticSpl(m.primaryRmsPa).toFixed(1)} <span>→</span> 残余 ${m.residualRmsPa === null ? '—' : ports.syntheticSpl(m.residualRmsPa).toFixed(1)} <small>dB SPL</small></p></div>`).join('');
    }
    viewer?.render(time, selected, frame ? frame.microphones.map(m => m.residualRmsPa === null ? null : ports.syntheticSpl(m.residualRmsPa)) : [null, null, null, null]);
    count++; if (now - fpsTime > 1000) { $('fps').textContent = `${Math.round(count * 1000 / (now - fpsTime))} fps`; count = 0; fpsTime = now; }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
  await reference();
}
