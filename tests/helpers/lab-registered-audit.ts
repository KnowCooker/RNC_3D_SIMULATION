import assert from 'node:assert/strict';
import { defaultXPengConfig, type LabConfig } from '../../src/shared/lab-contracts';
import { calculateLab, decodeRecordedNoise } from '../../src/team-b/lab';
import { LAB_RECIPE_MODEL, LAB_RECORDING_ASSET, encodeLabRecipe, decodeLabRecipe, recomputeLabRecipeAsync,
  encodeLabResult, decodeLabResult, encodeLabResultAsync, decodeLabResultAsync, estimateLabExport } from '../../src/team-b/export';
import { labAssetBytes, labSha256, labInput, assertLabEqual, hashLabSignals } from './lab-recipe-audit';
import { labResultInput } from './lab-result-audit';

// Caller-supplied numerical candidate base; not proof of a complete build commit.
export const registeredCandidate = '5be0802beec22be171e36c5b0d754b3799e09e21';
export function registeredConfig(assetId: string, sourceMode: NonNullable<LabConfig['sourceMode']>, count: 1 | 4 | 8): LabConfig {
  const base = defaultXPengConfig(assetId);
  const config = { ...base, sourceMode, durationSeconds: 1, taps: count === 8 ? 64 : count === 4 ? 32 : 16,
    seed: count === 8 ? 47 : count === 4 ? 29 : 11, levelOffsetDb: 3 };
  config.references = Array.from({ length: count }, (_, i) => ({ ...base.references[i % 4],
    id: `registered-ref-${i}`, name: `REF ${i + 1}`, position: [...base.references[i % 4].position] as [number, number, number] }));
  return config;
}
export async function auditRegisteredCase(config: LabConfig, name: string) {
  const context = { sourceCommit: registeredCandidate, sha256: labSha256 };
  const asset = labAssetBytes(), assetBefore = labSha256(asset), configBefore = JSON.stringify(config);
  assert.equal(assetBefore, LAB_RECORDING_ASSET.sha256);
  const recording = config.sourceMode === 'recorded-noise' ? decodeRecordedNoise(asset.buffer) : undefined;
  const result = calculateLab(config, `original-${name}`, recording), signalHashes = hashLabSignals(result);
  assert.equal(result.sampleCount, config.durationSeconds * 2000); assert.equal(result.divergence, undefined);
  const recipe = decodeLabRecipe(encodeLabRecipe(labInput(config, result.runId), context));
  assert.deepEqual(recipe.config, config); assert.deepEqual(recipe.modelIdentity, LAB_RECIPE_MODEL);
  assert.equal(recipe.normalizedConfig.layoutId, config.layoutId);
  let resolveCalls = 0;
  const recomputed = await recomputeLabRecipeAsync(recipe, { runId: `recomputed-${name}`,
    sha256: async bytes => labSha256(bytes), resolveAsset: async descriptor => {
      assert.deepEqual(descriptor, LAB_RECORDING_ASSET); resolveCalls++; return asset;
    } });
  assertLabEqual(recomputed.result, result);
  assert.equal(recomputed.originalRunId, result.runId); assert.equal(recomputed.source, 'computed-browser');
  assert.notEqual(recomputed.result.runId, result.runId); assert.equal(recomputed.status, 'completed');
  assert.equal(recomputed.result.config.layoutId, config.layoutId); assert.equal(recomputed.result.config.vehicle, config.vehicle);
  assert.equal(resolveCalls, recording ? 1 : 0);
  const input = labResultInput(result), bytes = encodeLabResult(input, context);
  const asyncBytes = await encodeLabResultAsync(input, { ...context, sha256: async value => labSha256(value) });
  assert.deepEqual(asyncBytes, bytes);
  assert.equal(estimateLabExport(input, context).containerBytes, bytes.length);
  for (const imported of [decodeLabResult(bytes, labSha256), await decodeLabResultAsync(bytes, async value => labSha256(value))]) {
    assertLabEqual(imported.result, result); assert.deepEqual(imported.result.config, config);
    assert.deepEqual(imported.manifest.recipe.modelIdentity, LAB_RECIPE_MODEL);
    assert.equal(imported.modelSupported, true); assert.equal(imported.layoutSupported, true);
    assert.equal(imported.verifiedMetrics!.rawMetricsMatch, true);
    assert.equal(imported.manifest.channels.filter(c => c.signal === 'x').length, config.references.length);
    assert.deepEqual(imported.manifest.channels.filter(c => c.signal === 'x').map(c => c.stableId), config.references.map(r => `x:${r.id}`));
    assert.equal(imported.result.runId, result.runId); assert.equal(imported.source, input.source);
    assert.notEqual(imported.result.sources[0].buffer, result.sources[0].buffer);
  }
  assert.deepEqual(hashLabSignals(result), signalHashes); assert.equal(JSON.stringify(config), configBefore);
  assert.equal(labSha256(asset), assetBefore);
  return { name, layoutId: config.layoutId, vehicle: config.vehicle, sourceMode: config.sourceMode,
    references: config.references.length, taps: config.taps, seed: config.seed, stepSize: config.stepSize,
    actualSamples: result.sampleCount, samplesPerComparison: (20 + config.references.length) * result.sampleCount,
    signalHashes, recipeRecomputeExact: true, syncAsyncBytesEqual: true, syncAndAsyncRoundtripExact: true,
    rawMetricsMatch: true, inputUnchanged: true, assetResolveCalls: resolveCalls, containerBytes: bytes.length };
}

// Hostile metadata fixtures change only the manifest and retain authentic payload/hash.
export function rewriteLabManifest(bytes: Uint8Array, mutate: (manifest: any) => void): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), m = view.getUint32(8, true);
  const start = 16 + Math.ceil(m / 4) * 4;
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + m)));
  mutate(manifest);
  const metadata = new TextEncoder().encode(JSON.stringify(manifest)), payload = bytes.subarray(start);
  const output = new Uint8Array(16 + Math.ceil(metadata.length / 4) * 4 + payload.length);
  output.set(bytes.subarray(0, 8)); const header = new DataView(output.buffer);
  header.setUint32(8, metadata.length, true); header.setUint32(12, payload.length, true);
  output.set(metadata, 16); output.set(payload, 16 + Math.ceil(metadata.length / 4) * 4);
  return output;
}
