import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { defaultLabConfig } from '../../../../../src/shared/lab-contracts';
import { LAB_RECIPE_MODEL, LAB_RECORDING_ASSET } from '../../../../../src/team-b/export';
import { auditLabRecipe, matrixConfig, labSha256, labAssetBytes } from '../../../../../tests/helpers/lab-recipe-audit';

const destination = 'test-results/B2-003-lab-recipe/comparison.json';
if (existsSync(destination)) throw new Error('Use a new destination; do not overwrite prior evidence');
const cases = [];
for (const vehicle of ['ice', 'bev', 'hev', 'erev'] as const)
  for (const mode of ['shaped-noise', 'recorded-noise'] as const)
    for (const references of [1, 4, 8] as const)
      cases.push(await auditLabRecipe(matrixConfig(vehicle, mode, references), `${vehicle}-${mode}-${references}`));
cases.push(await auditLabRecipe({ ...defaultLabConfig(), sourceMode: 'shaped-noise', durationSeconds: 3, stepSize: 2 }, 'diverged'));
const hashes = Object.fromEntries(Object.keys(LAB_RECIPE_MODEL.files).map(path => [path,
  labSha256(new TextEncoder().encode(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')))]));
assert.deepEqual(hashes, LAB_RECIPE_MODEL.files);
const frozen = JSON.parse(readFileSync('docs/evidence/B/B2-003/async-api/source-integrity.json', 'utf8')).frozenFixtures;
for (const [path, digest] of Object.entries(frozen)) assert.equal(labSha256(new Uint8Array(readFileSync(path))), digest);
const recordingSha256 = labSha256(labAssetBytes());
assert.equal(recordingSha256, LAB_RECORDING_ASSET.sha256);
mkdirSync('test-results/B2-003-lab-recipe', { recursive: true });
const report = { role: 'B2', task: 'B2-003', identitySource: 'user-declared', executor: 'Codex',
  scope: 'lab-v3 teaching batch recipe deterministic replay; not an independent physical/numerical oracle',
  cases, caseCount: cases.length, totalSamplesCompared: cases.reduce((sum, c) => sum + c.samplesCompared, 0),
  numericalModel: LAB_RECIPE_MODEL, recordingSha256, frozenFixtures: frozen, frozenFixturesUnchanged: true };
writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ destination, caseCount: report.caseCount, totalSamplesCompared: report.totalSamplesCompared,
  divergence: cases.at(-1)?.divergence, frozenFixturesUnchanged: true }, null, 2));
