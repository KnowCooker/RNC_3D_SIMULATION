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
        <div class="source-key">● 4 轮激励源：教学示意，点选查看同角 REF<br>● REF：悬架单轴振动参考，并非独立的源测量<br>● OUT：车门扬声器驱动<br>● MIC：头枕附近误差声压</div>
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
      <section class="charts"><p id="selection-note" class="chart-context"></p><article><div class="chart-title"><strong id="wave-title">MIC FL · e / Pa</strong><span id="wave-legend">原声灰色 / 残余绿色</span></div><canvas id="wave" aria-label="所选信号波形"></canvas><p id="chart-time" class="chart-context">波形准备中</p></article><article><div class="chart-title"><strong>单边 PSD</strong><span id="psd-unit">dB re 1 Pa²/Hz · Hann 1024</span></div><canvas id="spectrum" aria-label="所选信号频谱"></canvas><p id="spectrum-status" class="chart-context">频谱准备中</p></article><article><div class="chart-title"><strong>四点收敛 · dB</strong><span>FL / FR / RL / RR</span></div><canvas id="convergence" aria-label="完整实验四点收敛曲线"></canvas><p class="chart-context">完整 16 秒实验 · 无有效指标的区间留空</p></article></section>
    </main>
    <footer><div class="transport"><button id="play" class="primary" disabled>播放</button><button id="replay" disabled>重播</button><span id="time">00.00 / 16.00 s</span></div><input id="seek" type="range" min="0" max="16" step="0.01" value="0" aria-label="播放进度" disabled><div class="listen"><select id="mic" aria-label="试听座位">${ORDER.map(c => `<option value="${c}">${CORNER_NAMES[c]}</option>`).join('')}</select><select id="comparison" aria-label="声音对比"><option value="e">对比 RNC 结果</option><option value="d">对比原噪声</option></select><button id="mute">静音</button><input id="volume" type="range" min="0" max="1" step="0.01" value="0.25" aria-label="音量"></div></footer>
    <div class="diagnostics" id="diagnostics">接口 demo-v2 · 教学路径 synthetic-4x4x4-v1</div>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const player = new Player();
  let result: RunResult | null = null, busy = false, muted = false, exploded = false;
  let selected: { signal: SignalKind; channel: Corner } = { signal: 'e', channel: 'fl' };
  let frame: AnalysisFrame | null = null, curves: (number | null)[][] = [], lastCharts = -1;
  type Request = { id: string; kind: 'calculation' | 'reference' };
  let activeRequest: Request | null = null;
  function select(signal: SignalKind, channel: Corner) {
    selected = { signal, channel }; lastCharts = -1;
    const unit = signal === 'x' ? 'm/s²' : signal === 'u' ? 'drive' : 'Pa';
    $('wave-title').textContent = `${channel.toUpperCase()} · ${signal} / ${unit}`;
    $('psd-unit').textContent = `dB re 1 (${unit})²/Hz · Hann 1024`;
    const hardwareSignal = signal === 'd' ? 'e' : signal;
    root.querySelectorAll<HTMLButtonElement>('#hardware [data-signal]').forEach(b => b.classList.toggle('selected', b.dataset.signal === hardwareSignal && b.dataset.corner === channel));
    if (signal === 'd' || signal === 'e') {
      $<HTMLSelectElement>('mic').value = channel;
      $<HTMLSelectElement>('comparison').value = signal;
      updateComparison();
    }
    $('wave-legend').textContent = signal === 'e' ? '原声 d 灰色 / 残余 e 绿色' : signal === 'd' ? '原噪声 d 灰色' : `${signal} 绿色 · ${unit}`;
    const listening = $<HTMLSelectElement>('comparison').value === 'd' ? '原噪声 d' : '残余声 e';
    $('selection-note').textContent = `图表：${channel.toUpperCase()} / ${signal}（${unit}）；试听：MIC ${$<HTMLSelectElement>('mic').value.toUpperCase()} / ${listening}。${signal === 'x' || signal === 'u' ? '参考与驱动只供查看，试听保持原座位。' : '图表与试听使用同一座位和信号。'}`;
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
  $('play').onclick = () => player.playing || player.starting ? player.pause() : void play();
  $('replay').onclick = () => { player.seek(0); void play(); };
  function setBusy(value: boolean) {
    busy = value;
    for (const id of ['calculate', 'reference', 'taps', 'step', 'seed']) ($<HTMLButtonElement | HTMLSelectElement>(id)).disabled = value || (ports.referenceOnly && id !== 'reference');
    for (const id of ['play', 'replay', 'seek']) $<HTMLButtonElement | HTMLInputElement>(id).disabled = value || !result;
    $('cancel').hidden = !value;
    $('cancel').textContent = activeRequest?.kind === 'reference' ? '取消加载' : '取消计算';
  }
  function beginRequest(kind: Request['kind']): Request {
    player.pause();
    const request = { id: crypto.randomUUID(), kind };
    activeRequest = request; setBusy(true);
    return request;
  }
  function finishRequest(request: Request) {
    // A cancelled request may settle after a newer request has started.
    if (activeRequest !== request) return;
    activeRequest = null; setBusy(false);
  }
  function retainedResultMessage() {
    return result ? '下方仍是上一次实验，已暂停，可点击播放继续。' : '尚无可播放数据，请重试或载入参考算例。';
  }
  function useResult(next: RunResult) {
    result = next; player.load(next); frame = null; lastCharts = -1;
    $<HTMLSelectElement>('taps').value = String(next.config.taps);
    $<HTMLSelectElement>('step').value = String(next.config.stepSize);
    $<HTMLSelectElement>('seed').value = String(next.config.seed);
    $('source').textContent = next.source === 'reference-replay' ? '参考算例回放' : '浏览器计算 · 预计算回放';
    $('aggregate').innerHTML = `${next.metrics.aggregateReductionDb.toFixed(2)}<em> dB</em>`;
    $('diagnostics').textContent = `runId: ${next.runId} | source: ${next.source} | seed=${next.config.seed} · taps=${next.config.taps} · μ=${next.config.stepSize} | ${next.computeMilliseconds === null ? '参考数据' : `计算 ${next.computeMilliseconds.toFixed(0)} ms`} | sampleCount=32000`;
    $('status').textContent = `就绪：${next.config.taps} taps / μ ${next.config.stepSize} / seed ${next.config.seed}。${ports.referenceOnly ? '参考回放模式，实验参数固定。' : '修改参数后需重新计算。'}`;
    curves = ORDER.map(() => []);
    for (let sample = 1000; sample <= 32000; sample += 500) {
      const f = ports.engine.analyzeAt(next, sample, selected);
      f.microphones.forEach((m, i) => curves[i].push(m.reductionDb));
    }
    drawConvergence($<HTMLCanvasElement>('convergence'), curves);
  }
  $('calculate').onclick = async () => {
    if (busy) return;
    const request = beginRequest('calculation');
    const config = { ...DEFAULT_CONFIG, taps: Number($<HTMLSelectElement>('taps').value) as 32 | 64,
      stepSize: Number($<HTMLSelectElement>('step').value) as 0 | 0.08, seed: Number($<HTMLSelectElement>('seed').value) as 11 | 29 | 47 };
    $('status').textContent = 'Worker 正在计算 16 秒实验…';
    try {
      const next = await ports.engine.calculate(config, request.id);
      if (activeRequest !== request) return;
      if (next.runId !== request.id || next.source !== 'computed-browser' ||
          (Object.keys(config) as (keyof typeof config)[]).some(key => next.config[key] !== config[key])) {
        throw new Error('返回结果与本次实验请求不一致');
      }
      useResult(next);
    }
    catch (error) { if (activeRequest === request) $('status').textContent = `计算未完成：${String(error)}。${retainedResultMessage()}`; }
    finally { finishRequest(request); }
  };
  $('cancel').onclick = () => {
    const request = activeRequest;
    if (!request) return;
    // Invalidate before cancelling: cancellation can reject the engine promise immediately.
    activeRequest = null;
    if (request.kind === 'calculation') ports.engine.cancel();
    setBusy(false);
    $('status').textContent = `${request.kind === 'calculation' ? '计算' : '参考数据加载'}已取消。${retainedResultMessage()}`;
  };
  async function reference() {
    const request = beginRequest('reference');
    $('status').textContent = '正在加载参考数据…';
    try {
      const next = await ports.loadReference();
      if (activeRequest !== request) return;
      if (next.source !== 'reference-replay') throw new Error('返回数据不是参考算例');
      useResult(next);
    }
    catch (error) { if (activeRequest === request) $('status').textContent = `参考数据加载失败：${String(error)}。${retainedResultMessage()}`; }
    finally { finishRequest(request); }
  }
  $('reference').onclick = () => { if (!busy) void reference(); };
  select('e', 'fl');
  let fpsTime = performance.now(), count = 0;
  function render(now: number) {
    const time = player.currentTime;
    $('play').textContent = player.starting ? '取消启动' : player.playing ? '暂停' : '播放';
    $('time').textContent = `${time.toFixed(2).padStart(5, '0')} / 16.00 s`;
    $<HTMLInputElement>('seek').value = String(time);
    if (result && (lastCharts < 0 || now - lastCharts > 80)) {
      const end = Math.floor(time * 2000); frame = ports.engine.analyzeAt(result, end, selected); lastCharts = now;
      $('chart-time').textContent = end === 0 ? '波形准备中 · 点击播放或拖动进度' : `图表位置 ${(end / 2000).toFixed(2)} s · 最近 0.25 s`;
      $('spectrum-status').textContent = frame.spectrum ? `频谱截至 ${(end / 2000).toFixed(2)} s` : '频谱准备中 · 需要至少 0.512 s 数据';
      for (const id of ['wave', 'spectrum']) {
        const canvas = $(id); canvas.dataset.runId = frame.runId; canvas.dataset.endSample = String(frame.endSampleExclusive);
        canvas.dataset.signal = selected.signal; canvas.dataset.channel = selected.channel;
      }
      drawWaveform($<HTMLCanvasElement>('wave'), result, end, selected); drawSpectrum($<HTMLCanvasElement>('spectrum'), frame);
      drawConvergence($<HTMLCanvasElement>('convergence'), curves);
      $('metrics').innerHTML = frame.microphones.map((m, i) => `<div class="metric-card"><div><strong>${ORDER[i].toUpperCase()}</strong><span>${CORNER_NAMES[ORDER[i]]}</span><b>${m.reductionDb === null ? m.primaryRmsPa === null ? '准备中' : '能量过低' : `${m.reductionDb.toFixed(1)} dB`}</b></div><p>原声 ${m.primaryRmsPa === null ? '—' : ports.syntheticSpl(m.primaryRmsPa).toFixed(1)} <span>→</span> 残余 ${m.residualRmsPa === null ? '—' : ports.syntheticSpl(m.residualRmsPa).toFixed(1)} <small>dB SPL</small></p></div>`).join('');
    }
    viewer?.render(time, selected.signal === 'd' ? { ...selected, signal: 'e' } : selected, frame ? frame.microphones.map(m => m.residualRmsPa === null ? null : ports.syntheticSpl(m.residualRmsPa)) : [null, null, null, null]);
    count++; if (now - fpsTime > 1000) { $('fps').textContent = `${Math.round(count * 1000 / (now - fpsTime))} fps`; count = 0; fpsTime = now; }
  }
  function tick(now: number) { render(now); requestAnimationFrame(tick); }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { lastCharts = -1; render(performance.now()); }
  });
  requestAnimationFrame(tick);
  await reference();
}
