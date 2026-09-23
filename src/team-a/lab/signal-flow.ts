import './signal-flow.css';

type Signal = 'q' | 'x' | 'u' | 'd' | 'a' | 'e';

export interface SignalFlow {
  setChannels(referenceNames: string[], enabledSpeakers: boolean[]): void;
  setSelected(signal: string, channel: number): void;
  render(time: number, playing: boolean, rncEnabled: boolean): void;
  dispose(): void;
}

const SIGNALS: Signal[] = ['q', 'x', 'u', 'd', 'a', 'e'];
const CORNERS = ['前左 FL', '前右 FR', '后左 RL', '后右 RR'];
const DESCRIPTIONS: Record<Signal, { title: string; unit: string; text: string }> = {
  q: { title: '轮端源激励', unit: 'm/s²', text: '四个轮胎处的等效激励，由车速、路面、胎面、胎压和温度参数生成。它是教学模型的源输入，经初级路径形成车内原噪声；与安装在结构件上的参考测量 x 分开。' },
  x: { title: '振动参考', unit: 'm/s²', text: '底盘加速度。提前感知与路噪相关的振动，为控制滤波器提供输入；它不是车内声压。' },
  u: { title: '扬声器驱动', unit: '归一化 drive', text: '多路参考经控制滤波器叠加后送给车门扬声器的电驱动量。它还需经过扬声器与声传播路径，才成为声压。' },
  d: { title: '原始噪声', unit: 'Pa', text: '四轮激励经初级路径叠加，在该头枕位置产生的声压。这里由仿真给出，用于同工况对比；控制器并不直接测量这一路。' },
  a: { title: '次级声压', unit: 'Pa', text: '所有启用扬声器经各自次级路径，在该头枕位置产生的声压之和。它与原噪声发生相干叠加，并非固定取反的原噪声。' },
  e: { title: '残余误差', unit: 'Pa', text: '头枕附近误差麦克风测得的总声压 e = d + a。四个误差点共同参与权重更新，目标是降低整体误差能量。' },
};

let nextId = 0;

/** A teaching diagram, not a second simulation or clock. All motion uses caller-supplied playback time. */
export function createSignalFlow(host: HTMLElement, onSelect: (signal: Signal, channel: number) => void): SignalFlow {
  const id = `rnc-signal-flow-${++nextId}`;
  const root = document.createElement('section');
  root.className = 'rnc-signal-flow';
  root.setAttribute('aria-labelledby', `${id}-heading`);
  root.innerHTML = `
    <div class="sf-heading"><h3 id="${id}-heading">RNC 信号流 · 多通道 FxLMS</h3><span class="sf-state" role="status"></span></div>
    <p class="sf-lead">上方是声的叠加，下方是控制与学习。点击框图或通道，查看对应波形和频谱。</p>
    <div class="sf-diagram">
      <svg viewBox="0 0 1000 445" role="group" aria-labelledby="${id}-diagram-title ${id}-diagram-desc">
        <title id="${id}-diagram-title">多输入、多输出、四误差点的前馈主动路噪控制</title>
        <desc id="${id}-diagram-desc">四轮噪声经初级路径形成原声 d；振动参考 x 经控制滤波器 W 形成驱动 u，u 经次级路径 S 形成次级声压 a。误差 e 等于 d 加 a。x 经次级路径估计 S 帽得到 filtered-x，与所有误差点一起更新 W。各路径是多通道矩阵，不是四套独立控制器。</desc>
        <defs><marker id="${id}-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" fill="context-stroke"/></marker></defs>
        <g class="sf-paths" fill="none" marker-end="url(#${id}-arrow)">
          <path class="sf-wire sf-acoustic" d="M165 90 H235"/><path class="sf-wire sf-acoustic" d="M405 90 H455"/>
          <path class="sf-wire sf-acoustic" d="M555 90 H806"/><path class="sf-wire sf-acoustic" d="M854 90 H875"/>
          <path class="sf-wire sf-reference" d="M92 125 V210"/>
          <path class="sf-wire sf-reference" d="M165 244 H235"/>
          <path class="sf-wire sf-control" d="M405 244 H455"/>
          <path class="sf-wire sf-control" d="M555 244 H595"/>
          <path class="sf-wire sf-control" d="M765 244 H780"/>
          <path class="sf-wire sf-control" d="M830 210 V114"/>
          <path class="sf-wire sf-learning" d="M190 244 V390 H235"/>
          <path class="sf-wire sf-learning" d="M405 390 H595"/>
          <path class="sf-wire sf-learning" d="M966 90 H985 V390 H765"/>
          <path class="sf-wire sf-learning" d="M680 356 V317 H320 V278"/>
        </g>
        <g class="sf-block sf-pick" data-sf-signal="q" role="button" tabindex="0" aria-label="选择轮端源激励 q" transform="translate(20 55)"><rect width="145" height="70"/><text x="72.5" y="28">四轮噪声源 q</text><text class="sf-sub" x="72.5" y="51">4 路 · m/s²</text></g>
        <g class="sf-block" transform="translate(235 55)"><rect width="170" height="70"/><text x="85" y="28">初级路径 H</text><text class="sf-sub" x="85" y="51">四轮 → 四个误差点</text></g>
        <g class="sf-block sf-pick" data-sf-signal="d" role="button" tabindex="0" aria-label="选择原始噪声 d" transform="translate(455 55)"><rect width="100" height="70"/><text x="50" y="28">原声 d</text><text class="sf-sub" x="50" y="51">4 路 · Pa</text></g>
        <g class="sf-sum"><circle cx="830" cy="90" r="24"/><text x="830" y="97">＋</text></g>
        <text class="sf-annotation" x="656" y="73">d + a 在同一位置叠加</text>
        <g class="sf-block sf-pick" data-sf-signal="e" role="button" tabindex="0" aria-label="选择残余误差 e" transform="translate(875 55)"><rect width="91" height="70"/><text x="45.5" y="28">误差 e</text><text class="sf-sub" x="45.5" y="51">4 路 · Pa</text></g>
        <text class="sf-annotation" x="97" y="169">振动测量</text>
        <g class="sf-block sf-pick" data-sf-signal="x" role="button" tabindex="0" aria-label="选择振动参考 x" transform="translate(20 210)"><rect width="145" height="68"/><text x="72.5" y="27">参考 x</text><text class="sf-sub sf-ref-count" x="72.5" y="50">4 路 · m/s²</text></g>
        <g class="sf-block sf-control-block" transform="translate(235 210)"><rect width="170" height="68"/><text x="85" y="27">控制滤波器 W</text><text class="sf-sub sf-weight-count" x="85" y="50">4 输出 × 4 参考</text></g>
        <g class="sf-block sf-pick sf-control-block" data-sf-signal="u" role="button" tabindex="0" aria-label="选择扬声器驱动 u" transform="translate(455 210)"><rect width="100" height="68"/><text x="50" y="27">驱动 u</text><text class="sf-sub sf-output-count" x="50" y="50">4 / 4 启用</text></g>
        <g class="sf-block sf-control-block" transform="translate(595 210)"><rect width="170" height="68"/><text x="85" y="27">次级路径 S</text><text class="sf-sub" x="85" y="50">扬声器 → 误差点</text></g>
        <g class="sf-block sf-pick sf-control-block" data-sf-signal="a" role="button" tabindex="0" aria-label="选择次级声压 a" transform="translate(780 210)"><rect width="100" height="68"/><text x="50" y="27">次级声 a</text><text class="sf-sub" x="50" y="50">4 路 · Pa</text></g>
        <text class="sf-annotation" x="837" y="165">声压求和</text>
        <g class="sf-block sf-learning-block" transform="translate(235 356)"><rect width="170" height="68"/><text x="85" y="27">次级路径估计 Ŝ</text><text class="sf-sub" x="85" y="50">参考经 Ŝ 滤波</text></g>
        <text class="sf-annotation" x="459" y="376">Filtered-x</text>
        <g class="sf-block sf-learning-block" transform="translate(595 356)"><rect width="170" height="68"/><text x="85" y="27">FxLMS 权重更新</text><text class="sf-sub" x="85" y="50">所有误差点共同参与</text></g>
        <text class="sf-annotation" x="880" y="375">误差反馈</text>
        <text class="sf-annotation" x="368" y="307">更新 W；μ = 0 时权重不变</text>
      </svg>
    </div>
    <ol class="sf-compact-flow" aria-label="信号路径文字版">
      <li><b>原声：</b>四轮源 q → 初级路径 H → d。</li>
      <li><b>控制：</b>振动参考 x → W → 扬声器 u → 次级路径 S → a。</li>
      <li><b>叠加：</b>头枕误差麦克风测得 e = d + a。</li>
      <li><b>学习：</b>x → Ŝ → Filtered-x，与全部误差 e 共同更新 W。</li>
    </ol>
    <p class="sf-matrix-note"></p>
    <div class="sf-channels"></div>
    <div class="sf-explanation" aria-live="polite" aria-atomic="true"><strong></strong><p></p></div>
    <details class="sf-more"><summary>理解符号、动画与数据</summary>
      <p>本图采用物理叠加符号：e = d + a；控制器通过调整 W，让 a 在目标位置抵消部分 d。多个扬声器同时影响多个误差点，不能把它理解为四套互不相关的系统。</p>
      <p>虚线移动只表示信号方向，跟随统一回放时间；不是声速、声压大小或实时学习进度。暂停后静止，拖动进度会定位动画。实际波形、频谱与降噪量由本次计算结果提供。</p>
      <p>Ŝ 是次级路径的估计，用来考虑扬声器到麦克风之间的传播；Filtered-x 与误差反馈决定权重更新。步长为零时，权重保持不变。</p>
      <p>依据：<a href="https://www.mathworks.com/help/audio/ug/active-noise-control-using-a-filtered-x-lms-fir-adaptive-filter.html" target="_blank" rel="noreferrer">MathWorks：Filtered-X LMS 主动噪声控制</a>；<a href="https://www.mathworks.com/help/dsp/ref/dsp.filteredxlmsfilter-system-object.html" target="_blank" rel="noreferrer">FilteredXLMSFilter 次级路径与估计</a>。</p>
    </details>`;
  host.append(root);

  let referenceNames = CORNERS.map(corner => `REF ${corner}`);
  let enabledSpeakers = [true, true, true, true];
  let selected: { signal: Signal; channel: number } = { signal: 'e', channel: 0 };
  let disposed = false;
  let lastState = '';
  let currentRncEnabled = false;
  let currentTime = 0;
  let currentPlaying = false;
  const channels = root.querySelector<HTMLElement>('.sf-channels')!;
  const state = root.querySelector<HTMLElement>('.sf-state')!;
  const explanationTitle = root.querySelector<HTMLElement>('.sf-explanation strong')!;
  const explanationText = root.querySelector<HTMLElement>('.sf-explanation p')!;
  const wires = [...root.querySelectorAll<SVGPathElement>('.sf-wire')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function updateSelection(): void {
    for (const node of root.querySelectorAll<HTMLElement | SVGGElement>('[data-sf-signal]')) {
      const active = node.dataset.sfSignal === selected.signal &&
        (node.dataset.sfChannel === undefined || Number(node.dataset.sfChannel) === selected.channel);
      node.setAttribute('aria-pressed', String(active));
    }
    const info = DESCRIPTIONS[selected.signal];
    const channelName = selected.signal === 'x' ? referenceNames[selected.channel] : CORNERS[selected.channel];
    explanationTitle.textContent = `${selected.signal} · ${info.title} · ${channelName} · ${info.unit}`;
    const disabled = selected.signal === 'u' && !enabledSpeakers[selected.channel];
    explanationText.textContent = info.text + (disabled ? ' 此扬声器已在当前实验中禁用，驱动为零；其它扬声器仍可影响各误差点。' : '');
  }

  function buildChannels(): void {
    channels.replaceChildren();
    for (const signal of SIGNALS) {
      const group = document.createElement('fieldset');
      group.className = `sf-channel-group sf-channel-${signal}`;
      const legend = document.createElement('legend');
      legend.textContent = `${signal} · ${DESCRIPTIONS[signal].title}`;
      group.append(legend);
      const row = document.createElement('div');
      row.className = 'sf-channel-buttons';
      (signal === 'x' ? referenceNames : CORNERS).forEach((name, channel) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.sfSignal = signal;
        button.dataset.sfChannel = String(channel);
        button.textContent = name;
        button.setAttribute('aria-label', `${DESCRIPTIONS[signal].title} ${name}，查看波形和频谱`);
        if (signal === 'u' && !enabledSpeakers[channel]) {
          button.dataset.sfEnabled = 'false';
          const status = document.createElement('small');
          status.textContent = '已禁用 · u = 0';
          button.append(status);
          button.setAttribute('aria-label', `${name} 扬声器已禁用，查看零驱动信号`);
        }
        row.append(button);
      });
      group.append(row);
      channels.append(group);
    }
    root.querySelector('.sf-ref-count')!.textContent = `${referenceNames.length} 路 · m/s²`;
    root.querySelector('.sf-weight-count')!.textContent = `4 输出 × ${referenceNames.length} 参考`;
    root.querySelector('.sf-output-count')!.textContent = `${enabledSpeakers.filter(Boolean).length} / 4 启用`;
    root.querySelector('.sf-matrix-note')!.textContent =
      `${referenceNames.length} 路参考 × 4 个扬声器槽位 × 4 个固定误差点。W 有 ${referenceNames.length * 4} 组滤波器，S 包含全部 16 条交叉路径；禁用通道的驱动为零。`;
    updateSelection();
  }

  function pick(node: Element): void {
    const target = node.closest<HTMLElement | SVGGElement>('[data-sf-signal]');
    if (!target || !root.contains(target)) return;
    const signal = target.dataset.sfSignal as Signal;
    if (!SIGNALS.includes(signal)) return;
    const channel = target.dataset.sfChannel === undefined
      ? (selected.signal === signal ? selected.channel : 0)
      : Number(target.dataset.sfChannel);
    selected = { signal, channel };
    updateSelection();
    onSelect(signal, channel);
  }

  function click(event: MouseEvent): void {
    if (event.target instanceof Element) pick(event.target);
  }

  function keydown(event: KeyboardEvent): void {
    // Native HTML buttons already dispatch clicks for Enter/Space.
    if (event.target instanceof SVGElement && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      pick(event.target);
    }
  }

  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  buildChannels();

  const api: SignalFlow = {
    setChannels(names, speakers) {
      if (disposed) return;
      if (names.length < 1 || names.length > 8 || names.some(name => !name.trim())) {
        throw new RangeError('信号流需要 1–8 路非空参考名称。');
      }
      if (speakers.length !== 4 || speakers.some(enabled => typeof enabled !== 'boolean')) {
        throw new RangeError('信号流需要 4 个扬声器启用状态。');
      }
      referenceNames = [...names];
      enabledSpeakers = [...speakers];
      if (selected.signal === 'x' && selected.channel >= names.length) selected.channel = 0;
      buildChannels();
      lastState = '';
      api.render(currentTime, currentPlaying, currentRncEnabled);
    },
    setSelected(signal, channel) {
      if (disposed || !SIGNALS.includes(signal as Signal) || !Number.isInteger(channel) || channel < 0) return;
      if (channel >= (signal === 'x' ? referenceNames.length : 4)) return;
      selected = { signal: signal as Signal, channel };
      updateSelection();
    },
    render(time, playing, rncEnabled) {
      if (disposed) return;
      currentRncEnabled = rncEnabled;
      currentTime = time;
      currentPlaying = playing;
      const active = rncEnabled && enabledSpeakers.some(Boolean);
      const phase = reducedMotion.matches ? 0 : -(Math.max(0, Number.isFinite(time) ? time : 0) * 26) % 20;
      for (const wire of wires) {
        const controlled = wire.classList.contains('sf-control') || wire.classList.contains('sf-learning');
        wire.style.strokeDashoffset = controlled && !active ? '0' : String(phase);
      }
      root.dataset.controlActive = String(active);
      root.dataset.playing = String(playing);
      const nextState = !rncEnabled ? '控制未生效 · u = a = 0，e = d'
        : !active ? '全部扬声器禁用 · u = a = 0，e = d'
          : `RNC 启用 · ${enabledSpeakers.filter(Boolean).length}/4 扬声器`;
      const text = `${playing ? '回放中' : '已暂停'} ｜ ${nextState}`;
      if (lastState !== text) { state.textContent = text; lastState = text; }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeEventListener('click', click);
      root.removeEventListener('keydown', keydown);
      root.remove();
    },
  };
  api.render(0, false, false);
  return api;
}
