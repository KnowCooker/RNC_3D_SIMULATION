import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultLabConfig, type LabConfig } from '../../src/shared/lab-contracts';
import { calculateLab } from '../../src/team-b/lab';
import { encodeLabRecipe, decodeLabRecipe, recomputeLabRecipeAsync, LAB_RECIPE_MODEL, LAB_RECORDING_ASSET, ExportError } from '../../src/team-b/export';
import { auditLabRecipe, matrixConfig, labInput, labAssetBytes, labSha256, labSourceCommit, assertLabEqual } from './lab-recipe-audit';

const context = { sourceCommit: labSourceCommit };
const makeRecipe = (config: LabConfig = { ...defaultLabConfig(), durationSeconds: 2, taps: 32 }) => decodeLabRecipe(encodeLabRecipe(labInput(config), context));
const fails = (code: string) => (error: unknown) => error instanceof ExportError && error.code === code;
const recompute = (recipe = makeRecipe()) => recomputeLabRecipeAsync(recipe, { runId: 'new' });
for (const vehicle of ['ice', 'bev', 'hev', 'erev'] as const) test(`B2-003 lab recipe: ${vehicle}, both sources and 1/4/8 reference topology`, async () => {
  for (const source of ['shaped-noise', 'recorded-noise'] as const) for (const references of [1, 4, 8] as const)
    await auditLabRecipe(matrixConfig(vehicle, source, references), `${vehicle}-${source}-${references}`);
});
test('B2-003 lab recipe: model/source/recording identities match current files', () => {
  for (const [file, expected] of Object.entries(LAB_RECIPE_MODEL.files))
    assert.equal(labSha256(Buffer.from(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n'))), expected, file);
  const asset = labAssetBytes(); assert.equal(asset.length, LAB_RECORDING_ASSET.bytes); assert.equal(labSha256(asset), LAB_RECORDING_ASSET.sha256);
});
test('B2-003 lab recipe: preserve legacy absence and normalize shaped/layout/offset defaults explicitly', async () => {
  const config = { ...defaultLabConfig(), durationSeconds: 2, taps: 32 };
  delete config.layoutId; delete config.sourceMode; delete config.levelOffsetDb;
  const before = structuredClone(config), recipe = makeRecipe(config);
  assert.deepEqual(recipe.config, before);
  assert.equal(Object.hasOwn(recipe.config, 'sourceMode'), false); assert.equal(Object.hasOwn(recipe.config, 'layoutId'), false);
  assert.equal(recipe.normalizedConfig.sourceMode, 'shaped-noise'); assert.equal(recipe.normalizedConfig.layoutId, 'teaching-fixed-v1');
  assert.equal(recipe.normalizedConfig.levelOffsetDb, 0); assert.equal(recipe.asset, null);
  assertLabEqual((await recompute(recipe)).result, calculateLab(config, 'comparison'));
  assert.deepEqual(config, before);
});
test('B2-003 lab recipe: RNC off, zero step, speaker disable, seed/taps changes and negative gains retain exact behavior', async () => {
  for (const config of [
    { ...defaultLabConfig(), durationSeconds: 2, taps: 16, rncEnabled: false },
    { ...defaultLabConfig(), durationSeconds: 2, taps: 128, stepSize: 0, seed: 47 },
    { ...defaultLabConfig(), durationSeconds: 2, speakerEnabled: [false, true, false, true] as const, seed: 29 },
    { ...defaultLabConfig(), durationSeconds: 2, speakerEnabled: [false, false, false, false] as const },
  ]) await auditLabRecipe(config, `switches-${config.taps}-${config.seed}-${config.speakerEnabled.join('')}`);
});
test('B2-003 lab recipe: actual divergence is a finite prefix, never padded or called complete', async () => {
  const report = await auditLabRecipe({ ...defaultLabConfig(), durationSeconds: 3, sourceMode: 'shaped-noise', stepSize: 2 }, 'divergence');
  assert.equal(report.status, 'diverged'); assert.ok(report.actualSamples > 0 && report.actualSamples < report.requestedSamples);
  assert.equal(report.divergence!.sample, report.actualSamples);
});
test('B2-003 lab recipe: unknown layouts cannot encode/recompute and unknown model is only parsed', async () => {
  const unknown = { ...defaultLabConfig(), layoutId: 'showroom-ice-v1' };
  assert.throws(() => encodeLabRecipe(labInput(unknown), context), fails('UNSUPPORTED_LAYOUT'));
  const recipe = makeRecipe(); recipe.config.layoutId = 'unknown'; recipe.normalizedConfig.layoutId = 'unknown';
  const parsed = decodeLabRecipe(JSON.stringify(recipe));
  let calls = 0;
  await assert.rejects(recomputeLabRecipeAsync(parsed, { runId: 'new', resolveAsset: async () => { calls++; return null; } }), fails('UNSUPPORTED_LAYOUT'));
  assert.equal(calls, 0);
  const model = makeRecipe(); model.modelIdentity.files['src/team-b/lab/index.ts'] = '0'.repeat(64);
  await assert.rejects(recompute(decodeLabRecipe(JSON.stringify(model))), fails('MODEL_MISMATCH'));
  assert.equal(LAB_RECIPE_MODEL.files['src/team-b/lab/index.ts'].length, 64);
});
test('B2-003 lab recipe: recording asset is mandatory, full-byte hash checked, never random fallback', async () => {
  const recipe = makeRecipe({ ...defaultLabConfig(), durationSeconds: 1, sourceMode: 'recorded-noise' });
  await assert.rejects(recompute(recipe), fails('MISSING_ASSET'));
  await assert.rejects(recomputeLabRecipeAsync(recipe, { runId: 'new', sha256: async () => '0'.repeat(64), resolveAsset: async () => null }), fails('MISSING_ASSET'));
  await assert.rejects(recomputeLabRecipeAsync(recipe, { runId: 'new', sha256: async () => '0'.repeat(64), resolveAsset: async () => new Uint8Array(1) }), fails('INVALID_DATA'));
  const changed = labAssetBytes(); changed[0] ^= 1;
  await assert.rejects(recomputeLabRecipeAsync(recipe, { runId: 'new', sha256: async bytes => labSha256(bytes), resolveAsset: async () => changed }), fails('INTEGRITY_MISMATCH'));
  const badIdentity = structuredClone(recipe); (badIdentity.asset as any).channelOrder.reverse();
  assert.throws(() => decodeLabRecipe(JSON.stringify(badIdentity)), fails('INVALID_DATA'));
});
test('B2-003 lab recipe: snapshot config/id/budget and asset before await, propagate resolver/hash failures', async () => {
  const config = { ...defaultLabConfig(), durationSeconds: 1, sourceMode: 'recorded-noise' as const, taps: 32 };
  const recipe = makeRecipe(config), recording = labAssetBytes();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const limits = { maxSignalBytes: 64 * 1024 * 1024 };
  let hashCalled!: () => void; const started = new Promise<void>(resolve => { hashCalled = resolve; });
  const pending = recomputeLabRecipeAsync(recipe, { runId: 'new', limits, resolveAsset: async () => recording,
    sha256: async bytes => { hashCalled(); await gate; return labSha256(bytes); } });
  await started;
  const savedRecipe = makeRecipe(config);
  recipe.normalizedConfig.seed = 29; recipe.config.seed = 29; recipe.originalRunId = 'changed';
  recording.fill(0); limits.maxSignalBytes = 1; release();
  const actual = await pending;
  const expected = await recomputeLabRecipeAsync(savedRecipe, { runId: 'comparison', resolveAsset: async () => labAssetBytes(), sha256: async bytes => labSha256(bytes) });
  assertLabEqual(actual.result, expected.result); assert.equal(actual.originalRunId, 'original');
  const sentinel = new Error('asset resolver failed');
  await assert.rejects(recomputeLabRecipeAsync(savedRecipe, { runId: 'new', sha256: async () => '', resolveAsset: async () => { throw sentinel; } }), error => error === sentinel);
  await assert.rejects(recomputeLabRecipeAsync(savedRecipe, { runId: 'new', resolveAsset: async () => labAssetBytes(), sha256: async () => { throw sentinel; } }), error => error === sentinel);
});
test('B2-003 lab recipe: reject bad config, dimensions, identities, extra scripts, live mode and altered defaults', async () => {
  const valid = makeRecipe();
  for (const mutate of [
    (r: any) => { r.config.taps = 15; }, (r: any) => { r.config.references[0].position = [0, 0]; },
    (r: any) => { r.config.references[1].id = r.config.references[0].id; }, (r: any) => { r.config.references[0].mountPart = null; },
    (r: any) => { r.config.speakerEnabled = []; }, (r: any) => { r.normalizedConfig.sourceMode = 'recorded-noise'; },
    (r: any) => { r.sourceCommit = 'invalid'; }, (r: any) => { r.source = 'measured'; },
    (r: any) => { r.script = 'run arbitrary code'; }, (r: any) => { r.config.extra = 1; },
    (r: any) => { delete r.config.vehicle; }, (r: any) => { r.requestedSampleCount = 999; },
    (r: any) => { r.config.levelOffsetDb = null; }, (r: any) => { r.config.references[0].id = '\ud800'; },
  ]) {
    const changed = structuredClone(valid); mutate(changed);
    assert.throws(() => decodeLabRecipe(JSON.stringify(changed)), error => error instanceof ExportError);
  }
  assert.throws(() => decodeLabRecipe('{'), fails('INVALID_FORMAT'));
  assert.throws(() => decodeLabRecipe(JSON.stringify({ ...valid, modelSchema: 'demo-v2' })), fails('UNSUPPORTED_VERSION'));
  await assert.rejects(recomputeLabRecipeAsync({ ...valid, mode: 'live' } as any, { runId: 'new' }), fails('UNSUPPORTED_MODE'));
  await assert.rejects(recomputeLabRecipeAsync(valid, { runId: valid.originalRunId }), fails('INVALID_DATA'));
});
test('B2-003 lab recipe: byte and recompute budgets reject before asset loading or calculation', async () => {
  const recipe = makeRecipe({ ...defaultLabConfig(), durationSeconds: 2, sourceMode: 'recorded-noise' });
  let calls = 0;
  await assert.rejects(recomputeLabRecipeAsync(recipe, { runId: 'new', limits: { maxSignalBytes: 1 }, resolveAsset: async () => { calls++; return labAssetBytes(); } }), fails('SIZE_LIMIT'));
  assert.equal(calls, 0);
  assert.throws(() => decodeLabRecipe(JSON.stringify(recipe), { maxRecipeBytes: 1 }), fails('SIZE_LIMIT'));
  assert.throws(() => decodeLabRecipe(JSON.stringify(recipe), { maxSignalBytes: Infinity }), fails('SIZE_LIMIT'));
  const config = { ...defaultLabConfig(), durationSeconds: 2 }; config.references[0].name = '原'.repeat(256);
  const text = encodeLabRecipe(labInput(config), context);
  assert.throws(() => decodeLabRecipe(text, { maxRecipeBytes: text.length }), fails('SIZE_LIMIT'));
});
