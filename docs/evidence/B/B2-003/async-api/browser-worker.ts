/** Verification harness only; not a product Worker or a shared/integration change. */
import { DEFAULT_CONFIG } from '../../../../../src/shared/defaults';
import { calculateSync } from '../../../../../src/team-b/engine/core';
import { encodeResultAsync, decodeResultAsync, encodeRecipe, decodeRecipe, recomputeRecipe, ExportError } from '../../../../../src/team-b/export';
import type { RunResult } from '../../../../../src/shared/contracts';

const tests: { name: string; passed: boolean }[] = [];
const sha256 = async (bytes: Uint8Array) => {
  const hash = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  return Array.from(new Uint8Array(hash), v => v.toString(16).padStart(2, '0')).join('');
};
const sourceCommit = '260d99ab70c153283f115aa1f85673ef2ff927e0';
const context = { sourceCommit, sha256 };
const batch = (result: RunResult) => ({ mode: 'batch' as const, originSample: 0 as const, result });
function check(name: string, passed: boolean) { tests.push({ name, passed }); if (!passed) throw new Error(name); }
function equalSamples(a: RunResult, b: RunResult) {
  for (const kind of ['x', 'u', 'd', 'a', 'e'] as const) for (let channel = 0; channel < 4; channel++) {
    const left = a.signals[kind][channel], right = b.signals[kind][channel];
    if (left.length !== right.length) return false;
    for (let n = 0; n < left.length; n++) if (!Object.is(left[n], right[n])) return false;
  }
  return true;
}
function gateHash() {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  return { release, sha256: async (bytes: Uint8Array) => { await gate; return sha256(bytes); } };
}
async function run() {
  check('Web Crypto exists in this Worker', !!crypto.subtle);
  let last!: RunResult, saved!: Uint8Array;
  for (const [name, change] of [
    ['default', {}], ['seed29', { seed: 29 }], ['seed47', { seed: 47 }], ['taps32', { taps: 32 }], ['mu0', { stepSize: 0 }],
  ] as const) {
    const result = calculateSync({ ...DEFAULT_CONFIG, ...change }, `worker-${name}`);
    const bytes = await encodeResultAsync(batch(result), context);
    const decoded = await decodeResultAsync(bytes, sha256);
    check(`${name}: 640000 samples roundtrip exactly`, equalSamples(result, decoded.result));
    check(`${name}: known model and valid steady metrics`, decoded.modelSupported && decoded.verifiedSteady!.aggregate.valid);
    const recipe = encodeRecipe({ mode: 'batch', originSample: 0, config: result.config, originalRunId: result.runId, source: result.source }, { sourceCommit });
    const recomputed = recomputeRecipe(decodeRecipe(recipe), `${result.runId}-new`);
    check(`${name}: recipe recomputes exactly`, equalSamples(result, recomputed.result) && recomputed.originalRunId === result.runId);
    last = result; saved = bytes;
  }
  const original = structuredClone(last), gate = gateHash();
  const pendingEncode = encodeResultAsync(batch(last), { sourceCommit, sha256: gate.sha256 });
  last.runId = 'changed-while-hashing'; last.config.seed = 29; last.signals.x[0].fill(42);
  gate.release();
  const encoded = await pendingEncode;
  const captured = await decodeResultAsync(encoded, sha256);
  check('Encoder captures samples and identity before await', equalSamples(original, captured.result) && captured.result.runId === original.runId && captured.result.config.seed === original.config.seed);
  const decodeGate = gateHash(), copied = saved.slice();
  const pendingDecode = decodeResultAsync(copied, decodeGate.sha256);
  structuredClone(copied, { transfer: [copied.buffer] });
  decodeGate.release();
  check('Decoder survives caller buffer transfer while hashing', equalSamples(original, (await pendingDecode).result));
  const altered = saved.slice(); altered[altered.length - 4] ^= 1;
  let integrityRejected = false;
  try { await decodeResultAsync(altered, sha256); } catch (error) { integrityRejected = error instanceof ExportError && error.code === 'INTEGRITY_MISMATCH'; }
  check('Changed payload is rejected by real Web Crypto hash', integrityRejected);
  let cryptoCalled = false, budgetRejected = false;
  try { await decodeResultAsync(saved, async bytes => { cryptoCalled = true; return sha256(bytes); }, { maxContainerBytes: 1 }); }
  catch (error) { budgetRejected = error instanceof ExportError && error.code === 'SIZE_LIMIT'; }
  check('Budget rejection occurs before crypto', budgetRejected && !cryptoCalled);
  return { ok: true, role: 'B2', task: 'B2-003', identitySource: 'user-declared', executor: 'Codex', scope: 'demo-v2 only',
    sourceCommitContext: sourceCommit, tests, cases: 5, samplesPerRoundTripAndRecompute: 3200000,
    devicePerformanceMeasured: false, browserPeakMemoryMeasured: false, labV3Implemented: false };
}
self.onmessage = () => { run().then(result => self.postMessage(result)).catch(error => self.postMessage({ ok: false, tests, error: String(error) })); };
