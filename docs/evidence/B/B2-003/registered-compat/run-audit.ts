// Role: B2; Task: B2-003; Executor: Codex; Identity-Source: user-declared.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { XPENG_LAB_LAYOUTS } from '../../../../../src/shared/lab-contracts';
import { LAB_RECIPE_MODEL } from '../../../../../src/team-b/export';
import { labSha256 } from '../../../../../tests/helpers/lab-recipe-audit';
import { auditRegisteredCase, registeredConfig, registeredCandidate } from '../../../../../tests/helpers/lab-registered-audit';

const folder = new URL('./', import.meta.url);
const sourceHash = (file: string) => labSha256(Buffer.from(readFileSync(file, 'utf8').replaceAll('\r\n', '\n')));
const provenance = JSON.parse(readFileSync(new URL('legacy-model-1.provenance.json', folder), 'utf8'));
const changedModelFiles = Object.entries(LAB_RECIPE_MODEL.files).filter(([file, hash]) => hash !== provenance.modelIdentity.files[file]).map(([file]) => file);
assert.deepEqual(changedModelFiles, ['src/shared/lab-contracts.ts', 'src/team-b/lab/index.ts', 'src/team-b/lab/path-analysis.ts',
  'src/team-b/lab/paths.ts', 'src/team-b/lab/stream.ts', 'src/team-b/lab/validation.ts']);
for (const [file, hash] of Object.entries(LAB_RECIPE_MODEL.files)) assert.equal(sourceHash(file), hash, file);
execFileSync('git', ['diff', '--exit-code', registeredCandidate, '--', ...Object.keys(LAB_RECIPE_MODEL.files)]);
const frozenFixtures: Record<string, string> = {};
for (const name of readdirSync('fixtures/reference').sort()) {
  const file = `fixtures/reference/${name}`, actual = labSha256(readFileSync(file));
  const historical = labSha256(execFileSync('git', ['show', `${provenance.sourceCommit}:${file}`], { maxBuffer: 32 * 1024 * 1024 }));
  assert.equal(actual, historical, file); frozenFixtures[file] = actual;
}
assert.equal(Object.keys(frozenFixtures).length, 8);
const cases = [];
for (const row of XPENG_LAB_LAYOUTS) for (const source of ['shaped-noise', 'recorded-noise'] as const) for (const count of [1, 4, 8] as const)
  cases.push(await auditRegisteredCase(registeredConfig(row.assetId, source, count), `${row.assetId}-${source}-${count}`));
writeFileSync(new URL('comparison.json', folder), JSON.stringify({
  role: 'B2', task: 'B2-003', executor: 'Codex', identitySource: 'user-declared', date: '2026-10-04',
  candidateBase: registeredCandidate, claimCommit: '68ef6f71c1fcce67fdf63013f99905eeb1c08f09',
  versionBinding: 'Source hashes below bind the working implementation; candidateBase is the caller-supplied numerical source base, not proof of this export build. Implementation commit is recorded in README/handoff after commit.',
  numericalModel: LAB_RECIPE_MODEL, changedModelFiles, numericalSourceUnchangedFromCandidate: true, frozenFixtures,
  sourceHashEncoding: 'utf8-lf', sourceHashes: Object.fromEntries([
    'src/team-b/export/lab-model.ts', 'src/team-b/export/lab-recipe.ts', 'src/team-b/export/lab-result.ts',
    'tests/analysis.test.ts', 'tests/helpers/lab-registered-tests.ts', 'tests/helpers/lab-registered-audit.ts',
    'docs/evidence/B/B2-003/registered-compat/run-audit.ts',
  ].map(file => [file, sourceHash(file)])),
  cases: cases.length, samplesPerComparison: cases.reduce((total, row) => total + row.samplesPerComparison, 0),
  comparisonKinds: ['recipe-recompute', 'sync-result-decode', 'async-result-decode'], results: cases,
}, null, 2) + '\n');
console.log(`${cases.length} registered cases; ${cases.reduce((n, row) => n + row.samplesPerComparison, 0)} Float32 values per comparison; 8 frozen fixtures unchanged.`);
