import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defaultLabConfig, type LabConfig, type LabResult } from '../../src/shared/lab-contracts';
import { calculateLab, decodeRecordedNoise } from '../../src/team-b/lab';
import { encodeLabRecipe, decodeLabRecipe, recomputeLabRecipeAsync, LAB_RECORDING_ASSET } from '../../src/team-b/export';

export const labAssetBytes = () => new Uint8Array(readFileSync(new URL('../../src/team-b/lab/data/recorded-primary.f32', import.meta.url)));
export const labSha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const labSourceCommit = '181952687d6fb303e540e9f1b3981d228b52e744';
export const labInput = (config: LabConfig, originalRunId = 'original') => ({ mode: 'batch' as const, originSample: 0 as const,
  config, originalRunId, source: 'computed-browser' as const });
export function hashLabSignals(result: LabResult) {
  return [result.sources, result.signals.x, result.signals.u, result.signals.d, result.signals.a, result.signals.e].flatMap(channels => channels.map(channel => {
    const bytes = Buffer.alloc(channel.length * 4);
    channel.forEach((value, i) => bytes.writeFloatLE(value, i * 4));
    return labSha256(bytes);
  }));
}
export function assertLabEqual(actual: LabResult, expected: LabResult) {
  assert.equal(actual.sampleCount, expected.sampleCount); assert.deepEqual(actual.divergence, expected.divergence);
  assert.deepEqual(actual.metrics, expected.metrics); assert.deepEqual(hashLabSignals(actual), hashLabSignals(expected));
}
export function matrixConfig(vehicle: LabConfig['vehicle'], sourceMode: NonNullable<LabConfig['sourceMode']>, references: 1 | 4 | 8): LabConfig {
  const config = { ...defaultLabConfig(), vehicle, sourceMode, durationSeconds: 2, taps: 32, levelOffsetDb: 3 };
  config.references = Array.from({ length: references }, (_, i) => ({ ...config.references[i % 4],
    id: `stable-${i}`, name: `Sensor ${i}`, mountPart: i % 2 ? 'front-subframe' : 'rear-subframe',
    position: [config.references[i % 4].position[0] * (i >= 4 ? 0.9 : 1), 0.67, config.references[i % 4].position[2]] }));
  return config;
}
export async function auditLabRecipe(config: LabConfig, name: string) {
  const recordingBytes = labAssetBytes();
  assert.equal(labSha256(recordingBytes), LAB_RECORDING_ASSET.sha256);
  const recording = config.sourceMode === 'recorded-noise' ? decodeRecordedNoise(recordingBytes.buffer) : undefined;
  const expected = calculateLab(config, `original-${name}`, recording);
  const text = encodeLabRecipe(labInput(config, expected.runId), { sourceCommit: labSourceCommit });
  const recipe = decodeLabRecipe(text);
  assert.deepEqual(recipe.config, config);
  const bytesBefore = labSha256(recordingBytes), configBefore = JSON.stringify(config);
  let resolveCalls = 0;
  const repeated = await recomputeLabRecipeAsync(recipe, { runId: `recomputed-${name}`, sha256: async bytes => labSha256(bytes),
    resolveAsset: async descriptor => { assert.deepEqual(descriptor, LAB_RECORDING_ASSET); resolveCalls++; return recordingBytes; } });
  assertLabEqual(repeated.result, expected);
  assert.equal(repeated.source, 'computed-browser'); assert.equal(repeated.originalRunId, expected.runId);
  assert.notEqual(repeated.result.runId, expected.runId);
  assert.equal(repeated.status, expected.divergence ? 'diverged' : 'completed');
  assert.equal(resolveCalls, config.sourceMode === 'recorded-noise' ? 1 : 0);
  assert.equal(labSha256(recordingBytes), bytesBefore); assert.equal(JSON.stringify(config), configBefore);
  assert.deepEqual(repeated.result.config, recipe.normalizedConfig);
  return { name, sourceMode: config.sourceMode ?? 'shaped-noise', vehicle: config.vehicle, references: config.references.length,
    taps: config.taps, durationSeconds: config.durationSeconds, stepSize: config.stepSize, requestedSamples: recipe.requestedSampleCount,
    actualSamples: repeated.result.sampleCount, status: repeated.status, divergence: repeated.result.divergence ?? null,
    channels: 20 + config.references.length, samplesCompared: (20 + config.references.length) * repeated.result.sampleCount,
    signalHashes: hashLabSignals(repeated.result), recipeUtf8Bytes: Buffer.byteLength(text), recomputeExact: true,
    inputConfigUnchanged: true, inputAssetUnchanged: true };
}
