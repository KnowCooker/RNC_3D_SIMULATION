import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLab, analyzeLab, sampleField, validateLabConfig } from '../src/team-b/lab';
import { createSources, sourceParameters } from '../src/team-b/lab/sources';
import { applyPath, primaryPath, secondaryPath } from '../src/team-b/lab/paths';
import { defaultLabConfig, MIC_POSITIONS, SPEAKER_POSITIONS, type LabConfig, type Vec3, type VehicleKind } from '../src/shared/lab-contracts';

// Preserve the historical delayed-start checks while the UI default becomes immediate.
const config: LabConfig = { ...defaultLabConfig(), adaptationStartsSeconds: 2 };
const result = calculateLab(config, 'lab-baseline');
const power = (values: Float32Array | Float64Array, start = 24000, end = 32000) => {
  let sum = 0;
  for (let i = start; i < end; i++) sum += values[i] ** 2;
  return sum / (end - start);
};

test('new lab experiments learn before two seconds without changing sources or superposition', () => {
  const immediate = defaultLabConfig();
  assert.equal(immediate.adaptationStartsSeconds, 0);
  const run = calculateLab(immediate, 'immediate');
  for (let m = 0; m < 4; m++) {
    assert.deepEqual(run.signals.d[m], result.signals.d[m]);
    assert.equal(run.signals.u[m][0], 0, 'zero weights keep the first output causal');
    assert.ok(run.signals.u[m].slice(0, 1000).some(v => v !== 0), 'learning must not wait for two seconds');
    assert.notDeepEqual(run.signals.e[m].slice(0, 1000), run.signals.d[m].slice(0, 1000));
    assert.ok(run.metrics.reductionDbByMic[m] > 3);
    for (let n = 0; n < 4000; n++) assert.ok(Math.abs(run.signals.e[m][n] - run.signals.d[m][n] - run.signals.a[m][n]) < 4e-8);
  }
  for (const value of [-1, 1, NaN, Infinity]) assert.throws(() => validateLabConfig({ ...immediate, adaptationStartsSeconds: value } as LabConfig));
});

test('lab FxLMS produces finite true superposition, baseline then learned reduction at all microphones', () => {
  for (let m = 0; m < 4; m++) {
    for (let n = 0; n < result.sampleCount; n++) {
      assert.ok(Math.abs(result.signals.e[m][n] - result.signals.d[m][n] - result.signals.a[m][n]) < 4e-8);
      assert.ok(Number.isFinite(result.signals.e[m][n]));
    }
    assert.ok(result.signals.u[m].subarray(0, 4001).every(x => x === 0));
    assert.ok(result.signals.u[m].some(x => x !== 0));
    assert.ok(result.metrics.reductionDbByMic[m] > 3, 'the documented default synthetic example should actually converge');
  }
});

test('all 16 secondary paths have causal cross coupling and every source reaches every mic', () => {
  const impulse = new Float32Array(100); impulse[0] = 1;
  for (const point of MIC_POSITIONS) for (let source = 0; source < 4; source++) {
    for (const path of [primaryPath(config, source, point), secondaryPath(config, source, point)]) {
      const response = applyPath(impulse, path);
      assert.ok(path.delays.every(delay => delay >= 1));
      assert.ok(response.some(value => value > 0));
      assert.equal(response[0], 0);
    }
  }
});

test('first adaptive output matches an independent all-error normalized gradient calculation', () => {
  const n = 4000;
  let energy = 1e-6;
  const allFiltered = SPEAKER_POSITIONS.map((_, output) => MIC_POSITIONS.map(point => result.signals.x.map(x => applyPath(x, secondaryPath(config, output, point)))));
  for (const output of allFiltered) for (const mic of output) for (const reference of mic) for (let j = 0; j < config.taps; j++) energy += reference[n - j] ** 2;
  for (let output = 0; output < 4; output++) {
    const filtered = allFiltered[output];
    let expected = 0;
    for (let k = 0; k < config.references.length; k++) for (let j = 0; j < config.taps; j++) {
      let gradient = 0;
      for (let m = 0; m < 4; m++) gradient += result.signals.d[m][n] * filtered[m][k][n - j];
      expected -= config.stepSize / energy * gradient * result.signals.x[k][n + 1 - j];
    }
    assert.ok(Math.abs(result.signals.u[output][n + 1] - expected) < 1e-8);
  }
});

test('RNC off, zero step and all disabled speakers retain original noise exactly', () => {
  for (const patch of [{ rncEnabled: false }, { stepSize: 0 }, { speakerEnabled: [false, false, false, false] }]) {
    const off = calculateLab({ ...config, ...patch } as LabConfig, 'off');
    for (let m = 0; m < 4; m++) {
      assert.deepEqual(off.signals.d[m], result.signals.d[m]);
      assert.deepEqual(off.signals.e[m], off.signals.d[m]);
      assert.ok(off.signals.u[m].every(x => x === 0));
      assert.ok(off.signals.a[m].every(x => x === 0));
    }
    const field = sampleField(off, 16, [[0, 1.5, 0], ...MIC_POSITIONS]);
    assert.deepEqual(field.primarySpl, field.residualSpl);
    assert.ok(field.reductionDb.every(x => x === 0));
  }
});

test('one and eight references and disabled output actually change controller dimensions and results', () => {
  const one = calculateLab({ ...config, references: config.references.slice(0, 1), speakerEnabled: [false, true, true, true] }, 'one');
  const eight = calculateLab({ ...config, references: [...config.references, ...config.references.map((ref, i) => ({ ...ref,
    id: `extra-${i}`, position: [ref.position[0] * 0.6, 0.8, ref.position[2] * 0.65] as Vec3 }))] }, 'eight');
  assert.equal(one.signals.x.length, 1);
  assert.equal(eight.signals.x.length, 8);
  assert.ok(one.signals.u[0].every(x => x === 0));
  assert.notDeepEqual(one.signals.e[0], result.signals.e[0]);
  assert.notDeepEqual(eight.signals.x[4], eight.signals.x[0]);
  for (const run of [one, eight]) for (const channels of Object.values(run.signals)) for (const channel of channels) assert.ok(channel.every(Number.isFinite));
});

test('recording-shaped sources handle high energy at default step and reject unstable high-step runs explicitly', () => {
  const highConfig = { ...config, taps: 128, speedKph: 130, roadRoughness: 3, treadRoughness: 3, pressureKpa: 320, temperatureC: 50 };
  const colocatedConfig = { ...config,
    references: Array.from({ length: 8 }, (_, i) => ({ id: `same-${i}`, name: `同位 ${i}`, position: [0, 0.8, 0] as Vec3 })) };
  const high = calculateLab(highConfig, 'high');
  const colocated = calculateLab(colocatedConfig, 'colocated');
  for (const run of [high, colocated]) for (const channels of Object.values(run.signals)) for (const channel of channels) assert.ok(channel.every(Number.isFinite));
  // The former broad source was stable here; recorded low-frequency coloration
  // narrows that operating envelope. Do not clamp u or change the FxLMS formula.
  for (const cfg of [highConfig, colocatedConfig]) assert.throws(() => calculateLab({ ...cfg, stepSize: 0.5 }, 'unstable'), /数值不稳定/);
  for (const run of [high, colocated]) for (let m = 0; m < 4; m++) {
    const measured = 10 * Math.log10(power(run.signals.d[m]) / power(run.signals.e[m]));
    assert.ok(Math.abs(run.metrics.reductionDbByMic[m] - measured) < 1e-10, 'report actual signed gain without forcing improvement');
  }
});

test('field at microphone positions equals independently measured trace power in the same window', () => {
  for (const time of [0.5, 2, 3.15, 8, 16]) {
    const frame = sampleField(result, time, [...MIC_POSITIONS]);
    const end = Math.floor(time * 2000);
    assert.equal(frame.valid, true);
    for (let m = 0; m < 4; m++) {
      const dp = power(result.signals.d[m], end - 1000, end), ep = power(result.signals.e[m], end - 1000, end);
      assert.ok(Math.abs(frame.primarySpl[m] - 10 * Math.log10(dp / (20e-6) ** 2)) < 1e-4);
      assert.ok(Math.abs(frame.residualSpl[m] - 10 * Math.log10(ep / (20e-6) ** 2)) < 1e-4);
      assert.ok(Math.abs(frame.reductionDb[m] - 10 * Math.log10(dp / ep)) < 1e-4);
    }
  }
});

test('off-microphone field is recalculated from wheel q and speaker u, not microphone interpolation', () => {
  const points: Vec3[] = [[0.21, 1.12, -0.31], [-0.38, 1.8, 0.77], SPEAKER_POSITIONS[0]];
  const frame = sampleField(result, 12, points);
  const end = 24000;
  for (let p = 0; p < points.length; p++) {
    const d = new Float64Array(result.sampleCount), a = new Float64Array(result.sampleCount);
    for (let i = 0; i < 4; i++) {
      applyPath(result.sources[i], primaryPath(config, i, points[p]), d);
      applyPath(result.signals.u[i], secondaryPath(config, i, points[p]), a);
    }
    const e = d.map((value, n) => value + a[n]);
    assert.ok(Math.abs(frame.residualSpl[p] - 10 * Math.log10(power(e, end - 1000, end) / (20e-6) ** 2)) < 1e-4);
  }
  const changedMics = { ...result, signals: { ...result.signals, e: result.signals.e.map(channel => channel.map(() => 100)) as unknown as typeof result.signals.e } };
  assert.deepEqual(sampleField(changedMics, 12, points), frame, 'changing stored microphone values must not affect spatial solution');
  assert.ok(frame.residualSpl[0] !== frame.residualSpl[1]);
});

test('vehicle paths vary, seed is reproducible and speed/roughness trends are source-driven', () => {
  const hashes = new Set<string>();
  for (const vehicle of ['ice', 'bev', 'hev', 'erev'] as VehicleKind[]) hashes.add(JSON.stringify(primaryPath({ ...config, vehicle }, 0, MIC_POSITIONS[0])));
  assert.equal(hashes.size, 4);
  assert.deepEqual(createSources(config), result.sources);
  const repeated = calculateLab(config, 'repeat');
  assert.deepEqual(repeated.signals.e, result.signals.e);
  assert.notDeepEqual(createSources({ ...config, seed: 29 })[0], result.sources[0]);
  for (const patch of [{ speedKph: 90 }, { roadRoughness: 2 }, { treadRoughness: 2 }]) assert.ok(power(createSources({ ...config, ...patch })[0]) > power(result.sources[0]));
  assert.notEqual(sourceParameters({ ...config, pressureKpa: 300 }).spectrumScale, sourceParameters(config).spectrumScale);
  assert.notEqual(sourceParameters({ ...config, temperatureC: 40 }).spectrumScale, sourceParameters(config).spectrumScale);
});

test('warm-up, zero-speed energy floor and bad configurations are explicit', () => {
  const warm = sampleField(result, 0.49, [...MIC_POSITIONS]);
  assert.equal(warm.valid, false);
  assert.ok(warm.primarySpl.every(Number.isNaN));
  assert.equal(analyzeLab(result, 0.49, { signal: 'e', channel: 0 }).valid, false);
  assert.equal(analyzeLab(result, 0.5, { signal: 'e', channel: 0 }).spectrum, null);
  assert.equal(analyzeLab(result, 0.52, { signal: 'e', channel: 0 }).spectrum?.length, 513);
  const parked = calculateLab({ ...config, speedKph: 0 }, 'parked');
  assert.equal(sampleField(parked, 16, [...MIC_POSITIONS]).valid, false);
  assert.ok(parked.signals.d.every(channel => channel.every(value => value === 0)));
  assert.equal(parked.metrics.aggregateReductionDb, 0);
  for (const patch of [{ taps: 0 }, { stepSize: NaN }, { references: [] }, { pressureKpa: -1 }, { speedKph: 131 }, { references: [config.references[0], config.references[0]] }]) {
    assert.throws(() => validateLabConfig({ ...config, ...patch }));
  }
});

test('q selection analyzes each actual wheel source independently of reference layout', () => {
  const changed = calculateLab({ ...config, references: [{ id: 'centre', name: 'Centre only', position: [0, 0.8, 0] }] }, 'changed-layout');
  for (let source = 0; source < 4; source++) {
    const analysis = analyzeLab(changed, 6, { signal: 'q', channel: source });
    assert.deepEqual(analysis.waveform, changed.sources[source].slice(11600, 12000));
    assert.deepEqual(analysis.spectrum, analyzeLab(result, 6, { signal: 'q', channel: source }).spectrum);
    assert.equal(analysis.unit, 'm/s²（等效轮端激励）');
    assert.ok(analysis.spectrum && analysis.spectrum.some(value => value > 0));
  }
  assert.notDeepEqual(analyzeLab(changed, 6, { signal: 'q', channel: 0 }).waveform,
    analyzeLab(changed, 6, { signal: 'x', channel: 0 }).waveform);
  assert.throws(() => analyzeLab(changed, 6, { signal: 'q', channel: 4 }), /通道不存在/);
  assert.throws(() => analyzeLab(changed, 6, { signal: 'x', channel: 1 }), /通道不存在/);
});
