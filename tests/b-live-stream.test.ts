import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLab, createLabStream, analyzeLab, sampleField, LAB_STREAM_CABIN_PREROLL_SAMPLES } from '../src/team-b/lab';
import { defaultLabConfig, LAB_LIVE_LIMIT_SECONDS, LAB_LIVE_HISTORY_SAMPLES, MIC_POSITIONS, type LabChunk, type LabConfig, type LabResult, type Vec3 } from '../src/shared/lab-contracts';

const defaultConfig = defaultLabConfig();
function compareChunk(actual: LabChunk, expected: { sources: LabResult['sources']; signals: LabResult['signals'] }, start: number) {
  for (let source = 0; source < 4; source++) assert.deepEqual(actual.sources[source], expected.sources[source].slice(start, start + actual.sampleCount));
  for (const signal of ['x', 'u', 'd', 'a', 'e'] as const) for (let channel = 0; channel < actual.signals[signal].length; channel++) {
    assert.deepEqual(actual.signals[signal][channel], expected.signals[signal][channel].slice(start, start + actual.sampleCount), `${signal}/${channel} at ${start}`);
  }
}

test('stateful first 16 seconds match the unchanged batch q/x/u/d/a/e bit for bit', () => {
  const expected = calculateLab(defaultConfig, 'batch');
  const stream = createLabStream(defaultConfig, 'stream');
  const actual = stream.process(32000);
  assert.equal(actual.startSample, 0); assert.equal(actual.sampleCount, 32000);
  compareChunk(actual, expected, 0);
  assert.deepEqual(stream.snapshot().result.metrics, expected.metrics);
  assert.equal(stream.sampleCount, 32000);
  assert.equal(Object.getOwnPropertyDescriptor(stream, 'sampleCount')?.set, undefined);
});

test('arbitrary block sizes preserve source/filter/weight state beyond 16 seconds and repeated history wraps', () => {
  const wholeStream = createLabStream(defaultConfig, 'whole', 4096), whole = wholeStream.process(96000);
  const stream = createLabStream(defaultConfig, 'parts', 4096), storage = stream.storageBytes;
  let state = 613, start = 0;
  while (start < 96000) {
    state = (state * 16807) % 2147483647;
    const size = Math.min(1 + state % 4093, 96000 - start);
    const actual = stream.process(size);
    assert.equal(actual.startSample, start);
    compareChunk(actual, whole, start);
    start += size;
    assert.equal(stream.sampleCount, start);
    assert.equal(stream.storageBytes, storage);
  }
  const snapshot = stream.snapshot();
  assert.equal(snapshot.startSample, 96000 - 4096);
  assert.equal(snapshot.endSample, 96000);
  assert.equal(snapshot.result.sampleCount, 4096);
  compareChunk({ ...snapshot.result, startSample: snapshot.startSample }, whole, snapshot.startSample);
  assert.notDeepEqual(whole.sources[0].slice(0, 32000), whole.sources[0].slice(32000, 64000), 'a live source cannot replay its 16s buffer');
  assert.ok(whole.signals.u[0].slice(32000, 34000).some(value => Math.abs(value) > 0.001), 'learning must not restart with 2 seconds of silence at the old clip boundary');
  const oldSnapshot = structuredClone(snapshot);
  snapshot.result.sources[0].fill(100);
  stream.process(2000);
  assert.notDeepEqual(stream.snapshot().result.sources[0], snapshot.result.sources[0], 'snapshot owns its copied data');
  assert.equal(oldSnapshot.endSample, 96000);
  assert.equal(stream.storageBytes, storage);
  assert.equal(stream.historyCapacity, 4096);
});

test('RNC off, zero step, disabled speakers and eight references retain the batch semantics across blocks', () => {
  const cases: Partial<LabConfig>[] = [
    { rncEnabled: false }, { stepSize: 0 }, { speakerEnabled: [false, false, false, false] },
    { taps: 128, speakerEnabled: [true, false, true, false], references: [...defaultConfig.references,
      ...defaultConfig.references.map((ref, i) => ({ ...ref, id: `new-${i}`, position: [ref.position[0] * 0.5, 0.85, ref.position[2] * 0.5] as Vec3 }))] },
  ];
  for (const patch of cases) {
    const config = { ...defaultConfig, ...patch }, batch = calculateLab(config, 'batch-topology');
    const stream = createLabStream(config, 'stream-topology');
    let start = 0;
    for (const size of [1, 97, 255, 3647, 16000, 12000]) {
      const actual = stream.process(size); compareChunk(actual, batch, start); start += size;
    }
    assert.equal(start, 32000);
    assert.deepEqual(stream.snapshot().result.metrics, batch.metrics);
  }
});

test('wrapped snapshots use one absolute clock and yield the same field window at mic and off-mic points', () => {
  const stream = createLabStream(defaultConfig, 'field-stream', 8000), whole = stream.process(64000);
  const snapshot = stream.snapshot(4096), localTime = (snapshot.endSample - snapshot.startSample) / 2000;
  assert.ok(localTime * 2000 >= 1000 + LAB_STREAM_CABIN_PREROLL_SAMPLES);
  const points: Vec3[] = [...MIC_POSITIONS, [0.21, 1.3, -0.27], [-0.38, 1.75, 0.63]];
  const frame = sampleField(snapshot.result, localTime, points);
  const fullResult: LabResult = { ...snapshot.result, sources: whole.sources, signals: whole.signals, sampleCount: whole.sampleCount };
  const fullFrame = sampleField(fullResult, snapshot.endSample / 2000, points);
  assert.deepEqual(frame.primarySpl, fullFrame.primarySpl);
  assert.deepEqual(frame.residualSpl, fullFrame.residualSpl);
  assert.deepEqual(frame.reductionDb, fullFrame.reductionDb);
  const analysis = analyzeLab(snapshot.result, localTime, { signal: 'q', channel: 3 });
  for (let m = 0; m < 4; m++) {
    assert.ok(Math.abs(frame.residualSpl[m] - analysis.residualSpl[m]!) < 1e-4);
    assert.ok(Math.abs(frame.primarySpl[m] - analysis.primarySpl[m]!) < 1e-4);
  }
  assert.deepEqual(analysis.waveform, whole.sources[3].slice(64000 - 4096, 64000));
});

test('resident storage stays bounded through two minutes and invalid requests do not advance the stream', () => {
  const stream = createLabStream({ ...defaultConfig, rncEnabled: false }, 'bounded', 2048);
  const bytes = stream.storageBytes;
  for (let i = 0; i < 120; i++) {
    stream.process(2000);
    assert.equal(stream.storageBytes, bytes);
    assert.ok(stream.snapshot(1000000000).result.sampleCount <= 2048);
  }
  assert.equal(stream.sampleCount, 240000);
  const count = stream.sampleCount;
  for (const invalid of [0, -1, 2.5, NaN, Infinity, 1000001]) assert.throws(() => stream.process(invalid));
  assert.equal(stream.sampleCount, count);
  stream.process(1);
  assert.equal(stream.sampleCount, count + 1, 'invalid requests do not poison a healthy stream');
  assert.throws(() => stream.snapshot(0));
  assert.throws(() => createLabStream(defaultConfig, 'bad-history', 512));
});

test('live RNC OFF freezes learned weights and zeros drive; ON resumes from those weights without restarting sources', () => {
  const stream = createLabStream(defaultConfig, 'rnc-toggle', LAB_LIVE_HISTORY_SAMPLES), bytes = stream.storageBytes;
  stream.process(8000);
  const frozen = stream.controllerWeights();
  assert.ok(frozen.some(output => output.some(w => w.some(value => Math.abs(value) > 1e-6))));
  const copy = stream.controllerWeights(); copy[0][0].fill(999);
  assert.deepEqual(stream.controllerWeights(), frozen, 'diagnostics cannot alter running weights');
  assert.deepEqual(stream.setRncEnabled(false), { enabled: false, effectiveSample: 8000 });
  const off = stream.process(6000);
  assert.deepEqual(stream.controllerWeights(), frozen);
  assert.ok(off.signals.u.every(signal => signal.every(value => value === 0)));
  assert.ok(off.signals.a.some(signal => signal.slice(0, 512).some(value => value !== 0)), 'existing secondary-path sound must decay causally');
  for (let m = 0; m < 4; m++) {
    assert.ok(off.signals.a[m].slice(512).every(value => value === 0));
    assert.deepEqual(off.signals.e[m].slice(512), off.signals.d[m].slice(512));
  }
  assert.throws(() => stream.setRncEnabled('false' as unknown as boolean), /布尔值/);
  assert.equal(stream.sampleCount, 14000); assert.equal(stream.snapshot().result.config.rncEnabled, false);
  assert.deepEqual(stream.setRncEnabled(true), { enabled: true, effectiveSample: 14000 });
  const resumed = stream.process(1);
  for (let output = 0; output < 4; output++) {
    let drive = 0;
    for (let k = 0; k < defaultConfig.references.length; k++) for (let j = 0; j < defaultConfig.taps; j++) {
      drive += frozen[output][k][j] * (j === 0 ? resumed.signals.x[k][0] : off.signals.x[k][off.sampleCount - j]);
    }
    assert.equal(resumed.signals.u[output][0], Math.fround(drive), 'first resumed drive must use frozen W and current x');
  }
  assert.notDeepEqual(stream.controllerWeights(), frozen, 'learning resumes on the first enabled sample');
  const reference = createLabStream(defaultConfig, 'uninterrupted-source').process(14001);
  for (const key of ['sources'] as const) for (let i = 0; i < 4; i++) {
    assert.deepEqual(off[key][i], reference[key][i].slice(8000, 14000));
    assert.equal(resumed[key][i][0], reference[key][i][14000]);
  }
  for (let i = 0; i < 4; i++) assert.deepEqual(off.signals.d[i], reference.signals.d[i].slice(8000, 14000));
  assert.equal(stream.storageBytes, bytes);
});

test('an initially disabled live controller can start adapting later', () => {
  const stream = createLabStream({ ...defaultConfig, rncEnabled: false }, 'initial-off');
  const off = stream.process(6000);
  assert.ok(off.signals.u.every(signal => signal.every(value => value === 0)));
  assert.ok(stream.controllerWeights().every(output => output.every(w => w.every(value => value === 0))));
  stream.setRncEnabled(true);
  const on = stream.process(4000);
  assert.ok(on.signals.u.some(signal => signal.some(value => Math.abs(value) > 0.001)));
  assert.ok(on.signals.e.every(signal => signal.every(Number.isFinite)));
});

test('wrapped live history retains five seconds at the audible clock despite producer prefetch', () => {
  const stream = createLabStream(defaultConfig, 'five-second-window', LAB_LIVE_HISTORY_SAMPLES);
  const whole = stream.process(80000), snapshot = stream.snapshot(LAB_LIVE_HISTORY_SAMPLES);
  const audibleEnd = 77200, localTime = (audibleEnd - snapshot.startSample) / defaultConfig.sampleRateHz;
  const analysis = analyzeLab(snapshot.result, localTime, { signal: 'e', channel: 2 });
  assert.equal(analysis.waveform.length, 10000);
  assert.deepEqual(analysis.waveform, whole.signals.e[2].slice(audibleEnd - 10000, audibleEnd));
  assert.equal(analysis.spectrum?.length, 513, 'FFT remains a short current window');
});

test('numeric overflow returns the finite prefix, preserves history, and cannot resume', () => {
  const stream = createLabStream({ ...defaultConfig, stepSize: 100 }, 'divergent');
  const chunk=stream.process(16000);
  assert.ok(chunk.divergence); assert.equal(chunk.sampleCount,stream.sampleCount);
  const count=stream.sampleCount, snapshot=stream.snapshot();
  assert.equal(snapshot.endSample,count); assert.deepEqual(snapshot.result.divergence,chunk.divergence);
  for(const channels of Object.values(snapshot.result.signals)) for(const channel of channels) assert.ok(channel.every(Number.isFinite));
  assert.throws(()=>stream.process(1000),/已经发散/);
  assert.throws(()=>stream.setRncEnabled(false),/已经发散/);
  assert.deepEqual(stream.snapshot(),snapshot); assert.equal(stream.sampleCount,count);
});

test('live generation ignores replay duration, preserves bounded adaptation for ten minutes and refuses overflow atomically', () => {
  const config = { ...defaultConfig, durationSeconds: 90,
    references: [...defaultConfig.references, ...defaultConfig.references.map(ref => ({ ...ref, id: `${ref.id}-extra` }))] };
  assert.throws(() => calculateLab(config, 'over-replay-budget'), /预计算时长/);
  const longReplaySetting = createLabStream(config, 'live-over-replay-budget', 8192);
  const shortReplaySetting = createLabStream({ ...config, durationSeconds: 10 }, 'live-short-setting', 8192);
  assert.deepEqual(longReplaySetting.process(4000).signals, shortReplaySetting.process(4000).signals);
  const stream = createLabStream(defaultConfig, 'ten-minutes', 8192), bytes = stream.storageBytes;
  const limit = LAB_LIVE_LIMIT_SECONDS * defaultConfig.sampleRateHz;
  let first: Float32Array | undefined;
  while (stream.sampleCount < limit - 1) {
    const chunk = stream.process(Math.min(2000, limit - 1 - stream.sampleCount));
    first ??= chunk.sources[0].slice();
    assert.equal(stream.storageBytes, bytes);
    assert.ok(chunk.signals.e.every(signal => signal.every(Number.isFinite)));
  }
  assert.throws(() => stream.process(2), /运行上限/);
  assert.equal(stream.sampleCount, limit - 1, 'rejected block must not partially update state');
  assert.equal(stream.process(1).sampleCount, 1);
  assert.throws(() => stream.process(1), /运行上限/);
  assert.throws(() => stream.setRncEnabled(false), /已结束/);
  const end = stream.snapshot(8192);
  assert.equal(end.endSample, limit); assert.equal(end.result.sampleCount, 8192);
  assert.notDeepEqual(end.result.sources[0].slice(-2000), first);
  assert.ok(end.result.signals.u.some(signal => signal.some(value => Math.abs(value) > 0.001)), 'controller continues beyond the replay interval');
  const analysis = analyzeLab(end.result, end.result.sampleCount / 2000, { signal: 'e', channel: 0 }, { spectrumWeighting: 'A', levelWeighting: 'A' });
  assert.ok(analysis.spectrum?.every(Number.isFinite)); assert.ok(analysis.valid);
  assert.equal(stream.storageBytes, bytes);
});
