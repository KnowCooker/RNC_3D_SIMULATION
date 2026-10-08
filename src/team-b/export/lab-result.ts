import { ORDER, type Four } from '../../shared/contracts';
import { supportedLabLayoutId, type LabResult } from '../../shared/lab-contracts';
import { meanPower } from '../analysis';
import { LAB_WINDOW_SAMPLES } from '../lab';
import { encodeLabRecipe, decodeLabRecipe, type LabRecipe } from './lab-recipe';
import { LAB_RECIPE_MODEL } from './lab-model';
import { ExportError, type ExportErrorCode } from './errors';
import type { ExportContext, AsyncExportContext, Sha256, AsyncSha256, ImportLimits, ExportEstimate } from './index';

export interface LabBatchExportInput { mode: 'batch'; originSample: 0; source: LabRecipe['source']; result: LabResult }
type Scalar = number | { kind: 'nan' | 'positive-infinity' | 'negative-infinity' | 'negative-zero' };
type Kind = 'q' | 'x' | 'u' | 'd' | 'a' | 'e';
export interface LabChannel { signal: Kind; index: number; stableId: string; unit: string; payloadOffset: number; sampleCount: number; byteLength: number }
export interface LabResultManifest {
  format: 'rnc-result-v1'; modelSchema: 'lab-v3'; recipe: LabRecipe;
  run: { runId: string; mode: 'batch'; originSample: 0; source: LabRecipe['source']; sampleRateHz: 2000;
    requestedSampleCount: number; sampleCount: number; status: 'completed' | 'diverged';
    divergence: LabResult['divergence'] | null; computeMilliseconds: number };
  time: { startSeconds: 0; endSeconds: number; lastSampleSeconds: number | null; interval: 'half-open' };
  provenance: 'teaching-simulation-with-versioned-source'; channels: LabChannel[];
  rawMetrics: { startSample: number; endSample: number; weighting: 'Z'; measurement: 'unweighted-full-sampled-band';
    reductionDbByMic: Scalar[]; aggregateReductionDb: Scalar };
  integrity: { payloadBytes: number; sha256: string };
}
export interface LabMeasuredReduction {
  value: number | null; valid: boolean; reason: 'ok' | 'empty-window' | 'warming-up' | 'below-floor' | 'nonfinite' | 'raw-mismatch'; unit: 'dB';
}
export interface DecodedLabResult {
  result: LabResult; source: LabRecipe['source']; manifest: LabResultManifest; modelSupported: boolean; layoutSupported: boolean;
  /** Unknown model/layout has no verified summary. Raw metrics are preserved separately in result. */
  verifiedMetrics: { startSample: number; endSample: number; weighting: 'Z'; rawMetricsMatch: boolean;
    microphones: Four<LabMeasuredReduction>; aggregate: LabMeasuredReduction } | null;
}
const MAGIC = 'RNCRSLT1', HEADER = 16, MAX_FILE = 64 * 1024 * 1024, MAX_JSON = 65536;
const KINDS = ['q', 'x', 'u', 'd', 'a', 'e'] as const;
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function fail(code: ExportErrorCode, message: string): never { throw new ExportError(code, message); }
function keys(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_DATA', 'Expected a non-array object');
  const record = value as Record<string, unknown>;
  if (required.some(k => !Object.hasOwn(record, k)) || Object.keys(record).some(k => !required.includes(k) && !optional.includes(k))) fail('INVALID_DATA', 'Unexpected or missing fields');
  return record;
}
function equal(actual: unknown, expected: unknown, label: string) { if (actual !== expected) fail('INVALID_DATA', `Invalid ${label}`); }
function text(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)
    || decoder.decode(encoder.encode(value)) !== value) fail('INVALID_DATA', 'Invalid text');
  return value;
}
function digest(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail('INVALID_DATA', 'Invalid SHA-256');
  return value;
}
function limit(value: number | undefined, ceiling: number): number {
  if (value === undefined) return ceiling;
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) fail('SIZE_LIMIT', 'Invalid byte budget');
  return value;
}
function json(value: unknown, max: number): Uint8Array {
  const bytes = encoder.encode(JSON.stringify(value));
  if (bytes.length > max) fail('SIZE_LIMIT', 'Manifest exceeds byte budget');
  return bytes;
}
function parse(bytes: Uint8Array): unknown {
  try { return JSON.parse(decoder.decode(bytes)); } catch { fail('INVALID_FORMAT', 'Invalid UTF-8 JSON'); }
}
function wire(value: unknown): Scalar {
  if (typeof value !== 'number') fail('INVALID_DATA', 'Expected numerical metric');
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
function readMetrics(value: unknown, n: number): LabResult['metrics'] {
  const record = keys(value, ['startSample', 'endSample', 'weighting', 'measurement', 'reductionDbByMic', 'aggregateReductionDb']);
  equal(record.startSample, Math.max(0, n - 8000), 'metric window start'); equal(record.endSample, n, 'metric window end');
  equal(record.weighting, 'Z', 'metric weighting'); equal(record.measurement, 'unweighted-full-sampled-band', 'metric measurement');
  if (!Array.isArray(record.reductionDbByMic) || record.reductionDbByMic.length !== 4) fail('INVALID_DATA', 'Expected four metrics');
  return { reductionDbByMic: record.reductionDbByMic.map(number) as unknown as Four<number>, aggregateReductionDb: number(record.aggregateReductionDb) };
}
function descriptors(recipe: LabRecipe, n: number): LabChannel[] {
  let offset = 0;
  return KINDS.flatMap(signal => Array.from({ length: signal === 'x' ? recipe.config.references.length : 4 }, (_, index) => {
    const stableId = `${signal}:${signal === 'x' ? recipe.config.references[index].id : ORDER[index]}`;
    const unit = signal === 'q' ? recipe.normalizedConfig.sourceMode === 'recorded-noise' ? 'relative-amplitude' : 'm/s2-equivalent-wheel-excitation'
      : signal === 'x' ? 'm/s2' : signal === 'u' ? 'drive' : 'Pa';
    const descriptor = { signal, index, stableId, unit, payloadOffset: offset, sampleCount: n, byteLength: n * 4 };
    offset += n * 4; return descriptor;
  }));
}
function payloadBytes(recipe: LabRecipe, n: number): number {
  return (20 + recipe.config.references.length) * n * 4;
}
function validateRun(value: unknown, recipe: LabRecipe): LabResultManifest['run'] {
  const record = keys(value, ['runId', 'mode', 'originSample', 'source', 'sampleRateHz', 'requestedSampleCount', 'sampleCount', 'status', 'divergence', 'computeMilliseconds']);
  if (record.mode !== 'batch' || record.originSample !== 0) fail('UNSUPPORTED_MODE', 'Only from-zero batches are supported');
  equal(record.runId, recipe.originalRunId, 'run id'); equal(record.source, recipe.source, 'run source'); equal(record.sampleRateHz, 2000, 'sample rate');
  equal(record.requestedSampleCount, recipe.requestedSampleCount, 'requested samples');
  const n = record.sampleCount;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > recipe.requestedSampleCount) fail('INVALID_DATA', 'Invalid actual sample count');
  if (record.status === 'completed') {
    equal(n, recipe.requestedSampleCount, 'completed samples'); equal(record.divergence, null, 'completed divergence');
  } else if (record.status === 'diverged') {
    if (n >= recipe.requestedSampleCount) fail('INVALID_DATA', 'Divergence must have a shorter prefix');
    const detail = keys(record.divergence, ['sample', 'message']); equal(detail.sample, n, 'divergence sample'); text(detail.message);
  } else fail('INVALID_DATA', 'Unknown run status');
  if (typeof record.computeMilliseconds !== 'number' || !Number.isFinite(record.computeMilliseconds) || record.computeMilliseconds < 0) fail('INVALID_DATA', 'Invalid compute time');
  return structuredClone(record) as unknown as LabResultManifest['run'];
}
function makeManifest(input: LabBatchExportInput, context: Pick<ExportContext, 'sourceCommit'>): LabResultManifest {
  const wrapper = keys(input, ['mode', 'originSample', 'source', 'result']);
  if (wrapper.mode !== 'batch' || wrapper.originSample !== 0) fail('UNSUPPORTED_MODE', 'Only from-zero batches are supported');
  const record = keys(input.result, ['runId', 'config', 'sampleCount', 'computeMilliseconds', 'sources', 'signals', 'metrics'], ['divergence']);
  const recipe = decodeLabRecipe(encodeLabRecipe({ mode: 'batch', originSample: 0, config: input.result.config,
    originalRunId: input.result.runId, source: input.source }, context));
  const run = validateRun({ runId: record.runId, mode: wrapper.mode, originSample: wrapper.originSample, source: wrapper.source,
    sampleRateHz: 2000, requestedSampleCount: recipe.requestedSampleCount, sampleCount: record.sampleCount,
    status: record.divergence === undefined ? 'completed' : 'diverged', divergence: record.divergence ?? null, computeMilliseconds: record.computeMilliseconds }, recipe);
  const signals = keys(record.signals, ['x', 'u', 'd', 'a', 'e']);
  for (const kind of KINDS) {
    const channels = kind === 'q' ? record.sources : signals[kind], count = kind === 'x' ? recipe.config.references.length : 4;
    if (!Array.isArray(channels) || channels.length !== count) fail('INVALID_DATA', 'Invalid channel dimensions');
    for (const channel of channels) if (!(channel instanceof Float32Array) || channel.length !== run.sampleCount || !channel.every(Number.isFinite)) fail('INVALID_DATA', 'Expected finite Float32 batch channels');
  }
  const metrics = keys(record.metrics, ['reductionDbByMic', 'aggregateReductionDb']);
  if (!Array.isArray(metrics.reductionDbByMic) || metrics.reductionDbByMic.length !== 4) fail('INVALID_DATA', 'Expected four metrics');
  return { format: 'rnc-result-v1', modelSchema: 'lab-v3', recipe, run,
    time: { startSeconds: 0, endSeconds: run.sampleCount / 2000, lastSampleSeconds: run.sampleCount ? (run.sampleCount - 1) / 2000 : null, interval: 'half-open' },
    provenance: 'teaching-simulation-with-versioned-source', channels: descriptors(recipe, run.sampleCount),
    rawMetrics: { startSample: Math.max(0, run.sampleCount - 8000), endSample: run.sampleCount, weighting: 'Z', measurement: 'unweighted-full-sampled-band',
      reductionDbByMic: Array.from(metrics.reductionDbByMic, wire), aggregateReductionDb: wire(metrics.aggregateReductionDb) },
    integrity: { payloadBytes: payloadBytes(recipe, run.sampleCount), sha256: '0'.repeat(64) } };
}
function estimate(manifest: LabResultManifest, limits: ImportLimits): ExportEstimate {
  const m = json(manifest, limit(limits.maxManifestBytes, MAX_JSON)).length, p = manifest.integrity.payloadBytes;
  const size = HEADER + Math.ceil(m / 4) * 4 + p;
  if (size > limit(limits.maxContainerBytes, MAX_FILE)) fail('SIZE_LIMIT', 'Container exceeds byte budget');
  return { payloadBytes: p, manifestBytes: m, containerBytes: size, minimumResidentSignalBytes: p + size };
}
export function estimateLabExport(input: LabBatchExportInput, context: Pick<ExportContext, 'sourceCommit'>, limits: ImportLimits = {}): ExportEstimate {
  return estimate(makeManifest(input, context), limits);
}
function prepare(input: LabBatchExportInput, context: Pick<ExportContext, 'sourceCommit'>, limits: ImportLimits) {
  const manifest = makeManifest(input, context), size = estimate(manifest, limits);
  const bytes = new Uint8Array(size.containerBytes), view = new DataView(bytes.buffer), start = size.containerBytes - size.payloadBytes;
  for (const channel of manifest.channels) {
    const signal = channel.signal === 'q' ? input.result.sources[channel.index] : input.result.signals[channel.signal][channel.index];
    for (let n = 0; n < channel.sampleCount; n++) view.setFloat32(start + channel.payloadOffset + n * 4, signal[n], true);
  }
  return { manifest, size, bytes, start, limits };
}
function finish(prepared: ReturnType<typeof prepare>, hash: string): Uint8Array {
  const { manifest, size, bytes, limits } = prepared;
  manifest.integrity.sha256 = digest(hash);
  const metadata = json(manifest, limit(limits.maxManifestBytes, MAX_JSON)); equal(metadata.length, size.manifestBytes, 'captured manifest size');
  bytes.set(encoder.encode(MAGIC)); const view = new DataView(bytes.buffer);
  view.setUint32(8, metadata.length, true); view.setUint32(12, size.payloadBytes, true); bytes.set(metadata, HEADER); return bytes;
}
export function encodeLabResult(input: LabBatchExportInput, context: ExportContext, limits: ImportLimits = {}): Uint8Array {
  const prepared = prepare(input, context, { ...limits }); return finish(prepared, context.sha256(prepared.bytes.subarray(prepared.start)));
}
export async function encodeLabResultAsync(input: LabBatchExportInput, context: AsyncExportContext, limits: ImportLimits = {}): Promise<Uint8Array> {
  const prepared = prepare(input, context, { ...limits }); return finish(prepared, await context.sha256(prepared.bytes.subarray(prepared.start)));
}
function header(bytes: Uint8Array, limits: ImportLimits) {
  if (!(bytes instanceof Uint8Array)) fail('INVALID_FORMAT', 'Expected container bytes');
  if (bytes.length > limit(limits.maxContainerBytes, MAX_FILE)) fail('SIZE_LIMIT', 'Container exceeds byte budget');
  if (bytes.length < HEADER || Array.from(MAGIC).some((v, i) => bytes[i] !== v.charCodeAt(0))) fail('INVALID_FORMAT', 'Invalid container header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), m = view.getUint32(8, true), p = view.getUint32(12, true), start = HEADER + Math.ceil(m / 4) * 4;
  if (m > limit(limits.maxManifestBytes, MAX_JSON)) fail('SIZE_LIMIT', 'Manifest exceeds byte budget');
  if (!m || p % 4 || start + p !== bytes.length) fail('INVALID_FORMAT', 'Invalid container lengths');
  for (let i = HEADER + m; i < start; i++) if (bytes[i] !== 0) fail('INVALID_FORMAT', 'Nonzero alignment padding');
  return { view, m, p, start };
}
function inspect(bytes: Uint8Array, limits: ImportLimits) {
  const { view, m, p, start } = header(bytes, limits);
  const record = keys(parse(bytes.subarray(HEADER, HEADER + m)), ['format', 'modelSchema', 'recipe', 'run', 'time', 'provenance', 'channels', 'rawMetrics', 'integrity']);
  if (record.format !== 'rnc-result-v1' || record.modelSchema !== 'lab-v3') fail('UNSUPPORTED_VERSION', 'Expected lab-v3 result');
  const recipe = decodeLabRecipe(JSON.stringify(record.recipe));
  const run = validateRun(record.run, recipe), expected = descriptors(recipe, run.sampleCount);
  const time = keys(record.time, ['startSeconds', 'endSeconds', 'lastSampleSeconds', 'interval']);
  equal(time.startSeconds, 0, 'time start'); equal(time.endSeconds, run.sampleCount / 2000, 'time end');
  equal(time.lastSampleSeconds, run.sampleCount ? (run.sampleCount - 1) / 2000 : null, 'last sample time'); equal(time.interval, 'half-open', 'time interval');
  equal(record.provenance, 'teaching-simulation-with-versioned-source', 'provenance');
  if (!Array.isArray(record.channels) || record.channels.length !== expected.length) fail('INVALID_DATA', 'Invalid channel count');
  expected.forEach((channel, i) => { const actual = keys((record.channels as unknown[])[i], Object.keys(channel));
    for (const [key, value] of Object.entries(channel)) equal(actual[key], value, `channel ${i}/${key}`); });
  equal(p, payloadBytes(recipe, run.sampleCount), 'signal payload size');
  const integrity = keys(record.integrity, ['payloadBytes', 'sha256']); equal(integrity.payloadBytes, p, 'integrity bytes');
  const hash = digest(integrity.sha256), metrics = readMetrics(record.rawMetrics, run.sampleCount);
  for (let offset = start; offset < bytes.length; offset += 4) if (!Number.isFinite(view.getFloat32(offset, true))) fail('INVALID_DATA', 'Nonfinite payload sample');
  return { view, start, hash, recipe, run, metrics, record };
}
function verified(result: LabResult): NonNullable<DecodedLabResult['verifiedMetrics']> {
  const n = result.sampleCount, start = Math.max(0, n - 8000);
  const dp = result.signals.d.map(s => n ? meanPower(s, start, n) : 0), ep = result.signals.e.map(s => n ? meanPower(s, start, n) : 0);
  // Match the registered lab raw metric's legacy floor; power itself comes from B's shared analysis.
  const legacy = (d: number, e: number) => d <= 1e-20 ? 0 : 10 * Math.log10(d / Math.max(1e-20, e));
  const same = (a: number, b: number) => Object.is(a, b) || (Number.isFinite(a) && Number.isFinite(b) && a === b);
  const measure = (d: number, e: number, raw: number): LabMeasuredReduction => {
    const derived = legacy(d, e), reason = !n ? 'empty-window' : n < LAB_WINDOW_SAMPLES ? 'warming-up' : !Number.isFinite(d) || !Number.isFinite(e) || !Number.isFinite(raw) || !Number.isFinite(derived) ? 'nonfinite'
      : d <= 1e-20 || e <= 1e-20 ? 'below-floor' : !same(raw, derived) ? 'raw-mismatch' : 'ok';
    return { value: reason === 'ok' ? derived : null, valid: reason === 'ok', reason, unit: 'dB' };
  };
  const d = dp.reduce((a, b) => a + b), e = ep.reduce((a, b) => a + b);
  return { startSample: start, endSample: n, weighting: 'Z',
    rawMetricsMatch: dp.every((d, i) => same(result.metrics.reductionDbByMic[i], legacy(d, ep[i]))) && same(result.metrics.aggregateReductionDb, legacy(d, e)),
    microphones: dp.map((d, i) => measure(d, ep[i], result.metrics.reductionDbByMic[i])) as unknown as Four<LabMeasuredReduction>,
    aggregate: measure(d, e, result.metrics.aggregateReductionDb) };
}
function restore(inspected: ReturnType<typeof inspect>, hash: string): DecodedLabResult {
  const { view, start, recipe, run, metrics, record } = inspected;
  if (inspected.hash !== digest(hash)) fail('INTEGRITY_MISMATCH', 'Payload SHA-256 mismatch');
  const collected: Record<Kind, Float32Array[]> = { q: [], x: [], u: [], d: [], a: [], e: [] };
  for (const channel of descriptors(recipe, run.sampleCount)) {
    const signal = new Float32Array(channel.sampleCount);
    for (let n = 0; n < signal.length; n++) signal[n] = view.getFloat32(start + channel.payloadOffset + n * 4, true);
    collected[channel.signal].push(signal);
  }
  const { q, ...signals } = collected;
  const result: LabResult = { runId: run.runId, config: recipe.config, sampleCount: run.sampleCount, computeMilliseconds: run.computeMilliseconds,
    sources: q as unknown as Four<Float32Array>, signals: signals as unknown as LabResult['signals'], metrics,
    ...(run.divergence ? { divergence: run.divergence } : {}) };
  const modelSupported = recipe.modelIdentity.id === LAB_RECIPE_MODEL.id && Object.entries(LAB_RECIPE_MODEL.files).every(([p, h]) => recipe.modelIdentity.files[p] === h);
  let layoutSupported = true; try { supportedLabLayoutId(recipe.normalizedConfig); } catch { layoutSupported = false; }
  return { result, source: recipe.source, manifest: { ...record, recipe, run } as unknown as LabResultManifest,
    modelSupported, layoutSupported, verifiedMetrics: modelSupported && layoutSupported ? verified(result) : null };
}
export function decodeLabResult(bytes: Uint8Array, sha256: Sha256, limits: ImportLimits = {}): DecodedLabResult {
  const inspected = inspect(bytes, limits); return restore(inspected, sha256(bytes.subarray(inspected.start)));
}
export async function decodeLabResultAsync(bytes: Uint8Array, sha256: AsyncSha256, limits: ImportLimits = {}): Promise<DecodedLabResult> {
  const budgets = { ...limits }; header(bytes, budgets);
  const snapshot = Uint8Array.from(bytes), inspected = inspect(snapshot, budgets);
  return restore(inspected, await sha256(snapshot.subarray(inspected.start)));
}
