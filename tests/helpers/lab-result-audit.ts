import assert from 'node:assert/strict';
import { calculateLab, decodeRecordedNoise } from '../../src/team-b/lab';
import type { LabConfig, LabResult } from '../../src/shared/lab-contracts';
import { encodeLabResult, decodeLabResult, encodeLabResultAsync, decodeLabResultAsync, estimateLabExport } from '../../src/team-b/export';
import { assertLabEqual, labSha256, labAssetBytes, hashLabSignals } from './lab-recipe-audit';

export const labResultCommit = '33fbddca6b605b521f38a4bcfee7dc828f43fc04';
export const labResultContext = { sourceCommit: labResultCommit, sha256: labSha256 };
export const labResultInput = (result: LabResult, source: 'computed-browser' | 'reference-replay' = 'computed-browser') =>
  ({ mode: 'batch' as const, originSample: 0 as const, result, source });
export async function auditLabResult(config: LabConfig, name: string) {
  const recording = config.sourceMode === 'recorded-noise' ? decodeRecordedNoise(labAssetBytes().buffer) : undefined;
  const result = calculateLab(config, name, recording), before = hashLabSignals(result), configBefore = JSON.stringify(config);
  const input = labResultInput(result, name.includes('replay') ? 'reference-replay' : 'computed-browser');
  const estimate = estimateLabExport(input, labResultContext), bytes = encodeLabResult(input, labResultContext);
  const asyncBytes = await encodeLabResultAsync(input, { ...labResultContext, sha256: async bytes => labSha256(bytes) });
  assert.deepEqual(asyncBytes, bytes); assert.equal(bytes.length, estimate.containerBytes);
  const decoded = decodeLabResult(bytes, labSha256), asynchronous = await decodeLabResultAsync(bytes, async bytes => labSha256(bytes));
  for (const imported of [decoded, asynchronous]) {
    assertLabEqual(imported.result, result); assert.deepEqual(imported.result.config, config);
    assert.equal(imported.result.runId, result.runId); assert.equal(imported.source, input.source);
    assert.equal(imported.result.computeMilliseconds, result.computeMilliseconds);
    assert.equal(imported.manifest.run.status, result.divergence ? 'diverged' : 'completed');
    assert.equal(imported.manifest.run.requestedSampleCount, config.durationSeconds * 2000);
    assert.equal(imported.manifest.time.endSeconds, result.sampleCount / 2000);
    assert.equal(imported.manifest.time.lastSampleSeconds, result.sampleCount ? (result.sampleCount - 1) / 2000 : null);
    assert.equal(imported.modelSupported, true); assert.equal(imported.layoutSupported, true);
    assert.equal(imported.verifiedMetrics!.rawMetricsMatch, true);
    imported.result.signals.x.forEach((channel, i) => assert.notEqual(channel.buffer, result.signals.x[i].buffer));
    assert.deepEqual(imported.manifest.channels.filter(c => c.signal === 'x').map(c => c.stableId), config.references.map(r => `x:${r.id}`));
  }
  assert.deepEqual(hashLabSignals(result), before); assert.equal(JSON.stringify(config), configBefore);
  const bits = bytes.slice(); decoded.result.sources[0].fill(123);
  assert.deepEqual(bytes, bits); assert.deepEqual(hashLabSignals(result), before);
  return { name, vehicle: config.vehicle, mode: config.sourceMode ?? 'shaped-noise', references: config.references.length,
    requestedSamples: config.durationSeconds * 2000, actualSamples: result.sampleCount, channels: 20 + config.references.length,
    samplesPerRoundtrip: (20 + config.references.length) * result.sampleCount, syncAndAsyncEqual: true, signalHashes: before,
    source: input.source, status: result.divergence ? 'diverged' : 'completed', divergence: result.divergence ?? null,
    rawMetricsMatch: true, payloadBytes: estimate.payloadBytes, containerBytes: bytes.length, inputUnchanged: true };
}
