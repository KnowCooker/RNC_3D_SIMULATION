import { ORDER, type RunConfig, type RunResult, type Four, type SteadyMetrics } from '../../shared/contracts';
import { DEFAULT_CONFIG } from '../../shared/defaults';
import { calculateSync, validateConfig } from '../engine/core';
import { meanPower, steadyMetrics } from '../analysis';
import { DEMO_MODEL } from './model';
import { ExportError, type ExportErrorCode } from './errors';
export { DEMO_MODEL } from './model';
export { ExportError, type ExportErrorCode } from './errors';
export { encodeLabRecipe, decodeLabRecipe, recomputeLabRecipeAsync, LAB_RECORDING_ASSET,
  type LabRecipe, type LabRecipeInput, type LabRecomputeContext, type LabRecipeLimits } from './lab-recipe';
export { LAB_RECIPE_MODEL } from './lab-model';
export { encodeLabResult, encodeLabResultAsync, decodeLabResult, decodeLabResultAsync, estimateLabExport,
  type LabBatchExportInput, type LabResultManifest, type DecodedLabResult, type LabChannel, type LabMeasuredReduction } from './lab-result';
/** Trusted caller supplies SHA-256; this module performs no I/O or environment-specific crypto. */
export type Sha256 = (bytes: Uint8Array) => string;
export type AsyncSha256 = (bytes: Uint8Array) => Promise<string>;
export interface ExportContext { sha256: Sha256; sourceCommit: string }
export interface AsyncExportContext { sha256: AsyncSha256; sourceCommit: string }
export interface ImportLimits { maxContainerBytes?: number; maxManifestBytes?: number; maxRecipeBytes?: number }
export interface BatchExportInput { mode: 'batch'; originSample: 0; result: RunResult }
export interface BatchRecipeInput { mode: 'batch'; originSample: 0; config: RunConfig; originalRunId: string; source: RunResult['source'] }
type WireScalar = number | { kind: 'nan' | 'positive-infinity' | 'negative-infinity' | 'negative-zero' };
interface ModelIdentity { id: string; hashEncoding: 'utf8-lf'; files: Record<string, string> }
interface Channel { signal: typeof KINDS[number]; index: number; stableId: string; unit: string; payloadOffset: number; sampleCount: number; byteLength: number }
interface Identity {
  modelSchema: 'demo-v2'; modelIdentity: ModelIdentity; sourceCommit: string;
  config: RunConfig; normalizedConfig: RunConfig; normalization: 'demo-explicit-v1';
}
export interface Recipe extends Identity {
  format: 'rnc-recipe-v1'; mode: 'batch'; originSample: 0; originalRunId: string;
  source: RunResult['source']; requestedSampleCount: 32000;
}
interface Manifest extends Identity {
  format: 'rnc-result-v1';
  run: { runId: string; mode: 'batch'; source: RunResult['source']; originSample: 0; sampleRateHz: 2000;
    requestedSampleCount: 32000; sampleCount: 32000; status: 'completed'; computeMilliseconds: number | null };
  provenance: 'synthetic-teaching-signals';
  channels: Channel[];
  rawMetrics: { startSeconds: 12; endSeconds: 16; measurement: SteadyMetrics['measurement']; reductionDbByMic: WireScalar[]; aggregateReductionDb: WireScalar };
  integrity: { payloadBytes: number; sha256: string };
}
export interface MeasuredReduction { value: number | null; valid: boolean; reason: 'ok' | 'below-floor' | 'nonfinite'; unit: 'dB' }
export interface DecodedResult {
  /** Detached arrays. Unknown model data is readable, but cannot be recomputed or treated as verified. */
  result: RunResult; manifest: Manifest; modelSupported: boolean;
  verifiedSteady: { startSeconds: 12; endSeconds: 16; weighting: 'Z'; microphones: Four<MeasuredReduction>; aggregate: MeasuredReduction } | null;
}
export interface ExportEstimate { payloadBytes: number; manifestBytes: number; containerBytes: number; minimumResidentSignalBytes: number }

const KINDS = ['x', 'u', 'd', 'a', 'e'] as const;
const UNITS = { x: 'm/s2', u: 'drive', d: 'Pa', a: 'Pa', e: 'Pa' } as const;
const N = 32000, PAYLOAD = 20 * N * 4, HEADER = 16;
const MAX_CONTAINER = 64 * 1024 * 1024, MAX_JSON = 64 * 1024;
const MAGIC = 'RNCRSLT1';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function fail(code: ExportErrorCode, message: string): never { throw new ExportError(code, message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_DATA', 'Expected an object');
  return value as Record<string, unknown>;
}
function keys(value: unknown, expected: readonly string[]): Record<string, unknown> {
  const record = object(value), actual = Object.keys(record);
  if (actual.length !== expected.length || actual.some(key => !expected.includes(key))) fail('INVALID_DATA', 'Unexpected or missing fields');
  return record;
}
function equal(value: unknown, expected: unknown, label: string): void {
  if (value !== expected) fail('INVALID_DATA', `Invalid ${label}`);
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) fail('INVALID_DATA', `Invalid ${label}`);
  // Avoid losing lone UTF-16 surrogates when encoding UTF-8.
  if (decoder.decode(encoder.encode(value)) !== value) fail('INVALID_DATA', `Invalid UTF-8 ${label}`);
  return value;
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail('INVALID_DATA', 'Invalid SHA-256');
  return value;
}
function commit(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/u.test(value)) fail('INVALID_DATA', 'Expected the source commit SHA');
  return value;
}
function source(value: unknown): RunResult['source'] {
  if (value !== 'computed-browser' && value !== 'reference-replay') fail('INVALID_DATA', 'Invalid result source');
  return value;
}
function config(value: unknown): RunConfig {
  const record = object(value);
  if (record.schemaVersion !== 'demo-v2') fail('UNSUPPORTED_VERSION', 'Only demo-v2 is implemented');
  keys(record, Object.keys(DEFAULT_CONFIG));
  try { validateConfig(record as unknown as RunConfig); } catch { fail('INVALID_DATA', 'Invalid demo configuration'); }
  // Fixed key order also gives deterministic comparison without trusting input serialization order.
  return Object.fromEntries(Object.keys(DEFAULT_CONFIG).map(key => [key, record[key]])) as unknown as RunConfig;
}
function model(value: unknown): ModelIdentity {
  const record = keys(value, ['id', 'hashEncoding', 'files']);
  text(record.id, 'model id'); equal(record.hashEncoding, 'utf8-lf', 'model hash encoding');
  const files = keys(record.files, Object.keys(DEMO_MODEL.files));
  for (const value of Object.values(files)) hash(value);
  return record as unknown as ModelIdentity;
}
function supported(identity: ModelIdentity): boolean {
  return identity.id === DEMO_MODEL.id && Object.entries(DEMO_MODEL.files).every(([file, digest]) => identity.files[file] === digest);
}
function identity(value: Record<string, unknown>): Identity {
  equal(value.modelSchema, 'demo-v2', 'model schema');
  const original = config(value.config), normalized = config(value.normalizedConfig);
  equal(value.normalization, 'demo-explicit-v1', 'normalization');
  equal(JSON.stringify(original), JSON.stringify(normalized), 'normalized config');
  return { modelSchema: 'demo-v2', modelIdentity: model(value.modelIdentity), sourceCommit: commit(value.sourceCommit),
    config: original, normalizedConfig: normalized, normalization: 'demo-explicit-v1' };
}
function makeIdentity(value: RunConfig, context: Pick<ExportContext, 'sourceCommit'>): Identity {
  const original = config(value);
  return { modelSchema: 'demo-v2', modelIdentity: structuredClone(DEMO_MODEL), sourceCommit: commit(context.sourceCommit),
    config: original, normalizedConfig: { ...original }, normalization: 'demo-explicit-v1' };
}
function limit(value: number | undefined, ceiling: number): number {
  if (value === undefined) return ceiling;
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) fail('SIZE_LIMIT', 'Invalid import budget');
  return value;
}
function jsonBytes(value: unknown, max: number): Uint8Array {
  const bytes = encoder.encode(JSON.stringify(value));
  if (bytes.length > max) fail('SIZE_LIMIT', 'JSON exceeds byte budget');
  return bytes;
}
function parse(bytes: Uint8Array): unknown {
  try { return JSON.parse(decoder.decode(bytes)); } catch { fail('INVALID_FORMAT', 'Invalid UTF-8 JSON'); }
}
function batch(value: unknown): Record<string, unknown> {
  const input = object(value);
  if (input.mode !== 'batch' || input.originSample !== 0) fail('UNSUPPORTED_MODE', 'Only batches starting at sample zero are supported');
  return input;
}
function scalar(value: number): WireScalar {
  if (typeof value !== 'number') fail('INVALID_DATA', 'Metric must be a number');
  return Number.isNaN(value) ? { kind: 'nan' } : value === Infinity ? { kind: 'positive-infinity' }
    : value === -Infinity ? { kind: 'negative-infinity' } : Object.is(value, -0) ? { kind: 'negative-zero' } : value;
}
function number(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value;
  const record = keys(value, ['kind']);
  switch (record.kind) {
    case 'nan': return NaN;
    case 'positive-infinity': return Infinity;
    case 'negative-infinity': return -Infinity;
    case 'negative-zero': return -0;
    default: return fail('INVALID_DATA', 'Invalid scalar tag');
  }
}
function rawMetrics(value: unknown): SteadyMetrics {
  const record = keys(value, ['startSeconds', 'endSeconds', 'measurement', 'reductionDbByMic', 'aggregateReductionDb']);
  equal(record.startSeconds, 12, 'metric start'); equal(record.endSeconds, 16, 'metric end');
  equal(record.measurement, 'unweighted-full-sampled-band', 'metric measurement');
  if (!Array.isArray(record.reductionDbByMic) || record.reductionDbByMic.length !== 4) fail('INVALID_DATA', 'Expected four microphone metrics');
  return { startSeconds: 12, endSeconds: 16, measurement: 'unweighted-full-sampled-band',
    reductionDbByMic: record.reductionDbByMic.map(number) as unknown as Four<number>, aggregateReductionDb: number(record.aggregateReductionDb) };
}
function wireMetrics(value: SteadyMetrics): Manifest['rawMetrics'] {
  const record = object(value);
  const parsed = rawMetrics({ ...record, reductionDbByMic: Array.isArray(record.reductionDbByMic) ? record.reductionDbByMic.map(scalar) : null,
    aggregateReductionDb: scalar(record.aggregateReductionDb as number) });
  return { ...parsed, reductionDbByMic: parsed.reductionDbByMic.map(scalar), aggregateReductionDb: scalar(parsed.aggregateReductionDb) };
}
function channels(): Channel[] {
  return KINDS.flatMap((signal, kind) => ORDER.map((corner, index) => ({ signal, index, stableId: `${signal}:${corner}`,
    unit: UNITS[signal], payloadOffset: (kind * 4 + index) * N * 4, sampleCount: N, byteLength: N * 4 })));
}
function validateChannels(value: unknown): void {
  const expected = channels();
  if (!Array.isArray(value) || value.length !== 20) fail('INVALID_DATA', 'Expected twenty channels');
  expected.forEach((channel, i) => {
    const actual = keys(value[i], Object.keys(channel));
    for (const [key, value] of Object.entries(channel)) equal(actual[key], value, `channel ${i}/${key}`);
  });
}
function milliseconds(value: unknown): number | null {
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) fail('INVALID_DATA', 'Invalid compute time');
  return value as number | null;
}
function checkMetrics(result: RunResult): NonNullable<DecodedResult['verifiedSteady']> {
  const derived = steadyMetrics(result.signals);
  const actual = [...result.metrics.reductionDbByMic, result.metrics.aggregateReductionDb];
  const expected = [...derived.reductionDbByMic, derived.aggregateReductionDb];
  expected.forEach((value, i) => {
    // Frozen reference replay metrics were computed before Float32 conversion.
    if (!(Number.isNaN(value) && Number.isNaN(actual[i])) && value !== actual[i]
      && !(Number.isFinite(value) && Number.isFinite(actual[i]) && Math.abs(value - actual[i]) <= 1e-6)) fail('INVALID_DATA', 'Metrics disagree with raw signals');
  });
  const d = result.signals.d.map(channel => meanPower(channel, 24000, N));
  const e = result.signals.e.map(channel => meanPower(channel, 24000, N));
  const measured = (primary: number, residual: number, value: number): MeasuredReduction => {
    const reason = !Number.isFinite(value) ? 'nonfinite' : primary <= 1e-20 || residual <= 1e-20 ? 'below-floor' : 'ok';
    return { value: reason === 'ok' ? value : null, valid: reason === 'ok', reason, unit: 'dB' };
  };
  return { startSeconds: 12, endSeconds: 16, weighting: 'Z',
    microphones: d.map((power, i) => measured(power, e[i], derived.reductionDbByMic[i])) as unknown as Four<MeasuredReduction>,
    aggregate: measured(d.reduce((a, b) => a + b), e.reduce((a, b) => a + b), derived.aggregateReductionDb) };
}
function makeManifest(input: BatchExportInput, context: Pick<ExportContext, 'sourceCommit'>, payloadHash: string): Manifest {
  const wrapper = batch(input); keys(wrapper, ['mode', 'originSample', 'result']);
  const result = keys(input.result, ['runId', 'source', 'config', 'sampleCount', 'order', 'units', 'signals', 'metrics', 'computeMilliseconds']);
  const ids = makeIdentity(input.result.config, context);
  equal(result.sampleCount, N, 'sample count');
  if (!Array.isArray(result.order) || result.order.length !== 4 || result.order.some((value, i) => value !== ORDER[i])) fail('INVALID_DATA', 'Invalid corner order');
  const units = keys(result.units, KINDS);
  for (const kind of KINDS) equal(units[kind], UNITS[kind], `unit ${kind}`);
  const signals = keys(result.signals, KINDS);
  for (const kind of KINDS) {
    if (!Array.isArray(signals[kind]) || (signals[kind] as unknown[]).length !== 4) fail('INVALID_DATA', 'Invalid signal dimension');
    for (const channel of signals[kind] as unknown[]) {
      if (!(channel instanceof Float32Array) || channel.length !== N) fail('INVALID_DATA', 'Expected full Float32 channels');
      if (!channel.every(Number.isFinite)) fail('INVALID_DATA', 'Nonfinite signal sample');
    }
  }
  const metrics = wireMetrics(input.result.metrics);
  checkMetrics(input.result);
  return { ...ids, format: 'rnc-result-v1',
    run: { runId: text(result.runId, 'run id'), mode: 'batch', source: source(result.source), originSample: 0, sampleRateHz: 2000,
      requestedSampleCount: N, sampleCount: N, status: 'completed', computeMilliseconds: milliseconds(result.computeMilliseconds) },
    provenance: 'synthetic-teaching-signals', channels: channels(), rawMetrics: metrics,
    integrity: { payloadBytes: PAYLOAD, sha256: hash(payloadHash) } };
}
/** Exact size before constructing the signal payload. minimumResidentSignalBytes is a lower bound, not a measured peak. */
export function estimateExport(input: BatchExportInput, context: Pick<ExportContext, 'sourceCommit'>, limits: ImportLimits = {}): ExportEstimate {
  const manifest = jsonBytes(makeManifest(input, context, '0'.repeat(64)), limit(limits.maxManifestBytes, MAX_JSON));
  const containerBytes = HEADER + Math.ceil(manifest.length / 4) * 4 + PAYLOAD;
  if (containerBytes > limit(limits.maxContainerBytes, MAX_CONTAINER)) fail('SIZE_LIMIT', 'Container exceeds byte budget');
  return { payloadBytes: PAYLOAD, manifestBytes: manifest.length, containerBytes, minimumResidentSignalBytes: PAYLOAD + containerBytes };
}
function prepareEncoding(input: BatchExportInput, context: Pick<ExportContext, 'sourceCommit'>, limits: ImportLimits) {
  const estimate = estimateExport(input, context, limits);
  // Capture metadata and samples synchronously, before invoking either hash adapter.
  const manifest = makeManifest(input, context, '0'.repeat(64));
  const bytes = new Uint8Array(estimate.containerBytes), view = new DataView(bytes.buffer);
  const payloadStart = estimate.containerBytes - PAYLOAD;
  for (const descriptor of channels()) {
    const signal = input.result.signals[descriptor.signal][descriptor.index];
    for (let n = 0; n < N; n++) view.setFloat32(payloadStart + descriptor.payloadOffset + n * 4, signal[n], true);
  }
  return { bytes, manifest, payloadStart, estimate, limits };
}
function finishEncoding(prepared: ReturnType<typeof prepareEncoding>, digest: string): Uint8Array {
  const { bytes, manifest, estimate, limits } = prepared;
  manifest.integrity.sha256 = hash(digest);
  const metadata = jsonBytes(manifest, limit(limits.maxManifestBytes, MAX_JSON));
  equal(metadata.length, estimate.manifestBytes, 'captured manifest length');
  const view = new DataView(bytes.buffer);
  bytes.set(encoder.encode(MAGIC)); view.setUint32(8, metadata.length, true); view.setUint32(12, PAYLOAD, true); bytes.set(metadata, HEADER);
  return bytes;
}
export function encodeResult(input: BatchExportInput, context: ExportContext, limits: ImportLimits = {}): Uint8Array {
  const prepared = prepareEncoding(input, context, limits);
  return finishEncoding(prepared, context.sha256(prepared.bytes.subarray(prepared.payloadStart)));
}
/** Compatible with a caller's Web Crypto adapter; the input is captured before the first await. */
export async function encodeResultAsync(input: BatchExportInput, context: AsyncExportContext, limits: ImportLimits = {}): Promise<Uint8Array> {
  const prepared = prepareEncoding(input, context, { ...limits });
  return finishEncoding(prepared, await context.sha256(prepared.bytes.subarray(prepared.payloadStart)));
}
function containerHeader(bytes: Uint8Array, limits: ImportLimits) {
  if (!(bytes instanceof Uint8Array)) fail('INVALID_FORMAT', 'Expected container bytes');
  if (bytes.length > limit(limits.maxContainerBytes, MAX_CONTAINER)) fail('SIZE_LIMIT', 'Container exceeds byte budget');
  if (bytes.length < HEADER || Array.from(MAGIC).some((char, i) => bytes[i] !== char.charCodeAt(0))) fail('INVALID_FORMAT', 'Invalid container header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const m = view.getUint32(8, true), p = view.getUint32(12, true), payloadStart = HEADER + Math.ceil(m / 4) * 4;
  if (m > limit(limits.maxManifestBytes, MAX_JSON)) fail('SIZE_LIMIT', 'Manifest exceeds byte budget');
  if (m === 0 || p !== PAYLOAD || payloadStart + p !== bytes.length) fail('INVALID_FORMAT', 'Invalid container lengths');
  for (let i = HEADER + m; i < payloadStart; i++) if (bytes[i] !== 0) fail('INVALID_FORMAT', 'Nonzero alignment padding');
  return { view, m, p, payloadStart };
}
function inspectResult(bytes: Uint8Array, limits: ImportLimits) {
  const { view, m, p, payloadStart } = containerHeader(bytes, limits);
  const record = object(parse(bytes.subarray(HEADER, HEADER + m)));
  if (record.format !== 'rnc-result-v1') fail('UNSUPPORTED_VERSION', 'Unknown result format');
  keys(record, ['format', 'modelSchema', 'modelIdentity', 'sourceCommit', 'config', 'normalizedConfig', 'normalization', 'run', 'provenance', 'channels', 'rawMetrics', 'integrity']);
  const ids = identity(record);
  const run = keys(record.run, ['runId', 'mode', 'source', 'originSample', 'sampleRateHz', 'requestedSampleCount', 'sampleCount', 'status', 'computeMilliseconds']);
  batch(run); text(run.runId, 'run id'); source(run.source); milliseconds(run.computeMilliseconds);
  equal(run.sampleRateHz, 2000, 'sample rate'); equal(run.requestedSampleCount, N, 'requested samples');
  equal(run.sampleCount, N, 'actual samples'); equal(run.status, 'completed', 'status');
  equal(record.provenance, 'synthetic-teaching-signals', 'provenance'); validateChannels(record.channels);
  const metrics = rawMetrics(record.rawMetrics), integrity = keys(record.integrity, ['payloadBytes', 'sha256']);
  equal(integrity.payloadBytes, p, 'payload bytes');
  const expectedHash = hash(integrity.sha256);
  // Scan before allocating any output channel, including a hash-correct malicious payload.
  for (let offset = payloadStart; offset < bytes.length; offset += 4) if (!Number.isFinite(view.getFloat32(offset, true))) fail('INVALID_DATA', 'Nonfinite signal sample');
  return { bytes, view, payloadStart, expectedHash, record, ids, run, metrics };
}
function restoreResult(inspected: ReturnType<typeof inspectResult>, digest: string): DecodedResult {
  const { view, payloadStart, expectedHash, record, ids, run, metrics } = inspected;
  if (expectedHash !== hash(digest)) fail('INTEGRITY_MISMATCH', 'Payload SHA-256 mismatch');
  const collected: Record<typeof KINDS[number], Float32Array[]> = { x: [], u: [], d: [], a: [], e: [] };
  for (const descriptor of channels()) {
    const signal = new Float32Array(N);
    for (let n = 0; n < N; n++) signal[n] = view.getFloat32(payloadStart + descriptor.payloadOffset + n * 4, true);
    collected[descriptor.signal].push(signal);
  }
  const result: RunResult = { runId: run.runId as string, source: run.source as RunResult['source'], config: ids.config,
    sampleCount: N, order: [...ORDER], units: { ...UNITS }, signals: collected as unknown as RunResult['signals'], metrics, computeMilliseconds: run.computeMilliseconds as number | null };
  const modelSupported = supported(ids.modelIdentity);
  return { result, manifest: { ...record, ...ids } as unknown as Manifest, modelSupported,
    verifiedSteady: modelSupported ? checkMetrics(result) : null };
}
export function decodeResult(bytes: Uint8Array, sha256: Sha256, limits: ImportLimits = {}): DecodedResult {
  const inspected = inspectResult(bytes, limits);
  return restoreResult(inspected, sha256(bytes.subarray(inspected.payloadStart)));
}
/** Detached bounded copy prevents caller mutation/transfer while hashing from changing imported data. */
export async function decodeResultAsync(bytes: Uint8Array, sha256: AsyncSha256, limits: ImportLimits = {}): Promise<DecodedResult> {
  const budgets = { ...limits };
  containerHeader(bytes, budgets); // Check size and declared bounds before the copy.
  const snapshot = Uint8Array.from(bytes); // Also copies Node Buffer subclasses instead of sharing Buffer.slice().
  const inspected = inspectResult(snapshot, budgets);
  return restoreResult(inspected, await sha256(snapshot.subarray(inspected.payloadStart)));
}
function validateRecipe(value: unknown): Recipe {
  const record = object(value);
  if (record.format !== 'rnc-recipe-v1') fail('UNSUPPORTED_VERSION', 'Unknown recipe format');
  keys(record, ['format', 'modelSchema', 'modelIdentity', 'sourceCommit', 'config', 'normalizedConfig', 'normalization', 'mode', 'originSample', 'originalRunId', 'source', 'requestedSampleCount']);
  const ids = identity(record); batch(record); equal(record.requestedSampleCount, N, 'requested sample count');
  return { ...ids, format: 'rnc-recipe-v1', mode: 'batch', originSample: 0,
    originalRunId: text(record.originalRunId, 'original run id'), source: source(record.source), requestedSampleCount: N };
}
export function encodeRecipe(input: BatchRecipeInput, context: Pick<ExportContext, 'sourceCommit'>, limits: ImportLimits = {}): string {
  batch(input); keys(input, ['mode', 'originSample', 'config', 'originalRunId', 'source']);
  const recipe = validateRecipe({ ...makeIdentity(input.config, context), format: 'rnc-recipe-v1', mode: input.mode, originSample: input.originSample,
    originalRunId: input.originalRunId, source: input.source, requestedSampleCount: N });
  return decoder.decode(jsonBytes(recipe, limit(limits.maxRecipeBytes, MAX_JSON)));
}
export function decodeRecipe(value: string, limits: ImportLimits = {}): Recipe {
  if (typeof value !== 'string') fail('INVALID_FORMAT', 'Expected recipe JSON');
  const max = limit(limits.maxRecipeBytes, MAX_JSON);
  if (value.length > max) fail('SIZE_LIMIT', 'Recipe exceeds byte budget');
  const bytes = encoder.encode(value);
  if (bytes.length > max) fail('SIZE_LIMIT', 'Recipe exceeds UTF-8 byte budget');
  return validateRecipe(parse(bytes));
}
/** Revalidates even an in-memory recipe. No computation on import; callers choose a fresh run id. */
export function recomputeRecipe(value: Recipe, newRunId: string): { originalRunId: string; result: RunResult } {
  // Bound untrusted in-memory objects too; the supported shape itself has no large arrays.
  const recipe = validateRecipe(value);
  if (!supported(recipe.modelIdentity)) fail('MODEL_MISMATCH', 'Local numerical model does not match the recipe');
  text(newRunId, 'new run id');
  if (newRunId === recipe.originalRunId) fail('INVALID_DATA', 'Recompute requires a new run id');
  return { originalRunId: recipe.originalRunId, result: calculateSync(recipe.config, newRunId) };
}
