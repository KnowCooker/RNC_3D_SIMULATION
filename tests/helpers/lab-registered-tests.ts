import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { XPENG_LAB_LAYOUTS } from '../../src/shared/lab-contracts';
import { calculateLab } from '../../src/team-b/lab';
import { LAB_RECIPE_MODEL, ExportError, encodeLabRecipe, decodeLabRecipe, recomputeLabRecipeAsync,
  encodeLabResult, decodeLabResult, decodeLabResultAsync } from '../../src/team-b/export';
import { labInput, labSha256, assertLabEqual } from './lab-recipe-audit';
import { labResultInput } from './lab-result-audit';
import { auditRegisteredCase, registeredCandidate, registeredConfig, rewriteLabManifest } from './lab-registered-audit';

const context = { sourceCommit: registeredCandidate, sha256: labSha256 };
const fails = (code: string) => (error: unknown) => error instanceof ExportError && error.code === code;
for (const layout of XPENG_LAB_LAYOUTS) test(`B2-003 registered export: ${layout.id}, both sources, 1/4/8 references`, async () => {
  for (const source of ['shaped-noise', 'recorded-noise'] as const) for (const count of [1, 4, 8] as const)
    await auditRegisteredCase(registeredConfig(layout.assetId, source, count), `${layout.assetId}-${source}-${count}`);
});

test('B2-003 registered export: actual historical model-1 files remain read-only and cannot load assets', async () => {
  const folder = new URL('../../docs/evidence/B/B2-003/registered-compat/', import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL('legacy-model-1.provenance.json', folder), 'utf8'));
  assert.equal(provenance.sourceCommit, 'b968d926ce343cb4568e00bdb14da4e87bdd6fc6');
  for (const [file, entry] of Object.entries(provenance.files) as [string, { bytes: number; sha256: string }][]) {
    const bytes = readFileSync(new URL(file, folder)); assert.equal(bytes.length, entry.bytes); assert.equal(labSha256(bytes), entry.sha256);
  }
  const recipe = decodeLabRecipe(readFileSync(new URL('legacy-model-1.recipe.json', folder), 'utf8'));
  assert.deepEqual(recipe.modelIdentity, provenance.modelIdentity);
  assert.equal(recipe.modelIdentity.id, 'lab-v3-teaching-batch-recipe-1'); assert.notEqual(recipe.modelIdentity.id, LAB_RECIPE_MODEL.id);
  assert.equal(Object.hasOwn(recipe.config, 'layoutId'), false); assert.equal(recipe.normalizedConfig.layoutId, 'teaching-fixed-v1');
  const bytes = new Uint8Array(readFileSync(new URL('legacy-model-1.rncrs', folder)));
  const sync = decodeLabResult(bytes, labSha256), asyncResult = await decodeLabResultAsync(bytes, async b => labSha256(b));
  for (const imported of [sync, asyncResult]) {
    assert.equal(imported.modelSupported, false); assert.equal(imported.layoutSupported, true); assert.equal(imported.verifiedMetrics, null);
    assert.deepEqual(imported.manifest.recipe, recipe); assert.equal(imported.result.runId, recipe.originalRunId);
    assert.equal(imported.result.config.layoutId, undefined); assert.equal(imported.result.sampleCount, 2000);
  }
  assertLabEqual(asyncResult.result, sync.result);
  let calls = 0;
  const options = { runId: 'new', resolveAsset: async () => { calls++; return null; }, sha256: async () => { calls++; return ''; } };
  await assert.rejects(recomputeLabRecipeAsync(recipe, options), fails('MODEL_MISMATCH'));
  await assert.rejects(recomputeLabRecipeAsync(sync.manifest.recipe, options), fails('MODEL_MISMATCH'));
  assert.equal(calls, 0);
});

test('B2-003 registered export: unknown, asset aliases and powertrain mismatches parse without enabling execution', async () => {
  const good = registeredConfig('xpeng-p7plus', 'shaped-noise', 4);
  const result = calculateLab(good, 'known-layout'), bytes = encodeLabResult(labResultInput(result), context);
  for (const overrides of [{ layoutId: 'unknown' }, { layoutId: 'xpeng-p7plus' }, { vehicle: 'erev' as const }]) {
    const invalid = { ...good, ...overrides };
    assert.throws(() => encodeLabRecipe(labInput(invalid), context), fails('UNSUPPORTED_LAYOUT'));
    assert.throws(() => encodeLabResult(labResultInput({ ...result, config: invalid }), context), fails('UNSUPPORTED_LAYOUT'));
    const imported = decodeLabResult(rewriteLabManifest(bytes, m => {
      Object.assign(m.recipe.config, overrides); Object.assign(m.recipe.normalizedConfig, overrides);
    }), labSha256);
    assert.deepEqual(imported.result.config, invalid); assert.equal(imported.modelSupported, true);
    assert.equal(imported.layoutSupported, false); assert.equal(imported.verifiedMetrics, null);
    const recipe = imported.manifest.recipe;
    // Exercise the recorded branch, proving rejection occurs before resolver/hash.
    const recorded = JSON.parse(encodeLabRecipe(labInput({ ...good, sourceMode: 'recorded-noise' }), context));
    Object.assign(recorded.config, overrides); Object.assign(recorded.normalizedConfig, overrides);
    let calls = 0;
    for (const value of [recipe, decodeLabRecipe(JSON.stringify(recorded))]) {
      await assert.rejects(recomputeLabRecipeAsync(value, { runId: 'new',
        resolveAsset: async () => { calls++; return null; }, sha256: async () => { calls++; return ''; } }), fails('UNSUPPORTED_LAYOUT'));
    }
    assert.equal(calls, 0);
  }
});

test('B2-003 registered export: unsupported layouts still reject invalid config and normalization before hashing', () => {
  const config = registeredConfig('xpeng-x9', 'shaped-noise', 4);
  const result = calculateLab(config, 'hostile-layout'), bytes = encodeLabResult(labResultInput(result), context);
  for (const mutate of [
    (c: any) => { c.seed = 0; }, (c: any) => { c.durationSeconds = 301; },
    (c: any) => { c.sampleRateHz = 44100; }, (c: any) => { c.stepSize = -1; },
    (c: any) => { c.vehicle = 'unsupported'; }, (c: any) => { c.sourceMode = 'random-fallback'; },
    (c: any) => { c.speakerEnabled[0] = 1; }, (c: any) => { c.references[0].position[0] = 9; },
    (c: any) => { c.references[1].id = c.references[0].id; }, (c: any) => { c.script = 'run'; },
  ]) {
    let hashes = 0;
    const hostile = rewriteLabManifest(bytes, m => {
      m.recipe.config.layoutId = m.recipe.normalizedConfig.layoutId = 'unknown';
      mutate(m.recipe.config); mutate(m.recipe.normalizedConfig);
    });
    assert.throws(() => decodeLabResult(hostile, () => { hashes++; return ''; }), fails('INVALID_DATA'));
    assert.equal(hashes, 0);
  }
  assert.throws(() => decodeLabResult(rewriteLabManifest(bytes, m => { m.recipe.normalizedConfig.layoutId = 'unknown'; }), labSha256), fails('INVALID_DATA'));
});
