import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { Four } from '../src/shared/contracts';
import type { LabChunk } from '../src/shared/lab-contracts';
import { LivePlayer, StreamingAudioResampler } from '../src/team-a/player/live-player';
import { resampleForAudio } from '../src/team-a/player';

function chunk(startSample: number, sampleCount = 400, amplitude = 0.04, runId = 'live'): LabChunk {
  const d = Array.from({ length: 4 }, (_, seat) => Float32Array.from({ length: sampleCount }, (_, n) => amplitude * (seat + 1) * Math.sin(2 * Math.PI * 125 * (n + startSample) / 2000))) as unknown as Four<Float32Array>;
  return { runId, startSample, sampleCount, sources: d, signals: { x: [...d], u: d, d, a: d, e: d.map(channel => channel.map(value => value / 4)) as unknown as Four<Float32Array> } };
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class FakeParam {
  value = 1;
  events: { kind: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.value = value; this.events.push({ kind: 'set', value, time }); }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ kind: 'ramp', value, time }); }
  setTargetAtTime(value: number, time: number) { this.value = value; this.events.push({ kind: 'target', value, time }); }
  cancelScheduledValues(time: number) { this.events.push({ kind: 'cancel', value: this.value, time }); }
}
class FakeGain {
  gain = new FakeParam(); channelCount = 2; channelCountMode = 'max'; disconnected = false;
  connect(_target: unknown, _channel?: number) {}
  disconnect() { this.disconnected = true; }
}
class FakeBuffer {
  data: Float32Array[];
  constructor(public channels: number, public length: number, public sampleRate: number) { this.data = Array.from({ length: channels }, () => new Float32Array(length)); }
  copyToChannel(data: Float32Array, index: number) { this.data[index].set(data); }
  get duration() { return this.length / this.sampleRate; }
}
class FakeSource {
  buffer: FakeBuffer | null = null; onended: (() => void) | null = null;
  startTime = -1; offset = -1; stopTime = Infinity; disconnected = false;
  target: unknown;
  connect(target: unknown) { this.target = target; }
  disconnect() { this.disconnected = true; }
  start(time: number, offset = 0) { this.startTime = time; this.offset = offset; }
  stop(time: number) { this.stopTime = time; }
  get endTime() { return Math.min(this.stopTime, this.startTime + this.buffer!.duration - this.offset); }
}
class FakeContext {
  currentTime = 0; destination = {}; sources: FakeSource[] = []; gains: FakeGain[] = []; buffers: FakeBuffer[] = [];
  resumeGate: ReturnType<typeof deferred> | null = null; resumeCalls = 0; closed = false; preparationSeconds = 0;
  resume() { this.resumeCalls++; return this.resumeGate?.promise ?? Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
  createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createChannelSplitter(channels: number) { assert.equal(channels, 8); return new FakeGain(); }
  createBuffer(channels: number, length: number, rate: number) { this.currentTime += this.preparationSeconds; const buffer = new FakeBuffer(channels, length, rate); this.buffers.push(buffer); return buffer; }
  createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source; }
  advance(seconds: number) { this.currentTime += seconds; for (const source of this.sources) if (!source.disconnected && source.endTime <= this.currentTime) source.onended?.(); }
}
function setup(t: TestContext) {
  const context = new FakeContext(), descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: function () { return context; } });
  const player = new LivePlayer();
  t.after(() => { player.dispose(); if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
  return { player, context };
}

test('streaming sinc is independent of chunk partition and matches continuous interpolation before the real lookahead tail', () => {
  const whole = chunk(0, 5000, 0.01), channels = [...whole.signals.d, ...whole.signals.e];
  const one = new StreamingAudioResampler(), many = new StreamingAudioResampler();
  const expected = one.push(channels)!;
  const actual: number[][] = Array.from({ length: 8 }, () => []);
  let offset = 0;
  for (const size of [1, 7, 11, 400, 37, 200, 1024, 3320]) {
    const count = Math.min(size, 5000 - offset);
    const result = many.push(channels.map(channel => channel.slice(offset, offset + count)));
    if (result) result.channels.forEach((channel, i) => actual[i].push(...channel));
    offset += count;
  }
  assert.equal(offset, 5000);
  assert.equal(expected.channels[0].length, (5000 - 8) * 8 - 320);
  for (let channel = 0; channel < 8; channel++) {
    assert.deepEqual(Float32Array.from(actual[channel]), expected.channels[channel]);
    const reference = resampleForAudio(channels[channel]);
    for (let n = 0; n < expected.channels[channel].length; n++) assert.ok(Math.abs(expected.channels[channel][n] - reference[n]) < 3e-8);
  }
  assert.equal(many.latencySeconds, 0.024);
  assert.equal(many.safetyGain, 1);
});

test('common lookahead safety envelope preserves all eight d/e ratios, bounds peaks and retains bounded memory', () => {
  const stream = new StreamingAudioResampler();
  let previousGain = 1;
  for (let start = 0; start < 100000; start += 400) {
    const input = chunk(start, 400, start < 1000 ? 0.01 : 10000), before = structuredClone(input);
    const result = stream.push([...input.signals.d, ...input.signals.e]);
    assert.deepEqual(input, before);
    assert.ok(stream.safetyGain <= previousGain);
    previousGain = stream.safetyGain;
    if (result) for (let n = 0; n < result.channels[0].length; n++) for (let seat = 0; seat < 4; seat++) {
      assert.ok(Math.abs(result.channels[seat][n]) <= 0.900001);
      assert.equal(result.channels[seat + 4][n], result.channels[seat][n] / 4);
    }
    assert.ok(stream.retainedSamples < 3500);
  }
  assert.ok(stream.safetyGain < 0.0001);
});

test('live queue validates complete finite contiguous chunks without changing accepted state on rejection', t => {
  const { player } = setup(t);
  player.enqueue(chunk(0));
  const bad = chunk(400); bad.signals.u[0][3] = NaN;
  assert.throws(() => player.enqueue(bad), /数值/);
  assert.throws(() => player.enqueue(chunk(401)), /连续/);
  assert.throws(() => player.enqueue(chunk(400, 400, 0.01, 'other')), /runId/);
  assert.throws(() => player.enqueue({ ...chunk(400), signals: { ...chunk(400).signals, x: [] } }), /维度/);
  assert.equal(player.bufferedUntil, 0.2);
  player.enqueue(chunk(400, 3600));
  assert.throws(() => player.enqueue(chunk(4000, 1)), /2 秒/);
  assert.equal(player.bufferedUntil, 2);
  player.reset(); player.enqueue(chunk(0, 400, 0.01, 'new'));
  assert.equal(player.bufferedUntil, 0.2);
});

test('one audio clock freezes on starvation and resumes at the missing sample instead of skipping wall time', async t => {
  const { player, context } = setup(t);
  await player.start();
  assert.equal(player.status, 'buffering'); assert.equal(player.underruns, 0);
  context.advance(4); player.enqueue(chunk(0));
  assert.equal(player.currentTime, 0);
  context.advance(0.11); assert.ok(Math.abs(player.currentTime - 0.1) < 1e-10);
  context.advance(1); assert.equal(player.currentTime, player.playableUntil);
  assert.equal(player.status, 'buffering'); assert.equal(player.playing, true); assert.equal(player.underruns, 1);
  const frozen = player.currentTime; context.advance(10); assert.equal(player.currentTime, frozen); assert.equal(player.underruns, 1);
  player.enqueue(chunk(400));
  assert.equal(player.currentTime, frozen);
  context.advance(0.11); assert.ok(Math.abs(player.currentTime - frozen - 0.1) < 1e-10);
  assert.equal(player.underruns, 1);
});

test('queued chunks are gapless and all comparisons share one eight-channel buffer without a new clock on switching', async t => {
  const { player, context } = setup(t);
  player.enqueue(chunk(0)); player.enqueue(chunk(400)); await player.start();
  assert.equal(context.sources.length, 2);
  assert.ok(Math.abs(context.sources[0].endTime - context.sources[1].startTime) < 1e-10);
  assert.equal(context.buffers[0].channels, 8);
  context.advance(0.1); const time = player.currentTime;
  player.setComparison('rr', 'd'); player.setComparison('fr', 'e');
  assert.equal(context.sources.length, 2); assert.equal(player.currentTime, time);
  const gains = context.gains.slice(1, 9);
  const starts = gains.map(gain => gain.gain.events.at(-2)!.value);
  assert.ok(Math.abs(starts.reduce((sum, gain) => sum + gain, 0) - 1) < 1e-10);
  assert.deepEqual(gains.map(gain => gain.gain.value), [0, 0, 0, 0, 0, 1, 0, 0]);
  player.setMuted(true); player.setVolume(0.7); assert.equal(context.gains[0].gain.value, 0);
  player.setMuted(false); assert.equal(context.gains[0].gain.value, 0.7);
});

test('pause preserves partly consumed audio and a cold allocation never advances the simulation clock', async t => {
  const { player, context } = setup(t);
  player.enqueue(chunk(0)); context.preparationSeconds = 0.2; await player.start();
  assert.equal(player.currentTime, 0); assert.equal(context.sources[0].offset, 0);
  context.advance(0.09); player.pause(); const paused = player.currentTime;
  assert.ok(Math.abs(paused - 0.08) < 1e-10);
  context.advance(3); assert.equal(player.currentTime, paused); assert.equal(player.playing, false);
  await player.start(); assert.equal(context.sources.at(-1)!.offset, paused);
  context.advance(0.04); assert.ok(Math.abs(player.currentTime - paused - 0.03) < 1e-10);
});

test('async resume cannot revive pause/reset/dispose or clear a newer request, and failure is retryable', async t => {
  const { player, context } = setup(t);
  player.enqueue(chunk(0)); const old = deferred(), current = deferred();
  context.resumeGate = old; const first = player.start(); assert.equal(player.start(), first);
  player.reset(); player.enqueue(chunk(0, 400, 0.01, 'replacement'));
  context.resumeGate = current; const second = player.start();
  old.resolve(); await first; assert.equal(player.starting, true); assert.equal(context.sources.length, 0);
  current.reject(new Error('permission denied')); await assert.rejects(second, /permission denied/);
  assert.equal(player.playing, false); assert.equal(player.starting, false);
  context.resumeGate = null; await player.start(); assert.equal(player.playing, true);
  player.pause(); const disposal = deferred(); context.resumeGate = disposal; const pending = player.start();
  player.dispose(); disposal.resolve(); await pending;
  assert.equal(player.status, 'disposed'); assert.equal(player.playing, false); assert.equal(context.closed, true);
  await assert.rejects(player.start(), /已释放/);
});

test('continuous enqueue reclaims ended audio and keeps the schedule bounded through 100 simulated seconds', async t => {
  const { player, context } = setup(t);
  player.enqueue(chunk(0, 1000)); await player.start(); context.advance(0.01);
  for (let n = 0; n < 1000; n++) {
    context.advance(0.1); player.enqueue(chunk(1000 + n * 200, 200));
    assert.ok(player.queuedSeconds < 0.501);
    assert.ok(context.sources.filter(source => !source.disconnected).length <= 7);
    assert.equal(player.underruns, 0);
  }
  assert.ok(Math.abs(player.currentTime - 100) < 1e-8);
  player.dispose(); assert.ok(context.sources.every(source => source.disconnected));
});
