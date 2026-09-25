import type { Corner, Four, RunResult } from '../../shared/contracts';
import { ORDER } from '../../shared/contracts';

/** Single transport clock. Pa -> PCM gain is always 2 for both d and e. */
export class Player {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private result: { signals: Pick<RunResult['signals'], 'd' | 'e'> } | null = null;
  private duration = 16;
  private offset = 0;
  private startedAt = 0;
  private running = false;
  private pendingPlay: Promise<void> | null = null;
  private playGeneration = 0;
  private volume = 0.25;
  private muted = false;
  private channel: Corner = 'fl';
  private mode: 'd' | 'e' = 'e';

  get playing() { return this.running && this.currentTime < this.duration; }
  get starting() { return this.pendingPlay !== null; }
  get currentTime(): number {
    return this.positionAt(this.context?.currentTime ?? 0);
  }
  load<T extends { signals: Pick<RunResult['signals'], 'd' | 'e'> }>(result: T) { this.pause(); this.offset = 0; this.result = result; this.duration = result.signals.d[0].length / 2000; this.buffers.clear(); }
  play(): Promise<void> {
    if (!this.result || this.playing) return Promise.resolve();
    if (this.pendingPlay) return this.pendingPlay;
    const generation = ++this.playGeneration;
    const request = this.startPlayback(generation).finally(() => {
      if (generation === this.playGeneration) this.pendingPlay = null;
    });
    this.pendingPlay = request;
    return request;
  }
  private async startPlayback(generation: number) {
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain();
      this.master.connect(this.context.destination); this.setVolume(this.volume);
    }
    try { await this.context.resume(); }
    catch (error) { if (generation === this.playGeneration) throw error; else return; }
    if (generation !== this.playGeneration) return;
    const position = this.currentTime >= this.duration ? 0 : this.currentTime;
    // Buffer preparation must finish before the transport clock starts.
    const buffer = this.selectedBuffer();
    this.startSource(buffer, position, this.context.currentTime);
  }
  pause() {
    ++this.playGeneration; this.pendingPlay = null;
    this.offset = this.currentTime; this.running = false; this.stopActive();
  }
  seek(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    const wasPlaying = this.playing;
    this.pause();
    this.offset = Math.max(0, Math.min(this.duration, seconds));
    if (wasPlaying && this.offset < this.duration && this.context) {
      const buffer = this.selectedBuffer();
      this.startSource(buffer, this.offset, this.context.currentTime);
    }
  }
  setComparison(channel: Corner, mode: 'd' | 'e') {
    if (this.channel === channel && this.mode === mode) return;
    this.channel = channel; this.mode = mode;
    if (this.playing) this.replaceSource();
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.015);
  }
  setMuted(value: boolean) { this.muted = value; this.setVolume(this.volume); }
  private positionAt(time: number) {
    return Math.min(this.duration, this.offset + (this.running ? time - this.startedAt : 0));
  }
  private stopActive(time = this.context?.currentTime ?? 0) {
    if (!this.active || !this.context) return;
    const previous = this.active; this.active = null;
    previous.gain.gain.cancelAndHoldAtTime(time);
    previous.gain.gain.linearRampToValueAtTime(0, time + 0.03);
    previous.source.stop(time + 0.035);
  }
  private selectedBuffer(): AudioBuffer {
    if (!this.context || !this.result) throw new Error('尚未载入可播放实验');
    const key = `${this.channel}-${this.mode}`;
    let buffer = this.buffers.get(key);
    if (!buffer) {
      // Web Audio buffers may reject 2 kHz. Identical sinc interpolation to 16 kHz.
      const input = this.result.signals[this.mode][ORDER.indexOf(this.channel)];
      const pcm = resampleForAudio(input);
      buffer = this.context.createBuffer(1, pcm.length, 16000); buffer.copyToChannel(pcm, 0);
      this.buffers.set(key, buffer);
    }
    return buffer;
  }
  private replaceSource() {
    if (!this.context || !this.result) return;
    // Keep the old source audible while a previously unvisited seat/mode is prepared.
    const buffer = this.selectedBuffer(), now = this.context.currentTime;
    const position = this.positionAt(now);
    if (position >= this.duration) { this.pause(); return; }
    this.startSource(buffer, position, now);
  }
  private startSource(buffer: AudioBuffer, position: number, time: number) {
    if (!this.context || !this.master) throw new Error('音频尚未初始化');
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; source.connect(gain); gain.connect(this.master);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(1, time + 0.03);
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (this.active?.source === source) {
        this.active = null; this.offset = this.duration; this.running = false;
      }
    };
    try { source.start(time, position); }
    catch (error) { source.disconnect(); gain.disconnect(); throw error; }
    this.stopActive(time);
    this.offset = position; this.startedAt = time; this.running = true;
    this.active = { source, gain };
  }
}

function audioKernel() {
  const up = 8, kernel = new Float64Array(129);
  for (let i = 0; i < 129; i++) {
    const t = i - 64, x = 2 * 700 / 16000 * t;
    kernel[i] = 2 * 700 / 16000 * (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / 128));
  }
  const norm = kernel.reduce((sum, v) => sum + v, 0);
  return { up, kernel, norm };
}

type PlaybackResult = { signals: Pick<RunResult['signals'], 'd' | 'e'> };

/**
 * Protect the expanded lab's much wider source range with ONE gain for all seats and d/e.
 * Scaling precedes the legacy PCM limiter. Metrics/physical signals must retain the original result.
 * The sinc polyphase absolute row sum bounds interpolated peaks, including between-sample overshoot.
 */
export function prepareLabPlayback<T extends PlaybackResult>(input: T): { result: T; gain: number } {
  let peak = 0;
  for (const mode of ['d', 'e'] as const) for (const channel of input.signals[mode]) for (const value of channel) {
    if (!Number.isFinite(value)) throw new Error('试听声压必须是有限数值');
    peak = Math.max(peak, Math.abs(value));
  }
  const { up, kernel, norm } = audioKernel();
  const phases = new Float64Array(up);
  for (let k = 0; k < kernel.length; k++) phases[k % up] += Math.abs(kernel[k] * up / norm * 2);
  const bound = Math.max(...phases);
  // 0.90 leaves margin for Float32 summation and the existing 0.98 safety limiter.
  const gain = peak === 0 ? 1 : Math.min(1, 0.90 / (peak * bound));
  const scale = (channels: Four<Float32Array>) => channels.map(channel => channel.map(value => value * gain)) as unknown as Four<Float32Array>;
  return { gain, result: { ...input, signals: { ...input.signals, d: scale(input.signals.d), e: scale(input.signals.e) } } };
}

export function resampleForAudio(input: Float32Array): Float32Array<ArrayBuffer> {
  const { up, kernel, norm } = audioKernel();
  const output = new Float32Array(input.length * up);
  for (let n = 0; n < input.length; n++) for (let k = 0; k < kernel.length; k++) {
    const index = n * up + k - 64;
    if (index >= 0 && index < output.length) output[index] += input[n] * kernel[k] * up / norm * 2;
  }
  for (let i = 0; i < output.length; i++) output[i] = Math.max(-0.98, Math.min(0.98, output[i]));
  return output;
}
