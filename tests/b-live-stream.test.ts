import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLab, createLabStream, analyzeLab, sampleField, LAB_STREAM_CABIN_PREROLL_SAMPLES } from '../src/team-b/lab';
import { defaultLabConfig, MIC_POSITIONS, type LabChunk, type LabConfig, type LabResult, type Vec3 } from '../src/shared/lab-contracts';

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
  assert.deepEqual(analysis.waveform, whole.sources[3].slice(63600, 64000));
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

test('numerical divergence is explicit and a partially advanced failed sample cannot be resumed', () => {
  const stream = createLabStream({ ...defaultConfig, stepSize: 0.5, speakerEnabled: [true, false, false, false] }, 'divergent');
  assert.throws(() => stream.process(16000), /数值不稳定/);
  const count = stream.sampleCount;
  assert.throws(() => stream.process(1000), /数值不稳定/);
  assert.throws(() => stream.snapshot(), /数值不稳定/);
  assert.equal(stream.sampleCount, count);
});
