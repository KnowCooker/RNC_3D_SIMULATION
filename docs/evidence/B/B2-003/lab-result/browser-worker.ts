/** Independent production evidence Worker; not a product integration. */
import { defaultLabConfig, type LabResult } from '../../../../../src/shared/lab-contracts';
import { calculateLab, decodeRecordedNoise } from '../../../../../src/team-b/lab';
import { encodeLabResultAsync, decodeLabResultAsync, LAB_RECORDING_ASSET, ExportError } from '../../../../../src/team-b/export';
const tests: { name: string; passed: boolean }[] = [];
function check(name: string, passed: boolean) { tests.push({ name, passed }); if (!passed) throw new Error(name); }
const sha256 = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))), n => n.toString(16).padStart(2, '0')).join('');
const context = { sourceCommit: '33fbddca6b605b521f38a4bcfee7dc828f43fc04', sha256 };
const batch = (result: LabResult) => ({ mode: 'batch' as const, originSample: 0 as const, result, source: 'computed-browser' as const });
function sameConfig(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a).sort(), right = Object.keys(b).sort();
  return left.length === right.length && left.every((key, i) => key === right[i] && sameConfig((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
function equal(a: LabResult, b: LabResult) {
  const left = [a.sources, a.signals.x, a.signals.u, a.signals.d, a.signals.a, a.signals.e].flat(), right = [b.sources, b.signals.x, b.signals.u, b.signals.d, b.signals.a, b.signals.e].flat();
  return a.sampleCount === b.sampleCount && a.runId === b.runId && sameConfig(a.config, b.config)
    && JSON.stringify(a.divergence) === JSON.stringify(b.divergence) && Object.is(a.metrics.aggregateReductionDb, b.metrics.aggregateReductionDb)
    && a.metrics.reductionDbByMic.every((v, i) => Object.is(v, b.metrics.reductionDbByMic[i]))
    && left.length === right.length && left.every((s, i) => s.length === right[i].length && s.every((v, n) => Object.is(v, right[i][n])));
}
async function run(assetBytes: Uint8Array) {
  check('Real Worker Web Crypto verifies original RNQ1 recording', await sha256(assetBytes) === LAB_RECORDING_ASSET.sha256);
  const recording = decodeRecordedNoise(Uint8Array.from(assetBytes).buffer);
  let samplesCompared = 0, last!: LabResult, saved!: Uint8Array;
  for (const vehicle of ['ice', 'bev', 'hev', 'erev'] as const) for (const sourceMode of ['shaped-noise', 'recorded-noise'] as const) {
    const config = { ...defaultLabConfig(), vehicle, sourceMode, durationSeconds: 2, taps: 32 };
    if (vehicle === 'hev') config.references = [...config.references, ...config.references.map((r, i) => ({ ...r, id: `extra-${i}` }))];
    if (vehicle === 'erev') config.references = config.references.slice(0, 1);
    const result = calculateLab(config, `${vehicle}-${sourceMode}`, sourceMode === 'recorded-noise' ? recording : undefined);
    const bytes = await encodeLabResultAsync(batch(result), context), decoded = await decodeLabResultAsync(bytes, sha256);
    check(`${vehicle}/${sourceMode}: exact q/x/u/d/a/e, metadata and verified metrics`, equal(result, decoded.result)
      && decoded.verifiedMetrics!.rawMetricsMatch && decoded.manifest.channels.length === 20 + config.references.length);
    samplesCompared += (20 + config.references.length) * result.sampleCount; last = result; saved = bytes;
  }
  const divergent = calculateLab({ ...defaultLabConfig(), durationSeconds: 3, stepSize: 2 }, 'divergent');
  const prefix = await decodeLabResultAsync(await encodeLabResultAsync(batch(divergent), context), sha256);
  check('Divergence stays a finite 2909-point prefix of requested 6000', equal(prefix.result, divergent) && prefix.manifest.run.status === 'diverged'
    && prefix.result.sampleCount === 2909 && prefix.manifest.run.requestedSampleCount === 6000);
  const tagged = structuredClone(last); tagged.metrics = { reductionDbByMic: [NaN, Infinity, -Infinity, -0], aggregateReductionDb: NaN };
  const invalid = await decodeLabResultAsync(await encodeLabResultAsync(batch(tagged), context), sha256);
  check('Tagged invalid metrics survive and are never verified as gains', equal(tagged, invalid.result) && !invalid.verifiedMetrics!.rawMetricsMatch
    && invalid.verifiedMetrics!.microphones.slice(0, 3).every(m => !m.valid && m.value === null));
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const moved = saved.slice(), importing = decodeLabResultAsync(moved, async bytes => { await gate; return sha256(bytes); });
  structuredClone(moved, { transfer: [moved.buffer] }); release();
  check('Async import survives transfer of caller container', equal((await importing).result, last));
  const original = structuredClone(last); let unlock!: () => void; const lock = new Promise<void>(resolve => { unlock = resolve; });
  const encoding = encodeLabResultAsync(batch(last), { ...context, sha256: async bytes => { await lock; return sha256(bytes); } });
  last.runId = 'changed'; last.config.seed = 47; last.sources[0].fill(42); last.signals.x[0].fill(42); unlock();
  check('Async encoder captures all source/reference samples and run config before wait', equal((await decodeLabResultAsync(await encoding, sha256)).result, original));
  const altered = saved.slice(); altered[altered.length - 4] ^= 1; let rejected = false;
  try { await decodeLabResultAsync(altered, sha256); } catch (error) { rejected = error instanceof ExportError && error.code === 'INTEGRITY_MISMATCH'; }
  check('Modified finite payload is rejected by actual Web Crypto SHA', rejected);
  let called = false, budgetRejected = false;
  try { await decodeLabResultAsync(saved, async bytes => { called = true; return sha256(bytes); }, { maxContainerBytes: 1 }); }
  catch (error) { budgetRejected = error instanceof ExportError && error.code === 'SIZE_LIMIT'; }
  check('Budget rejects before copying/hashing result', budgetRejected && !called);
  return { ok: true, role: 'B2', task: 'B2-003', identitySource: 'user-declared', executor: 'Codex', tests, passed: tests.length,
    samplesCompared, divergence: { requested: 6000, actual: divergent.sampleCount }, peakMemoryMeasured: false, productIntegrationTested: false };
}
self.onmessage = async ({ data }: MessageEvent<ArrayBuffer>) => {
  try { self.postMessage(await run(new Uint8Array(data))); } catch (error) { self.postMessage({ ok: false, error: String(error), tests }); }
};
