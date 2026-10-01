import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { DEFAULT_CONFIG } from '../../src/shared/defaults';
import { decodeFixture } from '../../src/shared/fixture';
import { steadyMetrics } from '../../src/team-b/analysis';
import { DEMO_MODEL, ExportError, encodeResult, decodeResult, encodeResultAsync, decodeResultAsync, encodeRecipe, decodeRecipe, recomputeRecipe, estimateExport,
  type BatchExportInput, type Recipe } from '../../src/team-b/export';
import { auditExportCase, batchInput, context, sha256 } from './export-audit';
import { numericCases } from './engine-numeric-audit';

const fixture = decodeFixture(JSON.parse(readFileSync(new URL('../../fixtures/reference/golden_browser_fixture.json', import.meta.url), 'utf8')));
const base = encodeResult(batchInput(fixture), context);
function reject(action: () => unknown, code?: string) {
  assert.throws(action, (error: unknown) => error instanceof ExportError && (!code || error.code === code));
}
function manifest(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + view.getUint32(8, true))));
}
function mutate(change: (value: ReturnType<typeof manifest>) => void, input = base): Uint8Array {
  const value = manifest(input); change(value);
  const m = new TextEncoder().encode(JSON.stringify(value));
  const start = 16 + Math.ceil(m.length / 4) * 4, oldStart = input.length - 2560000;
  const bytes = new Uint8Array(start + 2560000), view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('RNCRSLT1')); view.setUint32(8, m.length, true); view.setUint32(12, 2560000, true);
  bytes.set(m, 16); bytes.set(input.subarray(oldStart), start);
  return bytes;
}
const makeRecipe = () => decodeRecipe(encodeRecipe({ mode: 'batch', originSample: 0, config: DEFAULT_CONFIG,
  originalRunId: 'old', source: 'reference-replay' }, context));

const cryptoSha = async (bytes: Uint8Array) => Buffer.from(await webcrypto.subtle.digest('SHA-256', Uint8Array.from(bytes))).toString('hex');
function gatedHash() {
  let release!: (value: string) => void;
  let captured!: Uint8Array;
  return { sha256: (bytes: Uint8Array) => { captured = Uint8Array.from(bytes); return new Promise<string>(resolve => { release = resolve; }); },
    release: () => release(sha256(captured)) };
}
test('B2-003 async: Web Crypto produces the same container and detached data as sync API', async () => {
  const bytes = await encodeResultAsync(batchInput(fixture), { ...context, sha256: cryptoSha });
  assert.deepEqual(bytes, base);
  const restored = await decodeResultAsync(bytes, cryptoSha);
  assert.deepEqual(restored.result, decodeResult(base, sha256).result);
  assert.notEqual(restored.result.signals.x[0].buffer, bytes.buffer);
});
test('B2-003 async: encoding snapshots config, run identity, samples and budgets before awaiting', async () => {
  const result = structuredClone(fixture), expected = encodeResult(batchInput(result), context), gate = gatedHash();
  const budget = { maxManifestBytes: 65536 }, ctx = { ...context, sha256: gate.sha256 };
  const pending = encodeResultAsync(batchInput(result), ctx, budget);
  result.signals.x[0].fill(42); result.config.seed = 29; result.runId = 'changed'; result.metrics.aggregateReductionDb = NaN;
  ctx.sourceCommit = '0'.repeat(40); budget.maxManifestBytes = 1;
  gate.release(); assert.deepEqual(await pending, expected);
});
test('B2-003 async: decode owns a snapshot across Buffer mutation, offset views and transfer', async () => {
  for (const transfer of [false, true]) {
    const wrapped = new Uint8Array(base.length + 12); wrapped.set(base, 6);
    const bytes = transfer ? wrapped.subarray(6, 6 + base.length) : Buffer.from(wrapped.buffer, 6, base.length);
    const gate = gatedHash(), budget = { maxContainerBytes: base.length };
    const pending = decodeResultAsync(bytes, gate.sha256, budget);
    budget.maxContainerBytes = 1;
    if (transfer) structuredClone(wrapped, { transfer: [wrapped.buffer] });
    else bytes.fill(0);
    gate.release(); assert.deepEqual((await pending).result, decodeResult(base, sha256).result);
  }
});
test('B2-003 async: hash rejections and invalid digests propagate without a partial result', async () => {
  const sentinel = new Error('hash adapter failed');
  const failure = async () => { throw sentinel; };
  await assert.rejects(encodeResultAsync(batchInput(fixture), { ...context, sha256: failure }), error => error === sentinel);
  await assert.rejects(decodeResultAsync(base, failure), error => error === sentinel);
  for (const digest of ['not-a-hash', '0'.repeat(64)]) {
    await assert.rejects(decodeResultAsync(base, async () => digest), error => error instanceof ExportError);
  }
  await assert.rejects(encodeResultAsync(batchInput(fixture), { ...context, sha256: async () => 'bad' }), error => error instanceof ExportError && error.code === 'INVALID_DATA');
});
test('B2-003 async: malformed, nonfinite and over-budget inputs reject before invoking crypto', async () => {
  let calls = 0; const adapter = async (bytes: Uint8Array) => { calls++; return cryptoSha(bytes); };
  await assert.rejects(encodeResultAsync(batchInput(fixture), { ...context, sha256: adapter }, { maxContainerBytes: 1 }), error => error instanceof ExportError && error.code === 'SIZE_LIMIT');
  await assert.rejects(decodeResultAsync(base, adapter, { maxContainerBytes: base.length - 1 }), error => error instanceof ExportError && error.code === 'SIZE_LIMIT');
  await assert.rejects(decodeResultAsync(base.subarray(0, 15), adapter), error => error instanceof ExportError && error.code === 'INVALID_FORMAT');
  await assert.rejects(decodeResultAsync(mutate(m => { m.channels[1].payloadOffset = 0; }), adapter), error => error instanceof ExportError && error.code === 'INVALID_DATA');
  const bad = base.slice(); new DataView(bad.buffer).setFloat32(bad.length - 4, Infinity, true);
  await assert.rejects(decodeResultAsync(bad, adapter), error => error instanceof ExportError && error.code === 'INVALID_DATA');
  assert.equal(calls, 0);
});

for (const spec of numericCases) test(`B2-003: ${spec.name} binary roundtrip, recipe recompute and Python oracle`, () => { auditExportCase(spec); });

test('B2-003: registered source hashes match the numerical implementation', () => {
  for (const [file, expected] of Object.entries(DEMO_MODEL.files)) {
    const bytes = Buffer.from(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n'));
    assert.equal(sha256(bytes), expected, file);
  }
});
test('B2-003: preserve reference identity, little-endian edge bits and offset views', () => {
  const result = structuredClone(fixture), edgeBits = [0x80000000, 1, 0x80000001, 0x7f7fffff, 0xff7fffff];
  const values = new DataView(new ArrayBuffer(4));
  edgeBits.forEach((bits, i) => { values.setUint32(0, bits, true); result.signals.x[0][i] = values.getFloat32(0, true); });
  const encoded = encodeResult(batchInput(result), context), wrapped = new Uint8Array(encoded.length + 14);
  wrapped.set(encoded, 7);
  const restored = decodeResult(wrapped.subarray(7, 7 + encoded.length), sha256);
  assert.equal(restored.result.source, 'reference-replay');
  edgeBits.forEach((bits, i) => {
    values.setFloat32(0, restored.result.signals.x[0][i], true); assert.equal(values.getUint32(0, true), bits);
    assert.equal(new DataView(encoded.buffer).getUint32(encoded.length - 2560000 + i * 4, true), bits);
  });
  const recomputed = recomputeRecipe(makeRecipe(), 'new');
  assert.equal(recomputed.result.source, 'computed-browser'); assert.equal(recomputed.originalRunId, 'old');
});
test('B2-003: silent and zero-denominator metrics retain nonfinite tags and unavailable measurements', () => {
  for (const [d, e, expected] of [[0, 0, NaN], [1, 0, Infinity], [0, 1, -Infinity]] as const) {
    const result = structuredClone(fixture);
    result.signals.d.forEach(channel => channel.fill(d)); result.signals.e.forEach(channel => channel.fill(e));
    result.metrics = steadyMetrics(result.signals);
    const encoded = encodeResult(batchInput(result), context), decoded = decodeResult(encoded, sha256);
    assert.ok(Object.is(decoded.result.metrics.aggregateReductionDb, expected));
    assert.equal(decoded.verifiedSteady!.aggregate.value, null); assert.equal(decoded.verifiedSteady!.aggregate.valid, false);
    assert.equal(typeof manifest(encoded).rawMetrics.aggregateReductionDb, 'object');
  }
});
test('B2-003: genuine zero/negative reductions and tagged negative zero stay distinct from silence', () => {
  for (const residual of [1, 2, 1e-12]) {
    const result = structuredClone(fixture), primary = residual === 1e-12 ? residual : 1;
    result.signals.d.forEach(channel => channel.fill(primary)); result.signals.e.forEach(channel => channel.fill(residual));
    result.metrics = steadyMetrics(result.signals);
    if (residual === 1) { result.metrics.aggregateReductionDb = -0; result.metrics.reductionDbByMic = [-0, 0, 0, 0]; }
    const decoded = decodeResult(encodeResult(batchInput(result), context), sha256);
    if (residual === 1) { assert.ok(Object.is(decoded.result.metrics.aggregateReductionDb, -0)); assert.equal(decoded.verifiedSteady!.aggregate.value, 0); }
    if (residual === 2) assert.ok(decoded.verifiedSteady!.aggregate.value! < 0);
    if (residual === 1e-12) assert.equal(decoded.verifiedSteady!.aggregate.reason, 'below-floor');
  }
});
test('B2-003: malformed/truncated headers, overflow lengths, trailing bytes and padding are rejected', () => {
  for (const length of [0, 7, 15, base.length - 1]) reject(() => decodeResult(base.subarray(0, length), sha256), 'INVALID_FORMAT');
  const trailing = new Uint8Array(base.length + 1); trailing.set(base); reject(() => decodeResult(trailing, sha256), 'INVALID_FORMAT');
  for (const [offset, value, code] of [[8, 0xffffffff, 'SIZE_LIMIT'], [8, 0, 'INVALID_FORMAT'], [12, 0xffffffff, 'INVALID_FORMAT']] as const) {
    const bytes = base.slice(); new DataView(bytes.buffer).setUint32(offset, value, true); reject(() => decodeResult(bytes, sha256), code);
  }
  const magic = base.slice(); magic[0] = 0xff; reject(() => decodeResult(magic, sha256), 'INVALID_FORMAT');
  let padded = base;
  for (let i = 0; new DataView(padded.buffer).getUint32(8, true) % 4 === 0; i++) padded = mutate(m => { m.run.runId = 'p'.repeat(i + 1); });
  padded = padded.slice(); const m = new DataView(padded.buffer).getUint32(8, true); padded[16 + m] = 1;
  reject(() => decodeResult(padded, sha256), 'INVALID_FORMAT');
  const utf8 = base.slice(); utf8[16] = 0xff; reject(() => decodeResult(utf8, sha256), 'INVALID_FORMAT');
});
test('B2-003: schema, channel mapping, units, metadata, normalized config and metrics are validated', () => {
  const changes = [
    (m: any) => { m.run.sampleCount = 2 ** 53; }, (m: any) => { m.channels[1].payloadOffset = 0; },
    (m: any) => { m.channels[1].stableId = m.channels[0].stableId; }, (m: any) => { m.channels[0].unit = 'V'; },
    (m: any) => { m.channels.reverse(); }, (m: any) => { m.channels[0].byteLength++; },
    (m: any) => { m.config.taps = 33; }, (m: any) => { m.normalizedConfig.seed = 29; },
    (m: any) => { m.run.source = 'measured'; }, (m: any) => { m.run.status = 'diverged'; },
    (m: any) => { m.rawMetrics.aggregateReductionDb = 100; }, (m: any) => { m.rawMetrics.aggregateReductionDb = { kind: 'nan', extra: true }; },
    (m: any) => { m.run.computeMilliseconds = -1; }, (m: any) => { m.integrity.payloadBytes = 0; },
    (m: any) => { m.extra = 1; }, (m: any) => { m.config.extra = 1; },
  ];
  changes.forEach(change => reject(() => decodeResult(mutate(change), sha256), 'INVALID_DATA'));
  reject(() => decodeResult(mutate(m => { m.format = 'rnc-result-v2'; }), sha256), 'UNSUPPORTED_VERSION');
});
test('B2-003: integrity mismatch and hash-correct nonfinite payload cannot import', () => {
  const changed = base.slice(); changed[changed.length - 4] ^= 1;
  reject(() => decodeResult(changed, sha256), 'INTEGRITY_MISMATCH');
  for (const bits of [0x7fc00000, 0x7f800000, 0xff800000]) {
    const bytes = base.slice(); new DataView(bytes.buffer).setUint32(bytes.length - 4, bits, true);
    const corrected = mutate(m => { m.integrity.sha256 = sha256(bytes.subarray(bytes.length - 2560000)); }, bytes);
    reject(() => decodeResult(corrected, sha256), 'INVALID_DATA');
  }
});
test('B2-003: budgets refuse before hashing/large output and count UTF-8 bytes', () => {
  let called = false;
  reject(() => encodeResult(batchInput(fixture), { ...context, sha256: () => { called = true; return '0'.repeat(64); } }, { maxContainerBytes: 1 }), 'SIZE_LIMIT');
  assert.equal(called, false);
  for (const budgets of [{ maxManifestBytes: 1 }, { maxContainerBytes: base.length - 1 }, { maxContainerBytes: Infinity }, { maxManifestBytes: -1 }])
    reject(() => decodeResult(base, sha256, budgets), 'SIZE_LIMIT');
  reject(() => estimateExport(batchInput(fixture), context, { maxManifestBytes: 65537 }), 'SIZE_LIMIT');
  const text = encodeRecipe({ mode: 'batch', originSample: 0, config: DEFAULT_CONFIG, originalRunId: '原'.repeat(200), source: 'computed-browser' }, context);
  reject(() => decodeRecipe(text, { maxRecipeBytes: text.length }), 'SIZE_LIMIT');
  reject(() => decodeRecipe('x'.repeat(65537)), 'SIZE_LIMIT');
});
test('B2-003: unknown numerical models are read-only; recipe recompute revalidates identity and fresh id', () => {
  const decoded = decodeResult(mutate(m => { m.modelIdentity.files['src/team-b/engine/core.ts'] = '0'.repeat(64); }), sha256);
  assert.equal(decoded.modelSupported, false); assert.equal(decoded.verifiedSteady, null);
  assert.deepEqual(decoded.result.signals.e[0], fixture.signals.e[0]);
  const recipe = makeRecipe(); recipe.modelIdentity.files['src/team-b/engine/core.ts'] = '0'.repeat(64);
  reject(() => recomputeRecipe(recipe, 'new'), 'MODEL_MISMATCH');
  reject(() => recomputeRecipe(makeRecipe(), 'old'), 'INVALID_DATA');
  const bad = makeRecipe(); bad.config.seed = 0 as 11; reject(() => recomputeRecipe(bad, 'new'), 'INVALID_DATA');
  assert.equal(DEMO_MODEL.files['src/team-b/engine/core.ts'], '5f1186ba0601f5a6cb0dd253a216a2b4a991a37de0930e58f3c7d293f119ed65');
});
test('B2-003: recipes reject extra scripts/URLs/arrays, bad text/config and different schemas', () => {
  reject(() => decodeRecipe('{'), 'INVALID_FORMAT');
  for (const value of [null, [], { ...makeRecipe(), script: 'alert(1)' }, { ...makeRecipe(), url: 'https://example.com' },
    { ...makeRecipe(), sourceCommit: 'x' }, { ...makeRecipe(), requestedSampleCount: 1 }, { ...makeRecipe(), originalRunId: '\ud800' }])
    reject(() => decodeRecipe(JSON.stringify(value)));
  reject(() => decodeRecipe(JSON.stringify({ ...makeRecipe(), format: 'rnc-case-v1' })), 'UNSUPPORTED_VERSION');
  const changed = makeRecipe(); (changed.config as any).schemaVersion = 'lab-v3';
  reject(() => recomputeRecipe(changed, 'new'), 'UNSUPPORTED_VERSION');
});
test('B2-003: live snapshots, partial results, bad dimensions and invalid samples are not batches', () => {
  for (const wrapper of [{ mode: 'live', originSample: 0, result: fixture }, { mode: 'batch', originSample: 20, result: fixture },
    { startSample: 0, endSample: 32000, result: fixture }]) reject(() => encodeResult(wrapper as BatchExportInput, context), 'UNSUPPORTED_MODE');
  for (const change of [(r: any) => { r.sampleCount = 0; }, (r: any) => { r.signals.x.pop(); },
    (r: any) => { r.signals.x[0] = new Float32Array(1); }, (r: any) => { r.signals.x[0][0] = NaN; },
    (r: any) => { r.units.u = 'Pa'; }, (r: any) => { r.order.reverse(); }]) {
    const result = structuredClone(fixture); change(result); reject(() => encodeResult(batchInput(result), context), 'INVALID_DATA');
  }
  const recipe = { ...makeRecipe(), mode: 'live' } as unknown as Recipe;
  reject(() => recomputeRecipe(recipe, 'new'), 'UNSUPPORTED_MODE');
});
