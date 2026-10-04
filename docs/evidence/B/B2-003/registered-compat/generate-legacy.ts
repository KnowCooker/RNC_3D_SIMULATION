// Role: B2; Task: B2-003; Executor: Codex; Identity-Source: user-declared.
// Run only against the historical git archive described in README.md.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const snapshot = resolve('output/B2-003-registered-legacy');
const load = (file: string) => import(pathToFileURL(resolve(snapshot, file)).href);
const { defaultLabConfig } = await load('src/shared/lab-contracts.ts');
const { calculateLab, decodeRecordedNoise } = await load('src/team-b/lab/index.ts');
const { LAB_RECIPE_MODEL, encodeLabRecipe, decodeLabRecipe, encodeLabResult, decodeLabResult } = await load('src/team-b/export/index.ts');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
assert.equal(LAB_RECIPE_MODEL.id, 'lab-v3-teaching-batch-recipe-1');
for (const [file, hash] of Object.entries(LAB_RECIPE_MODEL.files)) {
  assert.equal(sha256(Buffer.from(readFileSync(resolve(snapshot, file), 'utf8').replaceAll('\r\n', '\n'))), hash, file);
}
const sourceCommit = 'b968d926ce343cb4568e00bdb14da4e87bdd6fc6';
const config = { ...defaultLabConfig(), durationSeconds: 1, taps: 16, sourceMode: 'recorded-noise' };
delete config.layoutId; delete config.levelOffsetDb;
const asset = new Uint8Array(readFileSync(resolve(snapshot, 'src/team-b/lab/data/recorded-primary.f32')));
const result = calculateLab(config, 'historical-model-1', decodeRecordedNoise(asset.buffer));
const recipe = encodeLabRecipe({ mode: 'batch', originSample: 0, config,
  originalRunId: result.runId, source: 'computed-browser' }, { sourceCommit });
const bytes = encodeLabResult({ mode: 'batch', originSample: 0, result, source: 'computed-browser' }, { sourceCommit, sha256 });
assert.equal(decodeLabRecipe(recipe).modelIdentity.id, LAB_RECIPE_MODEL.id);
assert.equal(decodeLabResult(bytes, sha256).modelSupported, true);
const destination = new URL('./', import.meta.url);
writeFileSync(new URL('legacy-model-1.recipe.json', destination), recipe);
writeFileSync(new URL('legacy-model-1.rncrs', destination), bytes);
writeFileSync(new URL('legacy-model-1.provenance.json', destination), JSON.stringify({
  role: 'B2', task: 'B2-003', executor: 'Codex', identitySource: 'user-declared', date: '2026-10-04',
  sourceCommit, modelIdentity: LAB_RECIPE_MODEL,
  files: {
    'legacy-model-1.recipe.json': { bytes: Buffer.byteLength(recipe), sha256: sha256(Buffer.from(recipe)) },
    'legacy-model-1.rncrs': { bytes: bytes.length, sha256: sha256(bytes) },
  },
}, null, 2) + '\n');
console.log('Historical model-1 recipe/result generated and verified using archived source, not current exports.');
