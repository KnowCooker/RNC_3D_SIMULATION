/** B1-001 independent Python comparison; verification only, not runtime code. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { DEFAULT_CONFIG } from '../../src/shared/defaults';
import { calculateSync } from '../../src/team-b/engine/core';

const oracle = new URL('../../docs/evidence/B/B1-001/oracle/', import.meta.url);
export const numericCases = [
  { name: 'default', seed: 11, taps: 64, stepSize: 0.08 },
  { name: 'seed29', seed: 29, taps: 64, stepSize: 0.08 },
  { name: 'seed47', seed: 47, taps: 64, stepSize: 0.08 },
  { name: 'taps32', seed: 11, taps: 32, stepSize: 0.08 },
  { name: 'mu0', seed: 11, taps: 64, stepSize: 0 },
] as const;
const kinds = ['x', 'u', 'd', 'a', 'e'] as const;
const channels = ['fl', 'fr', 'rl', 'rr'] as const;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const signalHash = (signal: Float32Array) => {
  const bytes = Buffer.alloc(signal.length * 4);
  signal.forEach((v, i) => bytes.writeFloatLE(v, i * 4));
  return sha(bytes);
};

export function compareChannel(actual: Float32Array, expected: Float32Array, label: string) {
  assert.equal(actual.length, expected.length, `${label}: length`);
  assert.ok(actual.length > 0, `${label}: empty signal`);
  let errorPower = 0, referencePower = 0, maxAbsError = 0, worstSample = 0;
  for (let i = 0; i < actual.length; i++) {
    assert.ok(Number.isFinite(actual[i]) && Number.isFinite(expected[i]), `${label}: nonfinite sample ${i}`);
    const difference = actual[i] - expected[i];
    errorPower += difference * difference; referencePower += expected[i] * expected[i];
    if (Math.abs(difference) > maxAbsError) { maxAbsError = Math.abs(difference); worstSample = i; }
  }
  const referenceRms = Math.sqrt(referencePower / expected.length);
  const errorRms = Math.sqrt(errorPower / expected.length);
  // Explicit zero branch: no 0/0, and use max absolute error (not averaged error).
  const nearZero = referenceRms <= 1e-12;
  const relativeRms = nearZero ? null : errorRms / referenceRms;
  const passed = nearZero ? maxAbsError <= 1e-6 : relativeRms! <= 1e-3;
  assert.ok(passed, `${label}: relativeRms=${relativeRms}, maxAbsError=${maxAbsError}, sample=${worstSample}`);
  return { referenceRms, errorRms, relativeRms, maxAbsError, worstSample,
    criterion: nearZero ? 'max-absolute<=1e-6' : 'relative-rms<=1e-3', passed };
}

export function auditNumericCase(spec: typeof numericCases[number]) {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', oracle), 'utf8'));
  assert.equal(manifest.schema, 'b1-numeric-oracle-v1');
  assert.equal(manifest.referenceSha256, sha(readFileSync(new URL('../../fixtures/reference/reference_mimo.py', import.meta.url))));
  assert.deepEqual(manifest.signals, kinds); assert.deepEqual(manifest.channels, channels);
  assert.equal(manifest.sampleCount, 32000); assert.equal(manifest.cases.length, 5);
  const record = manifest.cases.find((entry: { name: string }) => entry.name === spec.name);
  assert.ok(record, `${spec.name}: missing independent oracle`);
  for (const key of ['seed', 'taps', 'stepSize'] as const) assert.equal(record[key], spec[key]);
  assert.equal(record.file, `${spec.name}.f32.gz`);
  assert.equal(record.pythonFloat64RepeatExact, true);
  const compressed = readFileSync(new URL(record.file, oracle));
  assert.equal(sha(compressed), record.gzipSha256, `${spec.name}: compressed oracle integrity`);
  const raw = gunzipSync(compressed);
  assert.equal(raw.length, 5 * 4 * 32000 * 4); assert.equal(raw.length, record.rawBytes);
  assert.equal(sha(raw), record.rawSha256, `${spec.name}: raw oracle integrity`);
  const config = { ...DEFAULT_CONFIG, seed: spec.seed, taps: spec.taps, stepSize: spec.stepSize };
  const result = calculateSync(config, `b1-001-${spec.name}`);
  const repeat = calculateSync(config, `b1-001-${spec.name}-repeat`);
  assert.deepEqual(result.config, config); assert.equal(result.sampleCount, 32000);
  assert.deepEqual(result.order, channels); assert.equal(result.source, 'computed-browser');
  assert.deepEqual(result.units, { x: 'm/s2', u: 'drive', d: 'Pa', a: 'Pa', e: 'Pa' });
  const errors = [];
  for (const [kindIndex, kind] of kinds.entries()) {
    assert.equal(result.signals[kind].length, 4);
    for (let channel = 0; channel < 4; channel++) {
      const offset = (kindIndex * 4 + channel) * 32000 * 4;
      const expected = Float32Array.from({ length: 32000 }, (_, i) => raw.readFloatLE(offset + i * 4));
      const actual = result.signals[kind][channel];
      const stats = compareChannel(actual, expected, `${spec.name}/${kind}/${channels[channel]}`);
      assert.deepEqual(repeat.signals[kind][channel], actual, `${spec.name}/${kind}/${channel}: repeat`);
      errors.push({ signal: kind, channel: channels[channel], samples: actual.length, ...stats,
        referenceSha256: signalHash(expected), actualSha256: signalHash(actual), repeatExact: true });
    }
  }
  assert.equal(result.metrics.startSeconds, 12); assert.equal(result.metrics.endSeconds, 16);
  assert.equal(result.metrics.measurement, 'unweighted-full-sampled-band');
  const micMetrics = result.metrics.reductionDbByMic.map((actualDb, channel) => {
    const referenceDb: number = record.report.reductionDbByMic[channel];
    const absErrorDb = Math.abs(actualDb - referenceDb);
    assert.ok(Number.isFinite(actualDb) && Number.isFinite(referenceDb) && absErrorDb <= 0.2);
    assert.ok(spec.stepSize === 0 ? actualDb === 0 : actualDb > 0);
    return { channel: channels[channel], actualDb, referenceDb, absErrorDb, passed: true };
  });
  const aggregate = { actualDb: result.metrics.aggregateReductionDb,
    referenceDb: record.report.aggregateReductionDb as number,
    absErrorDb: Math.abs(result.metrics.aggregateReductionDb - record.report.aggregateReductionDb) };
  assert.ok(Number.isFinite(aggregate.actualDb) && Number.isFinite(aggregate.referenceDb) && aggregate.absErrorDb <= 0.2);
  assert.ok(spec.stepSize === 0 ? aggregate.actualDb === 0 : aggregate.actualDb >= 3);
  assert.deepEqual(repeat.metrics, result.metrics);
  if (spec.stepSize === 0) for (let c = 0; c < 4; c++) {
    assert.ok(result.signals.u[c].every(v => v === 0));
    assert.ok(result.signals.a[c].every(v => v === 0));
    assert.deepEqual(result.signals.e[c], result.signals.d[c]);
  }
  return { name: spec.name, config, comparedSamples: 640000, repeatExact: true,
    pythonFloat64RepeatExact: true, errors, micMetrics, aggregate, passed: true };
}
