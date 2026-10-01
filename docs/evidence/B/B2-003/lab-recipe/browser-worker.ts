/** Evidence-only Worker; product integration remains an A1 task. */
import { defaultLabConfig, type LabResult } from '../../../../../src/shared/lab-contracts';
import { calculateLab, decodeRecordedNoise } from '../../../../../src/team-b/lab';
import { encodeLabRecipe, decodeLabRecipe, recomputeLabRecipeAsync, LAB_RECORDING_ASSET, ExportError } from '../../../../../src/team-b/export';

const tests: { name: string; passed: boolean }[] = [];
function check(name: string, passed: boolean) { tests.push({ name, passed }); if (!passed) throw new Error(name); }
const sha256 = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))),
  value => value.toString(16).padStart(2, '0')).join('');
function equal(a: LabResult, b: LabResult) {
  const left = [a.sources, a.signals.x, a.signals.u, a.signals.d, a.signals.a, a.signals.e].flat();
  const right = [b.sources, b.signals.x, b.signals.u, b.signals.d, b.signals.a, b.signals.e].flat();
  return a.sampleCount === b.sampleCount && Object.is(a.metrics.aggregateReductionDb, b.metrics.aggregateReductionDb)
    && a.metrics.reductionDbByMic.every((value, i) => Object.is(value, b.metrics.reductionDbByMic[i]))
    && JSON.stringify(a.divergence) === JSON.stringify(b.divergence) && left.length === right.length
    && left.every((channel, i) => channel.length === right[i].length && channel.every((v, n) => Object.is(v, right[i][n])));
}
async function run(assetBytes: Uint8Array) {
  check('Real Worker Web Crypto hashes the complete RNQ1 recording', await sha256(assetBytes) === LAB_RECORDING_ASSET.sha256);
  const recording = decodeRecordedNoise(Uint8Array.from(assetBytes).buffer);
  const context = { sourceCommit: '181952687d6fb303e540e9f1b3981d228b52e744' };
  let samplesCompared = 0;
  for (const vehicle of ['ice', 'bev', 'hev', 'erev'] as const) for (const sourceMode of ['shaped-noise', 'recorded-noise'] as const) {
    const config = { ...defaultLabConfig(), vehicle, sourceMode, durationSeconds: 2, taps: 32 };
    const expected = calculateLab(config, `original-${vehicle}-${sourceMode}`, sourceMode === 'recorded-noise' ? recording : undefined);
    const recipe = decodeLabRecipe(encodeLabRecipe({ mode: 'batch', originSample: 0, config,
      originalRunId: expected.runId, source: 'computed-browser' }, context));
    const actual = await recomputeLabRecipeAsync(recipe, { runId: `new-${expected.runId}`, sha256, resolveAsset: async () => assetBytes });
    check(`${vehicle}/${sourceMode}: exact signals, metrics and new run identity`, equal(actual.result, expected)
      && actual.originalRunId === expected.runId && actual.result.runId !== expected.runId && actual.status === 'completed');
    samplesCompared += (20 + config.references.length) * expected.sampleCount;
  }
  const config = { ...defaultLabConfig(), sourceMode: 'shaped-noise' as const, durationSeconds: 3, stepSize: 2 };
  const recipe = decodeLabRecipe(encodeLabRecipe({ mode: 'batch', originSample: 0, config, originalRunId: 'divergent-original', source: 'computed-browser' }, context));
  const divergent = await recomputeLabRecipeAsync(recipe, { runId: 'divergent-new' });
  check('Divergence preserves the exact finite prefix and status', divergent.status === 'diverged' && divergent.result.sampleCount < recipe.requestedSampleCount
    && divergent.result.sampleCount === divergent.result.divergence?.sample && equal(divergent.result, calculateLab(config, 'expected')));
  const recorded = decodeLabRecipe(encodeLabRecipe({ mode: 'batch', originSample: 0, config: { ...config, stepSize: 0, sourceMode: 'recorded-noise' },
    originalRunId: 'recorded-original', source: 'computed-browser' }, context));
  async function rejects(name: string, code: string, operation: () => Promise<unknown>) {
    let rejected = false;
    try { await operation(); } catch (error) { rejected = error instanceof ExportError && error.code === code; }
    check(name, rejected);
  }
  const changed = Uint8Array.from(assetBytes); changed[changed.length - 1] ^= 1;
  await rejects('Modified recording rejects after actual Web Crypto SHA', 'INTEGRITY_MISMATCH', () => recomputeLabRecipeAsync(recorded,
    { runId: 'hash-bad', sha256, resolveAsset: async () => changed }));
  await rejects('Missing recording has no shaped/random fallback', 'MISSING_ASSET', () => recomputeLabRecipeAsync(recorded, { runId: 'missing' }));
  const unknown = structuredClone(recorded); unknown.config.layoutId = unknown.normalizedConfig.layoutId = 'unsupported-layout';
  let assetCalled = false;
  await rejects('Unknown layout rejects before asset I/O', 'UNSUPPORTED_LAYOUT', () => recomputeLabRecipeAsync(unknown,
    { runId: 'unknown', sha256, resolveAsset: async () => { assetCalled = true; return assetBytes; } }));
  check('Unknown layout never requested recording', !assetCalled);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const captured = Uint8Array.from(assetBytes), originalSeed = recorded.config.seed;
  const pending = recomputeLabRecipeAsync(recorded, { runId: 'snapshot-new', resolveAsset: async () => captured,
    sha256: async bytes => { entered(); await gate; return sha256(bytes); } });
  await started;
  recorded.config.seed = 47; recorded.normalizedConfig.seed = 47;
  structuredClone(captured, { transfer: [captured.buffer] }); release();
  const result = await pending;
  check('Config and recording survive caller mutation/transfer while hashing', result.result.config.seed === originalSeed
    && equal(result.result, calculateLab({ ...config, stepSize: 0, sourceMode: 'recorded-noise', seed: originalSeed }, 'snapshot-expected', recording)));
  return { ok: true, role: 'B2', task: 'B2-003', executor: 'Codex', identitySource: 'user-declared',
    scope: 'teaching lab-v3 recipe only', tests, passed: tests.length, samplesCompared,
    divergence: { requested: recipe.requestedSampleCount, actual: divergent.result.sampleCount, detail: divergent.result.divergence },
    recordingSha256: await sha256(assetBytes), peakMemoryMeasured: false, productIntegrationTested: false };
}
self.onmessage = async ({ data }: MessageEvent<ArrayBuffer>) => {
  try { self.postMessage(await run(new Uint8Array(data))); }
  catch (error) { self.postMessage({ ok: false, error: String(error), tests }); }
};
