import { TEACHING_LAYOUT_ID, supportedLabLayoutId, type LabConfig, type ReferenceSensor, type LabResult } from '../../shared/lab-contracts';
import { validateLabConfig, calculateLab, decodeRecordedNoise } from '../lab';
import { LAB_RECIPE_MODEL } from './lab-model';
import { ExportError, type ExportErrorCode } from './errors';
import type { AsyncSha256, ImportLimits } from './index';

/** Full asset bytes, including the RNQ1 header. Not a claim of measured V/Pa calibration. */
export const LAB_RECORDING_ASSET = Object.freeze({
  id: 'recorded-primary-rnq1-v1',
  sha256: 'c3bcc4ffcea96268032403eb01a0743f822701d6958bebc979752f93283d421a',
  bytes: 1280016, sampleRateHz: 2000, samplesPerChannel: 80000,
  channelOrder: Object.freeze([49, 53, 51, 55]), periodSamples: 79600, crossfadeSamples: 400,
  readerVersion: 'synchronized-cosine-overlap-v1', sourceGain: 2.7035289248832903,
  rawUnit: 'uncalibrated-V', generatedUnit: 'relative-amplitude',
});
type NormalizedConfig = LabConfig & { layoutId: string; sourceMode: 'recorded-noise' | 'shaped-noise'; levelOffsetDb: number };
type ModelIdentity = { id: string; hashEncoding: 'utf8-lf'; files: Record<string, string> };
type AssetIdentity = typeof LAB_RECORDING_ASSET;
export interface LabRecipeInput {
  mode: 'batch'; originSample: 0; config: LabConfig; originalRunId: string;
  source: 'computed-browser' | 'reference-replay';
}
export interface LabRecipe extends LabRecipeInput {
  format: 'rnc-recipe-v1'; modelSchema: 'lab-v3'; modelIdentity: ModelIdentity; sourceCommit: string;
  normalization: 'lab-legacy-defaults-v1'; normalizedConfig: NormalizedConfig;
  requestedSampleCount: number; asset: AssetIdentity | null;
}
export interface LabRecipeLimits extends ImportLimits { maxSignalBytes?: number }
export interface LabRecomputeContext {
  /** New run identity; original id remains a separate association. */
  runId: string;
  /** Required only for recorded-noise; no file/network I/O inside B. */
  resolveAsset?: (asset: AssetIdentity) => Promise<Uint8Array | null>;
  sha256?: AsyncSha256;
  limits?: LabRecipeLimits;
}
const MAX_RECIPE = 65536, MAX_SIGNALS = 64 * 1024 * 1024;
const required = ['schemaVersion', 'vehicle', 'sampleRateHz', 'durationSeconds', 'adaptationStartsSeconds', 'seed', 'taps',
  'stepSize', 'rncEnabled', 'speedKph', 'roadRoughness', 'treadRoughness', 'pressureKpa', 'temperatureC', 'references', 'speakerEnabled'];
const optional = ['layoutId', 'sourceMode', 'levelOffsetDb'];
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function fail(code: ExportErrorCode, message: string): never { throw new ExportError(code, message); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_DATA', 'Expected a non-array object');
  return value as Record<string, unknown>;
}
function shape(value: unknown, needed: readonly string[], allowed: readonly string[] = []): Record<string, unknown> {
  const record = object(value);
  if (needed.some(key => !Object.hasOwn(record, key)) || Object.keys(record).some(key => !needed.includes(key) && !allowed.includes(key))) fail('INVALID_DATA', 'Unexpected or missing fields');
  return record;
}
function text(value: unknown, label: string, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value) || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)
    || decoder.decode(encoder.encode(value)) !== value) fail('INVALID_DATA', `Invalid ${label}`);
  return value;
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail('INVALID_DATA', 'Invalid SHA-256');
  return value;
}
function budget(value: number | undefined, ceiling: number): number {
  if (value === undefined) return ceiling;
  if (!Number.isSafeInteger(value) || value < 1 || value > ceiling) fail('SIZE_LIMIT', 'Invalid byte budget');
  return value;
}
function readConfig(value: unknown): LabConfig {
  const record = shape(value, required, optional);
  if (record.schemaVersion !== 'lab-v3') fail('UNSUPPORTED_VERSION', 'Expected lab-v3');
  if (record.layoutId !== undefined) text(record.layoutId, 'layout id');
  if (record.levelOffsetDb !== undefined && typeof record.levelOffsetDb !== 'number') fail('INVALID_DATA', 'Invalid level offset');
  if (!Array.isArray(record.references) || record.references.length < 1 || record.references.length > 8) fail('INVALID_DATA', 'Expected 1–8 references');
  const references = record.references.map(value => {
    const reference = shape(value, ['id', 'name', 'position'], ['mountPart']);
    const id = text(reference.id, 'reference id'), name = text(reference.name, 'reference name', true);
    const mountPart = reference.mountPart === undefined ? undefined : text(reference.mountPart, 'mount part');
    if (!Array.isArray(reference.position) || reference.position.length !== 3 || !reference.position.every(v => typeof v === 'number' && Number.isFinite(v))) fail('INVALID_DATA', 'Invalid reference coordinates');
    const referenceCopy: ReferenceSensor = { id, name, position: [reference.position[0], reference.position[1], reference.position[2]],
      ...(mountPart === undefined ? {} : { mountPart }) };
    return referenceCopy;
  });
  if (!Array.isArray(record.speakerEnabled) || record.speakerEnabled.length !== 4) fail('INVALID_DATA', 'Expected four speaker switches');
  // Preserve optional absence; only the normalized copy gets the historical defaults.
  const config = Object.fromEntries([...required, ...optional].filter(key => record[key] !== undefined).map(key => [key, record[key]])) as unknown as LabConfig;
  config.references = references; config.speakerEnabled = [...record.speakerEnabled] as unknown as LabConfig['speakerEnabled'];
  try { validateLabConfig(config); } catch { fail('INVALID_DATA', 'Invalid lab batch configuration'); }
  return config;
}
function normalize(config: LabConfig): NormalizedConfig {
  return { ...structuredClone(config), layoutId: config.layoutId ?? TEACHING_LAYOUT_ID,
    sourceMode: config.sourceMode ?? 'shaped-noise', levelOffsetDb: config.levelOffsetDb ?? 0 };
}
function model(value: unknown): ModelIdentity {
  const identity = shape(value, ['id', 'hashEncoding', 'files']); text(identity.id, 'model id');
  if (identity.hashEncoding !== 'utf8-lf') fail('INVALID_DATA', 'Invalid model hash encoding');
  const files = shape(identity.files, Object.keys(LAB_RECIPE_MODEL.files));
  for (const digest of Object.values(files)) hash(digest);
  return structuredClone(identity) as ModelIdentity;
}
function supports(identity: ModelIdentity): boolean {
  return identity.id === LAB_RECIPE_MODEL.id && Object.entries(LAB_RECIPE_MODEL.files).every(([file, digest]) => identity.files[file] === digest);
}
function asset(value: unknown, sourceMode: NormalizedConfig['sourceMode']): AssetIdentity | null {
  if (sourceMode === 'shaped-noise') {
    if (value !== null) fail('INVALID_DATA', 'Shaped source must not request an asset');
    return null;
  }
  const record = shape(value, Object.keys(LAB_RECORDING_ASSET));
  for (const [key, expected] of Object.entries(LAB_RECORDING_ASSET)) {
    if (key === 'channelOrder') {
      if (!Array.isArray(record[key]) || record[key].length !== 4 || record[key].some((v, i) => v !== LAB_RECORDING_ASSET.channelOrder[i])) fail('INVALID_DATA', 'Invalid recording channel order');
    } else if (record[key] !== expected) fail('MODEL_MISMATCH', `Unsupported recording identity: ${key}`);
  }
  return structuredClone(LAB_RECORDING_ASSET);
}
function signalBudget(config: LabConfig, limits: LabRecipeLimits): number {
  const bytes = (20 + config.references.length) * config.durationSeconds * config.sampleRateHz * 4;
  if (!Number.isSafeInteger(bytes) || bytes > budget(limits.maxSignalBytes, MAX_SIGNALS)) fail('SIZE_LIMIT', 'Recompute signal storage exceeds byte budget');
  return bytes;
}
function validated(value: unknown, limits: LabRecipeLimits): LabRecipe {
  const record = object(value);
  if (record.format !== 'rnc-recipe-v1' || record.modelSchema !== 'lab-v3') fail('UNSUPPORTED_VERSION', 'Expected lab-v3 recipe version');
  shape(record, ['format', 'modelSchema', 'modelIdentity', 'sourceCommit', 'normalization', 'mode', 'originSample', 'config', 'normalizedConfig', 'originalRunId', 'source', 'requestedSampleCount', 'asset']);
  if (record.mode !== 'batch' || record.originSample !== 0) fail('UNSUPPORTED_MODE', 'Only a batch starting from sample zero is supported');
  if (typeof record.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/u.test(record.sourceCommit)) fail('INVALID_DATA', 'Invalid source commit');
  text(record.originalRunId, 'original run id');
  if (!['computed-browser', 'reference-replay'].includes(record.source as string)) fail('INVALID_DATA', 'Invalid source');
  if (record.normalization !== 'lab-legacy-defaults-v1') fail('UNSUPPORTED_VERSION', 'Unknown normalization rule');
  const config = readConfig(record.config), normalizedConfig = normalize(config), supplied = readConfig(record.normalizedConfig);
  if (JSON.stringify(supplied) !== JSON.stringify(readConfig(normalizedConfig))) fail('INVALID_DATA', 'Normalized configuration disagrees with original');
  if (record.requestedSampleCount !== config.durationSeconds * config.sampleRateHz) fail('INVALID_DATA', 'Invalid requested sample count');
  signalBudget(config, limits);
  return { ...record, config, normalizedConfig, modelIdentity: model(record.modelIdentity),
    asset: asset(record.asset, normalizedConfig.sourceMode) } as LabRecipe;
}
function serialize(value: LabRecipe, limits: LabRecipeLimits): string {
  const text = JSON.stringify(value), max = budget(limits.maxRecipeBytes, MAX_RECIPE);
  if (text.length > max || encoder.encode(text).length > max) fail('SIZE_LIMIT', 'Recipe exceeds UTF-8 byte budget');
  return text;
}
export function encodeLabRecipe(input: LabRecipeInput, context: { sourceCommit: string }, limits: LabRecipeLimits = {}): string {
  const record = shape(input, ['mode', 'originSample', 'config', 'originalRunId', 'source']);
  const config = readConfig(record.config), normalizedConfig = normalize(config);
  try { supportedLabLayoutId(normalizedConfig); } catch { fail('UNSUPPORTED_LAYOUT', 'Only teaching-fixed-v1 is supported'); }
  const recipe = validated({ ...record, config, normalizedConfig, format: 'rnc-recipe-v1', modelSchema: 'lab-v3',
    modelIdentity: structuredClone(LAB_RECIPE_MODEL), sourceCommit: context.sourceCommit, normalization: 'lab-legacy-defaults-v1',
    requestedSampleCount: config.durationSeconds * config.sampleRateHz,
    asset: normalizedConfig.sourceMode === 'recorded-noise' ? structuredClone(LAB_RECORDING_ASSET) : null }, limits);
  return serialize(recipe, limits);
}
/** Strict read-only parse: no source loading or computation. Unknown model/layout can be inspected, never recomputed. */
export function decodeLabRecipe(text: string, limits: LabRecipeLimits = {}): LabRecipe {
  if (typeof text !== 'string') fail('INVALID_FORMAT', 'Expected recipe JSON');
  const max = budget(limits.maxRecipeBytes, MAX_RECIPE);
  if (text.length > max || encoder.encode(text).length > max) fail('SIZE_LIMIT', 'Recipe exceeds UTF-8 byte budget');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { fail('INVALID_FORMAT', 'Invalid JSON recipe'); }
  return validated(parsed, limits);
}
/** Snapshot the recipe before any await. Only from-zero calculation; not a live checkpoint. */
export async function recomputeLabRecipeAsync(value: LabRecipe, context: LabRecomputeContext): Promise<{
  originalRunId: string; source: 'computed-browser'; status: 'completed' | 'diverged'; result: LabResult;
}> {
  const limits = { ...context.limits }, recipe = validated(value, limits);
  serialize(recipe, limits); // Bound in-memory recipes as well as file imports.
  if (!supports(recipe.modelIdentity)) fail('MODEL_MISMATCH', 'Local lab numerical model does not match');
  try { supportedLabLayoutId(recipe.normalizedConfig); } catch { fail('UNSUPPORTED_LAYOUT', 'Unknown layout cannot be recomputed'); }
  const runId = text(context.runId, 'new run id');
  if (runId === recipe.originalRunId) fail('INVALID_DATA', 'Recompute requires a new run id');
  let recording;
  if (recipe.asset) {
    const resolver = context.resolveAsset, sha256 = context.sha256;
    if (!resolver || !sha256) fail('MISSING_ASSET', 'Recorded mode requires an asset resolver and SHA-256 adapter');
    const provided = await resolver(structuredClone(recipe.asset));
    if (!(provided instanceof Uint8Array)) fail('MISSING_ASSET', 'Recording bytes are unavailable');
    if (provided.byteLength !== LAB_RECORDING_ASSET.bytes) fail('INVALID_DATA', 'Invalid recording byte length');
    const owned = Uint8Array.from(provided);
    if (hash(await sha256(owned)) !== LAB_RECORDING_ASSET.sha256) fail('INTEGRITY_MISMATCH', 'Recording SHA-256 mismatch');
    try { recording = decodeRecordedNoise(owned.buffer); } catch { fail('INVALID_DATA', 'Invalid recording data'); }
  }
  const result = calculateLab(recipe.normalizedConfig, runId, recording);
  if (result.sampleCount !== recipe.requestedSampleCount && !result.divergence) fail('INVALID_DATA', 'Engine returned an incomplete batch without divergence');
  return { originalRunId: recipe.originalRunId, source: 'computed-browser', status: result.divergence ? 'diverged' : 'completed', result };
}
