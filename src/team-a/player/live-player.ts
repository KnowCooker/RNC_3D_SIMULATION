import { ORDER, type Corner } from '../../shared/contracts';
import type { LabChunk } from '../../shared/lab-contracts';

const INPUT_RATE = 2000, AUDIO_RATE = 16000, UP = 8, HALF_KERNEL = 64;
const LOOKAHEAD = 320, MAX_QUEUED_SECONDS = 2, FADE_SECONDS = 0.015;
const kernel = Float64Array.from({ length: 129 }, (_, i) => {
  const x = 2 * 700 / AUDIO_RATE * (i - HALF_KERNEL);
  return 2 * 700 / AUDIO_RATE * (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x))
    * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / 128));
});
const norm = kernel.reduce((sum, value) => sum + value, 0);
for (let i = 0; i < kernel.length; i++) kernel[i] *= UP / norm * 2;

export interface AudioSegment { startSample: number; channels: Float32Array[] }

/**
 * Continuous zero-phase 2 -> 16 kHz sinc interpolation, with 8 input samples of
 * real lookahead (no zero padding at chunk boundaries). The extra 20 ms permits
 * a smooth shared safety envelope. Its gain only decreases within one run;
 * all eight seats/comparisons receive exactly the same gain at each instant.
 */
export class StreamingAudioResampler {
  private input = Array.from({ length: 8 }, () => new Float64Array(32));
  private received = 0;
  private rawCount = 0;
  private emitted = 0;
  private pending = Array.from({ length: LOOKAHEAD + 1 }, () => new Float64Array(8));
  private minima: { index: number; ceiling: number; safe: number }[] = [];
  private head = 0;
  private gain = 1;

  get safetyGain() { return this.gain; }
  get latencySeconds() { return 8 / INPUT_RATE + LOOKAHEAD / AUDIO_RATE; }
  get retainedSamples() { return 8 * (32 + LOOKAHEAD + 1) + this.minima.length - this.head; }

  push(channels: readonly Float32Array[]): AudioSegment | null {
    if (channels.length !== 8 || channels.some(channel => channel.length !== channels[0].length)) throw new Error('试听需要等长的八路 d/e');
    const output: number[][] = Array.from({ length: 8 }, () => []);
    const startSample = this.emitted;
    for (let sample = 0; sample < channels[0].length; sample++) {
      for (let channel = 0; channel < 8; channel++) {
        const value = channels[channel][sample];
        if (!Number.isFinite(value)) throw new Error('试听输入必须是有限数值');
        this.input[channel][this.received % 32] = value;
      }
      const center = this.received++ - 8;
      if (center < 0) continue;
      for (let phase = 0; phase < UP; phase++) {
        const values = this.pending[this.rawCount % this.pending.length];
        values.fill(0);
        for (let coefficient = phase; coefficient < kernel.length; coefficient += UP) {
          const index = center + (phase + HALF_KERNEL - coefficient) / UP;
          if (index < 0) continue; // Physical start of run only, never a chunk boundary.
          for (let channel = 0; channel < 8; channel++) values[channel] += this.input[channel][index % 32] * kernel[coefficient];
        }
        const peak = values.reduce((value, sampleValue) => Math.max(value, Math.abs(sampleValue)), 0);
        const safe = peak > 0.9 ? 0.9 / peak : 1;
        // Future ceilings form a slope-limited attack. Sliding minimum is O(n).
        const entry = { index: this.rawCount, safe, ceiling: safe + this.rawCount / LOOKAHEAD };
        while (this.minima.length > this.head && this.minima[this.minima.length - 1].ceiling >= entry.ceiling) this.minima.pop();
        this.minima.push(entry);
        if (this.rawCount >= LOOKAHEAD) {
          const n = this.rawCount - LOOKAHEAD;
          while (this.minima[this.head].index < n) this.head++;
          const ready = this.pending[n % this.pending.length];
          const readyPeak = ready.reduce((value, sampleValue) => Math.max(value, Math.abs(sampleValue)), 0);
          const minimum = this.minima[this.head];
          this.gain = Math.min(this.gain, readyPeak > 0.9 ? 0.9 / readyPeak : 1, minimum.safe + (minimum.index - n) / LOOKAHEAD);
          for (let channel = 0; channel < 8; channel++) output[channel].push(ready[channel] * this.gain);
          this.emitted++;
        }
        this.rawCount++;
        if (this.head > 1024) { this.minima = this.minima.slice(this.head); this.head = 0; }
      }
    }
    return this.emitted === startSample ? null : { startSample, channels: output.map(values => Float32Array.from(values)) };
  }
}

type Segment = AudioSegment & { buffer?: AudioBuffer; epoch?: number };
type Source = { node: AudioBufferSourceNode; end: number; transport: GainNode };
export type LivePlayerStatus = 'idle' | 'starting' | 'buffering' | 'playing' | 'paused' | 'disposed';

/** Bounded streaming transport. Simulation time advances only over actual scheduled samples. */
export class LivePlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private splitter: ChannelSplitterNode | null = null;
  private comparisons: GainNode[] = [];
  private selected = 4;
  private comparisonFade = { time: 0, from: [0, 0, 0, 0, 1, 0, 0, 0], to: [0, 0, 0, 0, 1, 0, 0, 0] };
  private volume = 0.25;
  private muted = false;
  private stream = new StreamingAudioResampler();
  private segments: Segment[] = [];
  private sources = new Set<Source>();
  private transports = new Set<GainNode>();
  private transport: GainNode | null = null;
  private anchor: { contextTime: number; simulationTime: number; end: number } | null = null;
  private position = 0;
  private received = 0;
  private published = 0;
  private runId: string | null = null;
  private references = 0;
  private enabled = false;
  private disposed = false;
  private epoch = 0;
  private generation = 0;
  private pendingStart: Promise<void> | null = null;
  private underrunCount = 0;

  /** Remains true while buffering, so a producer can refill after an underrun. */
  get playing() { return this.enabled; }
  get starting() { return this.pendingStart !== null; }
  get currentTime() { this.refresh(); return this.position; }
  get bufferedUntil() { return this.received / INPUT_RATE; }
  get playableUntil() { return this.published / AUDIO_RATE; }
  get queuedSeconds() { return this.bufferedUntil - this.currentTime; }
  get safetyGain() { return this.stream.safetyGain; }
  get underruns() { this.refresh(); return this.underrunCount; }
  get status(): LivePlayerStatus {
    this.refresh();
    if (this.disposed) return 'disposed';
    if (this.starting) return 'starting';
    if (this.enabled) return this.anchor ? 'playing' : 'buffering';
    return this.runId === null ? 'idle' : 'paused';
  }

  start(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('实时播放器已释放'));
    if (this.pendingStart) return this.pendingStart;
    if (this.enabled) return Promise.resolve();
    const generation = ++this.generation;
    const request = this.resume(generation).finally(() => { if (generation === this.generation) this.pendingStart = null; });
    this.pendingStart = request;
    return request;
  }

  private async resume(generation: number) {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.connect(this.context.destination);
      this.splitter = this.context.createChannelSplitter(8);
      this.comparisons = Array.from({ length: 8 }, (_, index) => {
        const gain = this.context!.createGain();
        gain.gain.setValueAtTime(index === this.selected ? 1 : 0, this.context!.currentTime);
        this.splitter!.connect(gain, index); gain.connect(this.master!);
        return gain;
      });
      this.comparisonFade = { time: this.context.currentTime, from: this.comparisons.map((_, index) => Number(index === this.selected)), to: this.comparisons.map((_, index) => Number(index === this.selected)) };
      this.setVolume(this.volume);
    }
    try { await this.context.resume(); }
    catch (error) { if (generation === this.generation) throw error; else return; }
    if (generation !== this.generation || this.disposed) return;
    this.enabled = true;
    try { this.pump(); }
    catch (error) { this.pause(); throw error; }
  }

  enqueue(chunk: LabChunk) {
    if (this.disposed) throw new Error('实时播放器已释放');
    this.validate(chunk);
    if ((this.received + chunk.sampleCount) / INPUT_RATE - this.currentTime > MAX_QUEUED_SECONDS + 1e-9) throw new Error('实时音频前瞻超过 2 秒，请等待播放消费后再补块');
    const output = this.stream.push([...chunk.signals.d, ...chunk.signals.e]);
    this.runId = chunk.runId; this.references = chunk.signals.x.length;
    this.received += chunk.sampleCount;
    if (output) {
      this.published = output.startSample + output.channels[0].length;
      this.segments.push(output);
    }
    try { this.pump(); }
    catch (error) { this.pause(); throw error; }
  }

  pause() {
    this.refresh();
    const rampStart = this.anchor?.contextTime;
    ++this.generation; this.pendingStart = null; this.enabled = false; this.anchor = null;
    const now = this.context?.currentTime ?? 0;
    if (this.transport) {
      this.transport.gain.cancelScheduledValues(now);
      this.transport.gain.setValueAtTime(rampStart === undefined ? 1 : Math.max(0, Math.min(1, (now - rampStart) / FADE_SECONDS)), now);
      this.transport.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    }
    for (const source of this.sources) {
      source.end = Math.min(source.end, now + FADE_SECONDS);
      source.node.stop(source.end);
    }
    this.transport = null;
    for (const transport of [...this.transports]) if (![...this.sources].some(source => source.transport === transport)) {
      transport.disconnect(); this.transports.delete(transport);
    }
    ++this.epoch;
  }

  reset() {
    this.pause();
    this.segments = []; this.stream = new StreamingAudioResampler();
    this.position = this.received = this.published = this.references = this.underrunCount = 0;
    this.runId = null;
  }

  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true;
    for (const source of [...this.sources]) this.release(source);
    for (const transport of this.transports) transport.disconnect();
    this.transports.clear();
    this.splitter?.disconnect(); this.comparisons.forEach(gain => gain.disconnect()); this.master?.disconnect();
    void this.context?.close().catch(() => {});
    this.context = null; this.master = null; this.splitter = null; this.comparisons = [];
  }

  setComparison(channel: Corner, mode: 'd' | 'e') {
    const index = ORDER.indexOf(channel) + (mode === 'e' ? 4 : 0);
    if (!ORDER.includes(channel) || (mode !== 'd' && mode !== 'e')) throw new Error('未知试听通道');
    if (this.selected === index) return;
    this.selected = index;
    if (!this.context) return;
    const now = this.context.currentTime, fraction = Math.max(0, Math.min(1, (now - this.comparisonFade.time) / 0.03));
    const from = this.comparisonFade.from.map((value, i) => value + (this.comparisonFade.to[i] - value) * fraction);
    const to = from.map((_, i) => Number(i === index));
    for (let i = 0; i < 8; i++) {
      const param = this.comparisons[i].gain;
      param.cancelScheduledValues(now); param.setValueAtTime(from[i], now); param.linearRampToValueAtTime(to[i], now + 0.03);
    }
    this.comparisonFade = { time: now, from, to };
  }

  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.015);
  }
  setMuted(value: boolean) { this.muted = value; this.setVolume(this.volume); }

  private validate(chunk: LabChunk) {
    if (!chunk || typeof chunk.runId !== 'string' || !chunk.runId || (this.runId !== null && chunk.runId !== this.runId)) throw new Error('实时块 runId 不一致，请先 reset');
    if (!Number.isSafeInteger(chunk.startSample) || chunk.startSample !== this.received || !Number.isSafeInteger(chunk.sampleCount) || chunk.sampleCount < 1 || chunk.sampleCount > INPUT_RATE * MAX_QUEUED_SECONDS) throw new Error('实时块必须从 0 开始、连续且长度有效');
    if (!chunk.signals || !Array.isArray(chunk.sources) || chunk.sources.length !== 4 || !Array.isArray(chunk.signals.x) || chunk.signals.x.length < 1 || chunk.signals.x.length > 8 || (this.references && chunk.signals.x.length !== this.references)) throw new Error('实时块通道维度无效');
    const groups = [chunk.sources, chunk.signals.x];
    for (const mode of ['u', 'd', 'a', 'e'] as const) {
      const channels = chunk.signals[mode];
      if (!Array.isArray(channels) || channels.length !== 4) throw new Error('实时块需要四路 u/d/a/e');
      groups.push(channels);
    }
    for (const group of groups) for (const channel of group) {
      if (!(channel instanceof Float32Array) || channel.length !== chunk.sampleCount || !channel.every(Number.isFinite)) throw new Error('实时块样本长度或数值无效');
    }
  }

  private refresh() {
    const now = this.context?.currentTime ?? 0;
    if (this.anchor && this.enabled) {
      this.position = Math.min(this.anchor.end, this.anchor.simulationTime + Math.max(0, now - this.anchor.contextTime));
      if (this.position >= this.anchor.end && now >= this.anchor.contextTime + this.anchor.end - this.anchor.simulationTime) {
        this.anchor = null; this.underrunCount++;
      }
    }
    while (this.segments.length && this.segmentEnd(this.segments[0]) <= this.position + 1e-10) this.segments.shift();
    for (const source of [...this.sources]) if (source.end <= now) this.release(source);
  }

  private segmentEnd(segment: AudioSegment) { return (segment.startSample + segment.channels[0].length) / AUDIO_RATE; }

  private pump() {
    this.refresh();
    if (!this.enabled || !this.context || !this.splitter || !this.segments.length) return;
    // Allocate before choosing the new anchor, so preparation never skips samples.
    for (const segment of this.segments) if (!segment.buffer) {
      segment.buffer = this.context.createBuffer(8, segment.channels[0].length, AUDIO_RATE);
      segment.channels.forEach((channel, index) => segment.buffer!.copyToChannel(channel as Float32Array<ArrayBuffer>, index));
    }
    this.refresh();
    if (!this.segments.length) return;
    if (!this.anchor) {
      ++this.epoch;
      if (this.transport && ![...this.sources].some(source => source.transport === this.transport)) {
        this.transport.disconnect(); this.transports.delete(this.transport);
      }
      this.transport = this.context.createGain(); this.transports.add(this.transport);
      this.transport.channelCount = 8; this.transport.channelCountMode = 'explicit';
      this.transport.connect(this.splitter);
      const now = this.context.currentTime + 0.01;
      this.transport.gain.setValueAtTime(0, now); this.transport.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
      this.anchor = { contextTime: now, simulationTime: this.position, end: this.position };
    }
    for (const segment of this.segments) {
      if (segment.epoch === this.epoch) continue;
      const begin = Math.max(this.position, segment.startSample / AUDIO_RATE), end = this.segmentEnd(segment);
      if (end <= begin) continue;
      const node = this.context.createBufferSource(); node.buffer = segment.buffer!; node.connect(this.transport!);
      const when = this.anchor.contextTime + begin - this.anchor.simulationTime;
      const source = { node, end: this.anchor.contextTime + end - this.anchor.simulationTime, transport: this.transport! };
      node.onended = () => { this.release(source); this.refresh(); };
      try { node.start(when, begin - segment.startSample / AUDIO_RATE); }
      catch (error) { node.disconnect(); throw error; }
      this.sources.add(source); segment.epoch = this.epoch; this.anchor.end = end;
    }
  }

  private release(source: Source) {
    if (!this.sources.delete(source)) return;
    source.node.onended = null; source.node.disconnect();
    if (source.transport !== this.transport && ![...this.sources].some(active => active.transport === source.transport)) {
      source.transport.disconnect(); this.transports.delete(source.transport);
    }
  }
}
