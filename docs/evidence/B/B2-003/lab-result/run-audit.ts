import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaultLabConfig } from '../../../../../src/shared/lab-contracts';
import { LAB_RECIPE_MODEL, LAB_RECORDING_ASSET } from '../../../../../src/team-b/export';
import { matrixConfig, labSha256, labAssetBytes } from '../../../../../tests/helpers/lab-recipe-audit';
import { auditLabResult } from '../../../../../tests/helpers/lab-result-audit';
const destination = process.argv[2] ?? 'test-results/B2-003-lab-result/comparison.json';
if (!/^test-results\/B2-003-lab-result(?:-[a-z0-9-]+)?\/comparison\.json$/u.test(destination)) throw new Error('Use an isolated B2-003-lab-result test-results destination');
if (existsSync(destination)) throw new Error('Use a fresh checkout; existing evidence must not be overwritten');
const cases = [];
for (const vehicle of ['ice', 'bev', 'hev', 'erev'] as const)
  for (const mode of ['shaped-noise', 'recorded-noise'] as const)
    for (const references of [1, 4, 8] as const) cases.push(await auditLabResult(matrixConfig(vehicle, mode, references), `${vehicle}-${mode}-${references}-replay`));
const legacy = { ...defaultLabConfig(), durationSeconds: 1, stepSize: 0 }; delete legacy.layoutId;
for (const [name, config] of [
  ['legacy-mu0', legacy], ['off', { ...defaultLabConfig(), durationSeconds: 1, rncEnabled: false }],
  ['partial', { ...defaultLabConfig(), durationSeconds: 1, speakerEnabled: [false, true, false, true] as [boolean, boolean, boolean, boolean] }],
  ['diverged', { ...defaultLabConfig(), durationSeconds: 3, stepSize: 2 }],
  ['four-second-window', { ...defaultLabConfig(), durationSeconds: 5, stepSize: 0 }],
] as const) cases.push(await auditLabResult(config, name));
for (const [path, digest] of Object.entries(LAB_RECIPE_MODEL.files)) assert.equal(labSha256(new TextEncoder().encode(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'))), digest);
assert.equal(labSha256(labAssetBytes()), LAB_RECORDING_ASSET.sha256);
const frozen = JSON.parse(readFileSync('docs/evidence/B/B2-003/lab-recipe/source-integrity.json', 'utf8')).frozenFixtures;
for (const [path, hash] of Object.entries(frozen)) assert.equal(labSha256(new Uint8Array(readFileSync(path))), hash);
const report = { role: 'B2', task: 'B2-003', identitySource: 'user-declared', executor: 'Codex', date: '2026-10-01',
  scope: 'lab-v3 lossless serialization, not an independent lab physics oracle', cases, caseCount: cases.length,
  samplesPerSyncOrAsyncRoundtrip: cases.reduce((sum, c) => sum + c.samplesPerRoundtrip, 0),
  numericalModel: LAB_RECIPE_MODEL, recordingSha256: LAB_RECORDING_ASSET.sha256, frozenFixtures: frozen, frozenFixturesUnchanged: true };
mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ destination, caseCount: report.caseCount, samplesPerSyncOrAsyncRoundtrip: report.samplesPerSyncOrAsyncRoundtrip,
  divergence: cases.find(c => c.status === 'diverged')?.divergence, frozenFixturesUnchanged: true }, null, 2));
