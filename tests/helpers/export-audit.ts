import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { DEFAULT_CONFIG } from '../../src/shared/defaults';
import { calculateSync } from '../../src/team-b/engine/core';
import { encodeResult, decodeResult, encodeRecipe, decodeRecipe, recomputeRecipe, estimateExport } from '../../src/team-b/export';
import { numericCases, compareChannel } from './engine-numeric-audit';
import type { RunResult } from '../../src/shared/contracts';

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const context = { sha256, sourceCommit: '67387f68c6a6c1d9ad0826794f61ebde74aa649c' };
export const batchInput = (result: RunResult) => ({ mode: 'batch' as const, originSample: 0 as const, result });
const kinds = ['x', 'u', 'd', 'a', 'e'] as const;
function signalBytes(signal: Float32Array): Buffer {
  const bytes = Buffer.alloc(signal.length * 4);
  signal.forEach((value, i) => bytes.writeFloatLE(value, i * 4));
  return bytes;
}
export function auditExportCase(spec: typeof numericCases[number]) {
  const config = { ...DEFAULT_CONFIG, seed: spec.seed, taps: spec.taps, stepSize: spec.stepSize };
  const original = calculateSync(config, `b2-export-${spec.name}`);
  const beforeHashes = kinds.flatMap(kind => original.signals[kind].map(channel => sha256(signalBytes(channel))));
  const input = batchInput(original), estimate = estimateExport(input, context);
  const bytes = encodeResult(input, context);
  assert.equal(bytes.length, estimate.containerBytes);
  const decoded = decodeResult(bytes, sha256);
  const recipeText = encodeRecipe({ mode: 'batch', originSample: 0, config, originalRunId: original.runId, source: original.source }, context);
  const recipe = decodeRecipe(recipeText), recomputed = recomputeRecipe(recipe, `b2-recompute-${spec.name}`);
  assert.equal(recomputed.originalRunId, original.runId);
  assert.notEqual(recomputed.result.runId, original.runId);
  assert.equal(recomputed.result.source, 'computed-browser');
  assert.equal(decoded.modelSupported, true); assert.ok(decoded.verifiedSteady);
  assert.deepEqual(decoded.result.config, original.config); assert.deepEqual(decoded.result.units, original.units);
  assert.deepEqual(decoded.result.metrics, original.metrics); assert.equal(decoded.result.source, original.source);
  assert.deepEqual(recomputed.result.metrics, original.metrics);
  assert.equal(decoded.result.runId, original.runId); assert.equal(decoded.result.computeMilliseconds, original.computeMilliseconds);
  const oracle = new URL('../../docs/evidence/B/B1-001/oracle/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', oracle), 'utf8'));
  const record = manifest.cases.find((entry: { name: string }) => entry.name === spec.name);
  const raw = gunzipSync(readFileSync(new URL(record.file, oracle)));
  assert.equal(raw.length, 2560000); assert.equal(sha256(raw), record.rawSha256);
  let maxRelativeRms = 0, maxAbsoluteError = 0;
  const channelHashes = [];
  for (const [kindIndex, kind] of kinds.entries()) for (let channel = 0; channel < 4; channel++) {
    const expected = signalBytes(original.signals[kind][channel]);
    assert.equal(sha256(expected), beforeHashes[kindIndex * 4 + channel], 'Export must not alter input samples');
    const restored = signalBytes(decoded.result.signals[kind][channel]);
    const repeated = signalBytes(recomputed.result.signals[kind][channel]);
    assert.deepEqual(restored, expected); assert.deepEqual(repeated, expected);
    assert.notEqual(decoded.result.signals[kind][channel].buffer, original.signals[kind][channel].buffer);
    assert.notEqual(decoded.result.signals[kind][channel].buffer, bytes.buffer);
    const offset = (kindIndex * 4 + channel) * 32000 * 4;
    const independent = Float32Array.from({ length: 32000 }, (_, i) => raw.readFloatLE(offset + i * 4));
    const error = compareChannel(recomputed.result.signals[kind][channel], independent, `${spec.name}/${kind}/${channel}`);
    maxRelativeRms = Math.max(maxRelativeRms, error.relativeRms ?? 0); maxAbsoluteError = Math.max(maxAbsoluteError, error.maxAbsError);
    channelHashes.push({ signal: kind, channel, sha256: sha256(expected), roundTripExact: true, recomputeExact: true });
  }
  const metricErrors = [...recomputed.result.metrics.reductionDbByMic, recomputed.result.metrics.aggregateReductionDb]
    .map((value, i) => Math.abs(value - [...record.report.reductionDbByMic, record.report.aggregateReductionDb][i]));
  metricErrors.forEach(value => assert.ok(value <= 0.2, `Independent metric difference ${value} dB`));
  // Mutating returned arrays cannot alter the container or original result.
  const originalHash = sha256(signalBytes(original.signals.x[0])), encodedHash = sha256(bytes);
  decoded.result.signals.x[0][0] = 99;
  assert.equal(sha256(signalBytes(original.signals.x[0])), originalHash); assert.equal(sha256(bytes), encodedHash);
  assert.equal(decodeResult(bytes, sha256).result.signals.x[0][0], original.signals.x[0][0]);
  return { name: spec.name, config, samplesCompared: 640000, ...estimate, recipeUtf8Bytes: Buffer.byteLength(recipeText),
    roundTripExact: true, recomputeExact: true, maxRelativeRms, maxAbsoluteError,
    maxMetricDifferenceDb: Math.max(...metricErrors), inputUnchanged: true, channelHashes };
}
