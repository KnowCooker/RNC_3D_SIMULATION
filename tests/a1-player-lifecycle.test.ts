import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Player, resampleForAudio } from '../src/team-a/player';
import { decodeFixture } from '../src/shared/fixture';
import { ORDER } from '../src/shared/contracts';

const fixture = decodeFixture(JSON.parse(readFileSync(new URL('../fixtures/reference/golden_browser_fixture.json', import.meta.url), 'utf8')));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// A controllable Web Audio boundary: no wall-clock sleeps or real audio device in unit tests.
class FakeParam {
  value = 1;
  events: { kind: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) { this.value = value; this.events.push({ kind: 'set', value, time }); }
  setTargetAtTime(value: number, time: number) { this.value = value; this.events.push({ kind: 'target', value, time }); }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ kind: 'ramp', value, time }); }
  cancelAndHoldAtTime(time: number) { this.events.push({ kind: 'hold', value: this.value, time }); }
}
class FakeGain {
  gain = new FakeParam();
  target: unknown;
  connect(target: unknown) { this.target = target; }
  disconnect() {}
}
class FakeBuffer {
  samples: Float32Array;
  constructor(public length: number, public sampleRate: number) { this.samples = new Float32Array(length); }
  copyToChannel(data: Float32Array) { this.samples.set(data); }
  get duration() { return this.length / this.sampleRate; }
}
class FakeSource {
  buffer: FakeBuffer | null = null;
  onended: (() => void) | null = null;
  gain!: FakeGain;
  startOffset = -1;
  startTime = -1;
  stopTime: number | null = null;
  constructor(private context: FakeContext) {}
  connect(gain: FakeGain) { this.gain = gain; }
  disconnect() {}
  start(when: number, offset: number) { this.startTime = when || this.context.currentTime; this.startOffset = offset; }
  stop(when: number) { this.stopTime = when; }
  finish() { this.onended?.(); }
}
class FakeContext {
  currentTime = 0;
  destination = {};
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  preparationSeconds = 0;
  resumeCalls = 0;
  resumeGate: ReturnType<typeof deferred> | null = null;
  resume() { this.resumeCalls++; return this.resumeGate?.promise ?? Promise.resolve(); }
  createGain() { const node = new FakeGain(); this.gains.push(node); return node; }
  createBufferSource() { const source = new FakeSource(this); this.sources.push(source); return source; }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    this.currentTime += this.preparationSeconds;
    return new FakeBuffer(length, sampleRate);
  }
}
function setup(t: TestContext) {
  const context = new FakeContext();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: function () { return context; } });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  });
  const player = new Player(); player.load(fixture);
  return { player, context };
}

test('A1: preparing first audio buffer does not skip the requested playback position', async t => {
  const { player, context } = setup(t);
  context.preparationSeconds = 0.25;
  player.seek(4);
  await player.play();
  assert.equal(context.sources[0].startOffset, 4);
  assert.equal(player.currentTime, 4);
  context.currentTime += 1;
  player.pause();
  context.currentTime += 2;
  assert.equal(player.currentTime, 5);
  await player.play();
  assert.equal(context.sources.at(-1)!.startOffset, 5);
});

test('A1: pause cancels pending audio resume; repeated play creates one start', async t => {
  const { player, context } = setup(t);
  context.resumeGate = deferred();
  const first = player.play(), second = player.play();
  assert.equal(context.resumeCalls, 1);
  player.pause();
  context.resumeGate.resolve();
  await Promise.all([first, second]);
  assert.equal(player.playing, false);
  assert.equal(context.sources.length, 0);
  context.resumeGate = null;
  await player.play();
  assert.equal(context.sources.length, 1);
});

test('A1: loading a new experiment cancels an earlier pending play', async t => {
  const { player, context } = setup(t);
  context.resumeGate = deferred();
  const pending = player.play();
  player.load({ ...fixture, runId: 'replacement' });
  context.resumeGate.resolve();
  await pending;
  assert.equal(player.currentTime, 0);
  assert.equal(player.playing, false);
  assert.equal(context.sources.length, 0);
});

test('A1: reaching the end stays stopped when seeking, including before ended is delivered', async t => {
  const { player, context } = setup(t);
  await player.play();
  context.currentTime += 16;
  assert.equal(player.playing, false);
  player.seek(3);
  assert.equal(player.currentTime, 3);
  assert.equal(player.playing, false);
  assert.equal(context.sources.length, 1);
  context.sources[0].finish();
  await player.play();
  assert.equal(context.sources.at(-1)!.startOffset, 3);
  context.currentTime += 13;
  context.sources.at(-1)!.finish();
  assert.equal(player.currentTime, 16);
  await player.play();
  assert.equal(context.sources.at(-1)!.startOffset, 0);
  assert.equal(player.currentTime, 0);
});

test('A1: seeking to the end stops; replay starts only on explicit play', async t => {
  const { player, context } = setup(t);
  await player.play();
  player.seek(16);
  player.seek(0);
  assert.equal(player.playing, false);
  assert.equal(context.sources.length, 1);
  await player.play();
  assert.equal(player.playing, true);
  assert.equal(context.sources.at(-1)!.startOffset, 0);
});

test('A1: cold seat/mode switches prepare audio before fading, keep time and use the same gain', async t => {
  const { player, context } = setup(t);
  await player.play();
  context.currentTime += 3;
  context.preparationSeconds = 0.2;
  player.setVolume(0.4);
  for (const channel of ORDER) for (const mode of ['d', 'e'] as const) {
    const previous = context.sources.at(-1)!;
    player.setComparison(channel, mode);
    const source = context.sources.at(-1)!;
    assert.equal(source.startOffset, player.currentTime);
    assert.ok(previous.stopTime! > source.startTime, 'old audio must remain until the new buffer is ready');
    assert.equal(source.gain.target, context.gains[0]);
    assert.equal(source.gain.gain.value, 1);
    assert.equal(context.gains[0].gain.value, 0.4);
    assert.deepEqual(source.buffer!.samples, resampleForAudio(fixture.signals[mode][ORDER.indexOf(channel)]));
    previous.finish();
    assert.equal(player.playing, true, 'retired source must not end the new playback');
  }
  player.setMuted(true);
  player.setVolume(0.7);
  assert.equal(context.gains[0].gain.value, 0);
  player.setMuted(false);
  assert.equal(context.gains[0].gain.value, 0.7);
});

test('A1: audio resume failure leaves a retryable paused player', async t => {
  const { player, context } = setup(t);
  context.resumeGate = deferred();
  const pending = player.play();
  context.resumeGate.reject(new Error('device unavailable'));
  await assert.rejects(pending, /device unavailable/);
  assert.equal(player.playing, false);
  context.resumeGate = null;
  await player.play();
  assert.equal(player.playing, true);
});

test('A1: an obsolete resume cannot clear or start a newer play request', async t => {
  const { player, context } = setup(t);
  const oldGate = deferred(), newGate = deferred();
  context.resumeGate = oldGate;
  const oldPlay = player.play();
  player.pause();
  context.resumeGate = newGate;
  const newPlay = player.play();
  oldGate.resolve();
  await oldPlay;
  assert.equal(player.starting, true);
  assert.equal(context.sources.length, 0);
  newGate.resolve();
  await newPlay;
  assert.equal(player.starting, false);
  assert.equal(context.sources.length, 1);
});

test('A1: seeking while playing continues at the new position without a retired ended event stopping it', async t => {
  const { player, context } = setup(t);
  await player.play();
  const old = context.sources[0];
  context.currentTime += 5;
  player.seek(2);
  old.finish();
  assert.equal(player.playing, true);
  assert.equal(player.currentTime, 2);
  assert.equal(context.sources.at(-1)!.startOffset, 2);
  context.currentTime += 1;
  assert.equal(player.currentTime, 3);
});

test('A1: a cold comparison prepared across the end never restarts the clip', async t => {
  const { player, context } = setup(t);
  await player.play();
  context.currentTime += 15.9;
  context.preparationSeconds = 0.2;
  player.setComparison('rr', 'd');
  assert.equal(player.currentTime, 16);
  assert.equal(player.playing, false);
  assert.equal(context.sources.length, 1);
});
