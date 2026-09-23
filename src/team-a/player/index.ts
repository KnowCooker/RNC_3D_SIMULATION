import type { Corner, RunResult } from '../../shared/contracts';
import { ORDER } from '../../shared/contracts';

/** Single transport clock. Pa -> PCM gain is always 2 for both d and e. */
export class Player {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private result: RunResult | null = null;
  private offset = 0;
  private startedAt = 0;
  private running = false;
  private volume = 0.25;
  private muted = false;
  private channel: Corner = 'fl';
  private mode: 'd' | 'e' = 'e';

  get playing() { return this.running && this.currentTime < 16; }
  get currentTime(): number {
    return Math.min(16, this.offset + (this.running && this.context ? this.context.currentTime - this.startedAt : 0));
  }
  load(result: RunResult) { this.pause(); this.offset = 0; this.result = result; this.buffers.clear(); }
  async play() {
    if (!this.result || this.playing) return;
    if (!this.context) {
      this.context = new AudioContext(); this.master = this.context.createGain();
      this.master.connect(this.context.destination); this.setVolume(this.volume);
    }
    await this.context.resume();
    if (this.currentTime >= 16) this.offset = 0;
    this.startedAt = this.context.currentTime; this.running = true; this.replaceSource();
  }
  pause() {
    this.offset = this.currentTime; this.running = false; this.stopActive();
  }
  seek(seconds: number) {
    this.offset = Math.max(0, Math.min(16, seconds));
    if (this.running && this.context) { this.startedAt = this.context.currentTime; this.replaceSource(); }
  }
  setComparison(channel: Corner, mode: 'd' | 'e') {
    this.channel = channel; this.mode = mode;
    if (this.playing) this.replaceSource();
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.015);
  }
  setMuted(value: boolean) { this.muted = value; this.setVolume(this.volume); }
  private stopActive() {
    if (!this.active || !this.context) return;
    const previous = this.active; this.active = null;
    previous.gain.gain.cancelAndHoldAtTime(this.context.currentTime);
    previous.gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.03);
    previous.source.stop(this.context.currentTime + 0.035);
  }
  private replaceSource() {
    this.stopActive();
    if (!this.context || !this.master || !this.result || this.currentTime >= 16) return;
    const key = `${this.channel}-${this.mode}`;
    let buffer = this.buffers.get(key);
    if (!buffer) {
      // Web Audio buffers may reject 2 kHz. Identical sinc interpolation to 16 kHz.
      const input = this.result.signals[this.mode][ORDER.indexOf(this.channel)];
      const pcm = resampleForAudio(input);
      buffer = this.context.createBuffer(1, pcm.length, 16000); buffer.copyToChannel(pcm, 0);
      this.buffers.set(key, buffer);
    }
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; source.connect(gain); gain.connect(this.master);
    gain.gain.setValueAtTime(0, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(1, this.context.currentTime + 0.03);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(0, this.currentTime); this.active = { source, gain };
  }
}

export function resampleForAudio(input: Float32Array): Float32Array<ArrayBuffer> {
  const up = 8, kernel = new Float64Array(129);
  for (let i = 0; i < 129; i++) {
    const t = i - 64, x = 2 * 700 / 16000 * t;
    kernel[i] = 2 * 700 / 16000 * (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / 128));
  }
  const norm = kernel.reduce((sum, v) => sum + v, 0);
  const output = new Float32Array(input.length * up);
  for (let n = 0; n < input.length; n++) for (let k = 0; k < kernel.length; k++) {
    const index = n * up + k - 64;
    if (index >= 0 && index < output.length) output[index] += input[n] * kernel[k] * up / norm * 2;
  }
  for (let i = 0; i < output.length; i++) output[i] = Math.max(-0.98, Math.min(0.98, output[i]));
  return output;
}
