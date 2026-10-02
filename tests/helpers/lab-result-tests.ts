import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLabConfig } from '../../src/shared/lab-contracts';
import { calculateLab } from '../../src/team-b/lab';
import { encodeLabResult, decodeLabResult, encodeLabResultAsync, decodeLabResultAsync, estimateLabExport, ExportError, decodeResult } from '../../src/team-b/export';
import { auditLabResult, labResultContext as context, labResultInput as input } from './lab-result-audit';
import { matrixConfig, assertLabEqual, labSha256 } from './lab-recipe-audit';

const errorCode = (code: string) => (error: unknown) => error instanceof ExportError && error.code === code;
const calculate = () => calculateLab({ ...defaultLabConfig(), durationSeconds: 1, taps: 16 }, 'original');
function rewrite(bytes: Uint8Array, mutate: (manifest: any) => void, changePayload?: (payload: Uint8Array) => void) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), m = view.getUint32(8, true), start = 16 + Math.ceil(m / 4) * 4;
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + m))), payload = bytes.slice(start);
  changePayload?.(payload); manifest.integrity.sha256 = labSha256(payload); mutate(manifest);
  const metadata = new TextEncoder().encode(JSON.stringify(manifest)), output = new Uint8Array(16 + Math.ceil(metadata.length / 4) * 4 + payload.length);
  output.set(bytes.subarray(0, 8)); const header = new DataView(output.buffer); header.setUint32(8, metadata.length, true); header.setUint32(12, payload.length, true);
  output.set(metadata, 16); output.set(payload, 16 + Math.ceil(metadata.length / 4) * 4); return output;
}
for (const vehicle of ['ice', 'bev', 'hev', 'erev'] as const) test(`B2-003 lab result: ${vehicle}, both sources and 1/4/8 references sync/async exact roundtrip`, async () => {
  for (const source of ['shaped-noise', 'recorded-noise'] as const) for (const count of [1, 4, 8] as const)
    await auditLabResult(matrixConfig(vehicle, source, count), `${vehicle}-${source}-${count}-replay`);
});
test('B2-003 lab result: divergence, disabled RNC/output, mu0 and legacy absence retain status and identities', async () => {
  const legacy = { ...defaultLabConfig(), durationSeconds: 1, stepSize: 0 }; delete legacy.layoutId;
  await auditLabResult(legacy, 'legacy');
  await auditLabResult({ ...defaultLabConfig(), durationSeconds: 1, rncEnabled: false }, 'off');
  await auditLabResult({ ...defaultLabConfig(), durationSeconds: 1, speakerEnabled: [false, true, false, true] }, 'partial');
  await auditLabResult({ ...defaultLabConfig(), durationSeconds: 3, stepSize: 2 }, 'diverged');
  await auditLabResult({ ...defaultLabConfig(), durationSeconds: 5, stepSize: 0 }, 'four-second-metric-window');
});
test('B2-003 lab result: tagged invalid metrics survive, disagreeing summary is quarantined', () => {
  const result = calculate(); result.metrics = { reductionDbByMic: [NaN, Infinity, -Infinity, -0], aggregateReductionDb: NaN };
  const decoded = decodeLabResult(encodeLabResult(input(result), context), labSha256);
  assert.deepEqual(decoded.result.metrics, result.metrics); assert.equal(decoded.verifiedMetrics!.rawMetricsMatch, false);
  assert.deepEqual(decoded.verifiedMetrics!.microphones.slice(0, 3).map(m => [m.valid, m.value, m.reason]), [[false, null, 'nonfinite'], [false, null, 'nonfinite'], [false, null, 'nonfinite']]);
  const bytes = encodeLabResult(input(calculate()), context);
  const changed = decodeLabResult(rewrite(bytes, m => { m.rawMetrics.aggregateReductionDb = 123; }), labSha256);
  assert.equal(changed.verifiedMetrics!.rawMetricsMatch, false); assert.equal(changed.verifiedMetrics!.aggregate.reason, 'raw-mismatch');
  assert.equal(changed.verifiedMetrics!.aggregate.value, null);
});
test('B2-003 lab result: silence and empty divergence never become valid zero dB, real mu0 does', () => {
  const normal = calculateLab({ ...defaultLabConfig(), durationSeconds: 1, stepSize: 0 }, 'mu0');
  const valid = decodeLabResult(encodeLabResult(input(normal), context), labSha256);
  assert.equal(valid.verifiedMetrics!.aggregate.value, 0); assert.equal(valid.verifiedMetrics!.aggregate.valid, true);
  const short = structuredClone(normal); short.sampleCount = 999; short.divergence = { sample: 999, message: 'Stopped before the analysis window' };
  short.sources = short.sources.map(s => s.slice(0, 999)) as any;
  for (const kind of ['x', 'u', 'd', 'a', 'e'] as const) short.signals[kind] = short.signals[kind].map(s => s.slice(0, 999)) as any;
  const warming = decodeLabResult(encodeLabResult(input(short), context), labSha256);
  assert.equal(warming.verifiedMetrics!.aggregate.reason, 'warming-up'); assert.equal(warming.verifiedMetrics!.aggregate.value, null);
  for (const channels of [normal.sources, ...Object.values(normal.signals)]) for (const channel of channels) channel.fill(0);
  normal.metrics = { reductionDbByMic: [0, 0, 0, 0], aggregateReductionDb: 0 };
  const silent = decodeLabResult(encodeLabResult(input(normal), context), labSha256);
  assert.equal(silent.verifiedMetrics!.aggregate.reason, 'below-floor'); assert.equal(silent.verifiedMetrics!.aggregate.value, null);
  normal.sampleCount = 0; normal.divergence = { sample: 0, message: 'Numerical failure at first sample' };
  normal.sources = normal.sources.map(() => new Float32Array()) as any;
  for (const kind of ['x', 'u', 'd', 'a', 'e'] as const) normal.signals[kind] = normal.signals[kind].map(() => new Float32Array()) as any;
  const empty = decodeLabResult(encodeLabResult(input(normal), context), labSha256);
  assert.equal(empty.manifest.time.lastSampleSeconds, null); assert.equal(empty.manifest.integrity.payloadBytes, 0);
  assert.equal(empty.verifiedMetrics!.aggregate.reason, 'empty-window');
});
test('B2-003 lab result: finite edge bits and offset views survive with independent arrays', () => {
  const result = calculate(), edges = [-0, 2 ** -149, -(2 ** -149), 3.4028234663852886e38]; result.sources[0].set(edges);
  const bytes = encodeLabResult(input(result), context), offset = new Uint8Array(bytes.length + 19); offset.set(bytes, 7);
  const decoded = decodeLabResult(offset.subarray(7, 7 + bytes.length), labSha256);
  edges.forEach((value, i) => assert.ok(Object.is(decoded.result.sources[0][i], value)));
  assertLabEqual(decoded.result, result); assert.notEqual(decoded.result.sources[0].buffer, bytes.buffer);
});
test('B2-003 lab result: unknown model/layout remain read-only without verified metrics', () => {
  const bytes = encodeLabResult(input(calculate()), context);
  const unknown = decodeLabResult(rewrite(bytes, m => { m.recipe.modelIdentity.id = 'unknown'; }), labSha256);
  assert.equal(unknown.modelSupported, false); assert.equal(unknown.verifiedMetrics, null);
  const layout = decodeLabResult(rewrite(bytes, m => { m.recipe.config.layoutId = m.recipe.normalizedConfig.layoutId = 'unknown'; }), labSha256);
  assert.equal(layout.layoutSupported, false); assert.equal(layout.verifiedMetrics, null);
  assert.throws(() => decodeResult(bytes, labSha256), e => e instanceof ExportError);
});
test('B2-003 lab result: hostile manifest identities, dimensions, units, clocks, state and scalar tags reject before hashing', () => {
  const bytes = encodeLabResult(input(calculate()), context);
  for (const mutate of [
    (m: any) => { m.modelSchema = 'demo-v2'; }, (m: any) => { m.format = 'rnc-result-v9'; },
    (m: any) => { m.channels[0].unit = 'calibrated-V'; }, (m: any) => { m.channels[4].stableId = m.channels[5].stableId; },
    (m: any) => { m.channels[1].payloadOffset = 0; }, (m: any) => { m.channels[0].sampleCount = 1; },
    (m: any) => { m.run.source = 'reference-replay'; }, (m: any) => { m.run.sampleCount = 2 ** 32; },
    (m: any) => { m.run.status = 'diverged'; }, (m: any) => { m.time.lastSampleSeconds = 1; },
    (m: any) => { m.rawMetrics.weighting = 'A'; }, (m: any) => { m.rawMetrics.aggregateReductionDb = { kind: 'nan', extra: 1 }; },
    (m: any) => { m.recipe.config.references[1].id = m.recipe.config.references[0].id; },
    (m: any) => { m.recipe.config.script = 'execute'; }, (m: any) => { m.script = 'execute'; },
  ]) {
    let calls = 0; assert.throws(() => decodeLabResult(rewrite(bytes, mutate), () => { calls++; return ''; }), e => e instanceof ExportError); assert.equal(calls, 0);
  }
});
test('B2-003 lab result: truncation, trailing data, lengths, padding, UTF-8 and nonfinite samples reject', () => {
  const bytes = encodeLabResult(input(calculate()), context);
  for (const value of [bytes.subarray(0, 15), bytes.subarray(0, bytes.length - 1), Uint8Array.from([...bytes, 0])])
    assert.throws(() => decodeLabResult(value, labSha256), errorCode('INVALID_FORMAT'));
  const overflow = bytes.slice(); new DataView(overflow.buffer).setUint32(12, 0xffffffff, true);
  assert.throws(() => decodeLabResult(overflow, labSha256), errorCode('INVALID_FORMAT'));
  const utf8 = bytes.slice(); utf8[16] = 0xff; assert.throws(() => decodeLabResult(utf8, labSha256), errorCode('INVALID_FORMAT'));
  const metadata = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + new DataView(bytes.buffer).getUint32(8, true))));
  let padded = bytes;
  while (new DataView(padded.buffer).getUint32(8, true) % 4 === 0) { metadata.run.runId += 'a'; metadata.recipe.originalRunId = metadata.run.runId; padded = rewrite(bytes, m => Object.assign(m, metadata)); }
  const end = 16 + new DataView(padded.buffer).getUint32(8, true); padded = padded.slice(); padded[end] = 1;
  assert.throws(() => decodeLabResult(padded, labSha256), errorCode('INVALID_FORMAT'));
  const nan = rewrite(bytes, () => {}, payload => new DataView(payload.buffer).setFloat32(0, NaN, true));
  let calls = 0; assert.throws(() => decodeLabResult(nan, () => { calls++; return ''; }), errorCode('INVALID_DATA')); assert.equal(calls, 0);
  const corrupted = bytes.slice(); corrupted[corrupted.length - 1] ^= 1;
  assert.throws(() => decodeLabResult(corrupted, labSha256), e => e instanceof ExportError);
});
test('B2-003 lab result: explicit batch, complete/prefix rules, array shape, UTF-8 identity and budgets reject before crypto', async () => {
  const result = calculate(), batch = input(result);
  for (const mutate of [
    (b: any) => { b.mode = 'live'; }, (b: any) => { b.originSample = 2000; }, (b: any) => { b.result.sampleCount--; },
    (b: any) => { b.result.signals.x.pop(); }, (b: any) => { b.result.sources[0][0] = Infinity; },
    (b: any) => { b.result.runId = '\ud800'; }, (b: any) => { b.result.divergence = { sample: 1, message: 'wrong' }; },
    (b: any) => { b.result.metrics.reductionDbByMic = Array(4); },
  ]) { const changed = structuredClone(batch); mutate(changed); assert.throws(() => encodeLabResult(changed, context), e => e instanceof ExportError); }
  let called = false;
  await assert.rejects(encodeLabResultAsync(batch, { ...context, sha256: async () => { called = true; return ''; } }, { maxContainerBytes: 1 }), errorCode('SIZE_LIMIT')); assert.equal(called, false);
  const bytes = encodeLabResult(batch, context);
  await assert.rejects(decodeLabResultAsync(bytes, async () => { called = true; return ''; }, { maxContainerBytes: 1 }), errorCode('SIZE_LIMIT')); assert.equal(called, false);
  assert.throws(() => estimateLabExport(batch, context, { maxManifestBytes: 1 }), errorCode('SIZE_LIMIT'));
  assert.throws(() => decodeLabResult(bytes, labSha256, { maxContainerBytes: Infinity }), errorCode('SIZE_LIMIT'));
});
test('B2-003 lab result: async encoder captures all signals/metadata/limits before await', async () => {
  const result = calculate(), saved = structuredClone(result), limits = { maxContainerBytes: 1024 * 1024 };
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const pending = encodeLabResultAsync(input(result), { ...context, sha256: async bytes => { await gate; return labSha256(bytes); } }, limits);
  result.runId = 'changed'; result.config.seed = 29; result.sources[0].fill(0); result.signals.x[0].fill(0); result.metrics.aggregateReductionDb = 123; limits.maxContainerBytes = 1; release();
  const decoded = decodeLabResult(await pending, labSha256); assertLabEqual(decoded.result, saved);
  assert.equal(decoded.result.runId, saved.runId); assert.deepEqual(decoded.result.config, saved.config);
});
test('B2-003 lab result: async import owns Buffer/offset views across mutation or transfer; SHA failures propagate', async () => {
  const result = calculate(), bytes = encodeLabResult(input(result), context);
  for (const transfer of [false, true]) {
    const view = transfer ? bytes.slice() : Buffer.from(bytes);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const pending = decodeLabResultAsync(view, async snapshot => { await gate; return labSha256(snapshot); });
    if (transfer) structuredClone(view, { transfer: [view.buffer] }); else view.fill(0);
    release(); assertLabEqual((await pending).result, result);
  }
  const sentinel = new Error('crypto failed');
  await assert.rejects(encodeLabResultAsync(input(result), { ...context, sha256: async () => { throw sentinel; } }), e => e === sentinel);
  await assert.rejects(decodeLabResultAsync(bytes, async () => { throw sentinel; }), e => e === sentinel);
  await assert.rejects(decodeLabResultAsync(bytes, async () => '0'.repeat(64)), errorCode('INTEGRITY_MISMATCH'));
  assert.throws(() => encodeLabResult(input(result), { ...context, sha256: () => 'invalid' }), errorCode('INVALID_DATA'));
});
