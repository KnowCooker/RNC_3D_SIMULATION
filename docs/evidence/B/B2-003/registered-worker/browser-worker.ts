/** Independent evidence Worker. It does not replace the product Worker or device acceptance. */
import { defaultXPengConfig, XPENG_LAB_LAYOUTS, type LabConfig, type LabResult } from '../../../../../src/shared/lab-contracts';
import { calculateLab, decodeRecordedNoise } from '../../../../../src/team-b/lab';
import { LAB_RECIPE_MODEL, LAB_RECORDING_ASSET, ExportError, encodeLabResult, decodeLabResult,
  encodeLabResultAsync, decodeLabResultAsync, encodeLabRecipe, decodeLabRecipe, recomputeLabRecipeAsync } from '../../../../../src/team-b/export';

type ExpectedCase = { name: string; signalHashes: string[]; samplesPerComparison: number };
type Input = { asset: ArrayBuffer; legacy: ArrayBuffer; legacySha256: string; expected: ExpectedCase[] };
const sourceCommit = '382100930ca950adfed27390acbb6226e0af4afc';
const tests: { name: string; passed: boolean }[] = [];
const check = (name: string, passed: boolean) => { tests.push({ name, passed }); if (!passed) throw new Error(name); };
const sha256 = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))), n => n.toString(16).padStart(2, '0')).join('');
const context = { sourceCommit, sha256 };
const batch = (result: LabResult) => ({ mode: 'batch' as const, originSample: 0 as const, result, source: 'computed-browser' as const });
const recipeInput = (config: LabConfig, originalRunId: string) => ({ mode: 'batch' as const, originSample: 0 as const, config, originalRunId, source: 'computed-browser' as const });
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a).sort(), right = Object.keys(b).sort();
  return left.length === right.length && left.every((key, i) => key === right[i] && same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
const channels = (r: LabResult) => [r.sources, r.signals.x, r.signals.u, r.signals.d, r.signals.a, r.signals.e].flat();
function equal(a: LabResult, b: LabResult, includeRun = true) {
  const left = channels(a), right = channels(b);
  return a.sampleCount === b.sampleCount && (!includeRun || a.runId === b.runId) && same(a.config, b.config)
    && same(a.divergence, b.divergence) && same(a.metrics, b.metrics) && left.length === right.length
    && left.every((s, i) => s.length === right[i].length && s.every((v, n) => Object.is(v, right[i][n])));
}
async function signalHashes(result: LabResult) {
  return Promise.all(channels(result).map(async channel => {
    const bytes = new Uint8Array(channel.length * 4), view = new DataView(bytes.buffer);
    channel.forEach((value, i) => view.setFloat32(i * 4, value, true)); return sha256(bytes);
  }));
}
function configuration(assetId: string, sourceMode: NonNullable<LabConfig['sourceMode']>, count: 1 | 4 | 8): LabConfig {
  const base = defaultXPengConfig(assetId);
  return { ...base, sourceMode, durationSeconds: 1, taps: count === 8 ? 64 : count === 4 ? 32 : 16,
    seed: count === 8 ? 47 : count === 4 ? 29 : 11, levelOffsetDb: 3,
    references: Array.from({ length: count }, (_, i) => ({ ...base.references[i % 4],
      id: `registered-ref-${i}`, name: `REF ${i + 1}`, position: [...base.references[i % 4].position] as [number, number, number] })) };
}
async function rejects(name: string, operation: () => unknown | Promise<unknown>, code: string) {
  let caught = false;
  try { await operation(); } catch (error) { caught = error instanceof ExportError && error.code === code; }
  check(name, caught);
}
function rewrite(bytes: Uint8Array, mutate: (m: any) => void) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), m = view.getUint32(8, true), start = 16 + Math.ceil(m / 4) * 4;
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + m))); mutate(manifest);
  const metadata = new TextEncoder().encode(JSON.stringify(manifest)), payload = bytes.subarray(start);
  const output = new Uint8Array(16 + Math.ceil(metadata.length / 4) * 4 + payload.length); output.set(bytes.subarray(0, 8));
  const header = new DataView(output.buffer); header.setUint32(8, metadata.length, true); header.setUint32(12, payload.length, true);
  output.set(metadata, 16); output.set(payload, 16 + Math.ceil(metadata.length / 4) * 4); return output;
}
async function run(input: Input) {
  check('Dedicated production module Worker with secure Web Crypto', self.constructor.name === 'DedicatedWorkerGlobalScope' && isSecureContext && !!crypto.subtle);
  const asset = new Uint8Array(input.asset), legacyBytes = new Uint8Array(input.legacy);
  check('Original RNQ1 full-byte SHA and byte length', asset.length === LAB_RECORDING_ASSET.bytes && await sha256(asset) === LAB_RECORDING_ASSET.sha256);
  check('Historical model-1 fixture full-byte SHA', await sha256(legacyBytes) === input.legacySha256);
  const recording = decodeRecordedNoise(Uint8Array.from(asset).buffer), cases = [];
  let samplesPerComparison = 0, last!: LabResult, saved!: Uint8Array;
  for (const row of XPENG_LAB_LAYOUTS) for (const sourceMode of ['shaped-noise', 'recorded-noise'] as const) for (const count of [1, 4, 8] as const) {
    const name = `${row.assetId}-${sourceMode}-${count}`, config = configuration(row.assetId, sourceMode, count);
    const result = calculateLab(config, `original-${name}`, sourceMode === 'recorded-noise' ? recording : undefined);
    const hashes = await signalHashes(result), expected = input.expected.find(r => r.name === name);
    check(`${name}: matches committed Node Float32 hashes`, !!expected && same(expected.signalHashes, hashes) && result.sampleCount === 2000 && !result.divergence);
    // Web Crypto is async. Reuse its digest synchronously only for the identical
    // captured payload; do not accept a manifest's self-reported digest.
    let cachedPayload!: Uint8Array, cachedHash = '', cacheCalls = 0;
    const bytes = await encodeLabResultAsync(batch(result), { sourceCommit, sha256: async payload => {
      cachedPayload = Uint8Array.from(payload); cachedHash = await sha256(payload); return cachedHash;
    } });
    const syncHash = (payload: Uint8Array) => {
      if (payload.length !== cachedPayload.length || !payload.every((v, i) => v === cachedPayload[i])) throw new Error('Synchronous SHA cache payload mismatch');
      cacheCalls++; return cachedHash;
    };
    const syncBytes = encodeLabResult(batch(result), { sourceCommit, sha256: syncHash });
    check(`${name}: sync/async container bytes identical`, bytes.length === syncBytes.length && bytes.every((v, i) => v === syncBytes[i]));
    const decoded = await decodeLabResultAsync(bytes, sha256);
    check(`${name}: async exact result and verified metrics`, equal(result, decoded.result) && decoded.modelSupported && decoded.layoutSupported
      && !!decoded.verifiedMetrics?.rawMetricsMatch && same(decoded.manifest.recipe.modelIdentity, LAB_RECIPE_MODEL)
      && decoded.result.sources[0].buffer !== bytes.buffer && decoded.manifest.channels.length === 20 + count);
    const synchronous = decodeLabResult(bytes, syncHash);
    check(`${name}: sync exact result`, equal(result, synchronous.result) && !!synchronous.verifiedMetrics?.rawMetricsMatch);
    check(`${name}: sync adapter checks exact payload against real crypto digest`, cacheCalls === 2);
    const recipe = decodeLabRecipe(encodeLabRecipe(recipeInput(config, result.runId), { sourceCommit }));
    let calls = 0;
    const recomputed = await recomputeLabRecipeAsync(recipe, { runId: `recomputed-${name}`, sha256,
      resolveAsset: async descriptor => { check(`${name}: exact asset identity`, same(descriptor, LAB_RECORDING_ASSET)); calls++; return asset; } });
    // The normalized recipe adds defaults absent in the original config.
    check(`${name}: recipe recomputes exact signals and keeps layout/run association`, equal({ ...result, config: recipe.normalizedConfig }, recomputed.result, false)
      && recomputed.originalRunId === result.runId && recomputed.result.runId !== result.runId && recomputed.status === 'completed' && calls === (sourceMode === 'recorded-noise' ? 1 : 0));
    const values = (20 + count) * result.sampleCount; samplesPerComparison += values;
    cases.push({ name, layoutId: config.layoutId, vehicle: config.vehicle, sourceMode, references: count, signalHashes: hashes,
      actualSamples: result.sampleCount, valuesPerComparison: values, containerBytes: bytes.length, resolverCalls: calls });
    last = result; saved = bytes; self.postMessage({ kind: 'progress', cases: cases.length });
  }
  const historical = await decodeLabResultAsync(legacyBytes, sha256);
  check('Historical model-1 preserves identity/default absence and is read-only', !historical.modelSupported && historical.layoutSupported
    && historical.verifiedMetrics === null && historical.result.config.layoutId === undefined
    && historical.manifest.recipe.modelIdentity.id === 'lab-v3-teaching-batch-recipe-1');
  let sourceCalls = 0;
  const forbidden = { runId: 'new', sha256: async (bytes: Uint8Array) => { sourceCalls++; return sha256(bytes); },
    resolveAsset: async () => { sourceCalls++; return asset; } };
  await rejects('Historical model-1 rejects recompute before asset access', () => recomputeLabRecipeAsync(historical.manifest.recipe, forbidden), 'MODEL_MISMATCH');
  for (const overrides of [{ layoutId: 'unknown' }, { layoutId: 'xpeng-gx' }, { vehicle: 'bev' as const }]) {
    const unknown = await decodeLabResultAsync(rewrite(saved, m => { Object.assign(m.recipe.config, overrides); Object.assign(m.recipe.normalizedConfig, overrides); }), sha256);
    check(`${JSON.stringify(overrides)}: unsupported layout stays read-only`, unknown.modelSupported && !unknown.layoutSupported && unknown.verifiedMetrics === null);
    await rejects(`${JSON.stringify(overrides)}: encode rejects`, () => encodeLabRecipe(recipeInput({ ...last.config, ...overrides }, 'unsupported'), { sourceCommit }), 'UNSUPPORTED_LAYOUT');
    await rejects(`${JSON.stringify(overrides)}: recompute rejects`, () => recomputeLabRecipeAsync(unknown.manifest.recipe, forbidden), 'UNSUPPORTED_LAYOUT');
  }
  check('Unsupported identities never invoke asset resolver or SHA', sourceCalls === 0);
  let hashesCalled = 0;
  await rejects('Unknown layout still rejects bad seed before hashing', () => decodeLabResultAsync(rewrite(saved, m => {
    m.recipe.config.layoutId = m.recipe.normalizedConfig.layoutId = 'unknown'; m.recipe.config.seed = m.recipe.normalizedConfig.seed = 0;
  }), async () => { hashesCalled++; return ''; }), 'INVALID_DATA');
  await rejects('Byte budget rejects before hashing', () => decodeLabResultAsync(saved, async () => { hashesCalled++; return ''; }, { maxContainerBytes: 1 }), 'SIZE_LIMIT');
  check('Malformed and oversized files did not invoke crypto', hashesCalled === 0);
  const altered = saved.slice(); altered[altered.length - 4] ^= 1;
  await rejects('Finite payload tampering fails actual Web Crypto SHA', () => decodeLabResultAsync(altered, sha256), 'INTEGRITY_MISMATCH');
  const offset = new Uint8Array(saved.length + 19); offset.set(saved, 7);
  check('Nonzero byteOffset view roundtrips', equal((await decodeLabResultAsync(offset.subarray(7, 7 + saved.length), sha256)).result, last));
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const moved = saved.slice(), importing = decodeLabResultAsync(moved, async bytes => { await gate; return sha256(bytes); });
  structuredClone(moved, { transfer: [moved.buffer] }); release();
  check('Async import owns container before caller transfer', moved.byteLength === 0 && equal((await importing).result, last));
  const original = structuredClone(last); let unlock!: () => void; const lock = new Promise<void>(resolve => { unlock = resolve; });
  const exporting = encodeLabResultAsync(batch(last), { sourceCommit, sha256: async bytes => { await lock; return sha256(bytes); } });
  last.runId = 'mutated'; last.config.seed = 1; last.sources[0].fill(42); last.signals.x[0].fill(42); unlock();
  check('Async export owns run/config/q/x before crypto wait', equal((await decodeLabResultAsync(await exporting, sha256)).result, original));
  const divergent = calculateLab({ ...configuration('xpeng-gx', 'shaped-noise', 4), durationSeconds: 3, stepSize: 20 }, 'registered-divergence');
  const prefix = await decodeLabResultAsync(await encodeLabResultAsync(batch(divergent), context), sha256);
  check('Registered divergence remains an exact finite prefix', !!divergent.divergence && divergent.sampleCount < 6000 && equal(prefix.result, divergent)
    && prefix.manifest.run.status === 'diverged' && prefix.manifest.run.divergence?.sample === divergent.sampleCount);
  return { ok: true, role: 'B2', task: 'B2-003', executor: 'Codex', identitySource: 'user-declared', date: '2026-10-05',
    sourceCommit, numericalModel: LAB_RECIPE_MODEL, tests, passed: tests.length, cases, samplesPerComparison,
    comparisonKinds: ['browser-vs-Node', 'sync-result-decode', 'async-result-decode', 'recipe-recompute'],
    workerGlobal: self.constructor.name, secureContext: isSecureContext, divergence: { requested: 6000, actual: divergent.sampleCount },
    peakMemoryMeasured: false, productIntegrationTested: false, targetDevicePerformanceAccepted: false, secondMachineTested: false };
}
self.onmessage = async ({ data }: MessageEvent<Input>) => {
  try { self.postMessage({ kind: 'complete', report: await run(data) }); }
  catch (error) { self.postMessage({ kind: 'complete', report: { ok: false, error: String(error), tests } }); }
};
