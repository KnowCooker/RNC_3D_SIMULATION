// Role:B2; Task:B2-003; Identity-Source:user-declared; Executor:Codex.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { LAB_RECIPE_MODEL } from '../../../../../src/team-b/export';
import { labSha256 } from '../../../../../tests/helpers/lab-recipe-audit';

const folder = new URL('./', import.meta.url), prefix = 'docs/evidence/B/B2-003/registered-worker/';
const base = '382100930ca950adfed27390acbb6226e0af4afc', main = 'b968d926ce343cb4568e00bdb14da4e87bdd6fc6';
const textHash = (file: string) => labSha256(Buffer.from(readFileSync(file, 'utf8').replaceAll('\r\n', '\n')));
const report = JSON.parse(readFileSync(new URL('browser-report.json', folder), 'utf8'));
const expected = JSON.parse(readFileSync(new URL('../registered-compat/comparison.json', folder), 'utf8'));
assert.equal(report.ok, true); assert.equal(report.passed, 218); assert.equal(report.tests.length, 218);
assert.ok(report.tests.every((t: { passed: boolean }) => t.passed)); assert.equal(report.cases.length, 30);
assert.equal(report.sourceCommit, base); assert.equal(report.workerGlobal, 'DedicatedWorkerGlobalScope'); assert.equal(report.secureContext, true);
assert.equal(report.samplesPerComparison, 1460000); assert.deepEqual(report.numericalModel, LAB_RECIPE_MODEL);
for (const field of ['peakMemoryMeasured', 'productIntegrationTested', 'targetDevicePerformanceAccepted', 'secondMachineTested']) assert.equal(report[field], false);
assert.equal(new Set(report.cases.map((r: { name: string }) => r.name)).size, 30);
for (const row of report.cases) {
  const node = expected.results.find((r: { name: string }) => r.name === row.name); assert.ok(node, row.name);
  assert.deepEqual(row.signalHashes, node.signalHashes, row.name); assert.equal(row.actualSamples, node.actualSamples);
  assert.equal(row.valuesPerComparison, node.samplesPerComparison); assert.equal(row.signalHashes.length, 20 + row.references);
}
assert.deepEqual(JSON.parse(readFileSync(new URL('browser-console.json', folder), 'utf8')), []);
execFileSync('git', ['diff', '--exit-code', base, '--', 'src', 'tests', 'fixtures']);
const numericalSourceHashes = Object.fromEntries(Object.entries(LAB_RECIPE_MODEL.files).map(([file, expected]) => {
  const actual = textHash(file); assert.equal(actual, expected, file); return [file, actual];
}));
const frozenFixtures: Record<string, string> = {};
for (const name of readdirSync('fixtures/reference').sort()) {
  const file = `fixtures/reference/${name}`, actual = labSha256(readFileSync(file));
  assert.equal(actual, labSha256(execFileSync('git', ['show', `${main}:${file}`], { maxBuffer: 32 * 1024 * 1024 })), file);
  frozenFixtures[file] = actual;
}
assert.equal(Object.keys(frozenFixtures).length, 8);
const buildHashes: Record<string, string> = {};
function walk(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(file); else buildHashes[file] = labSha256(readFileSync(file));
  }
}
walk('test-results/B2-003-registered-worker');
const sourceHashes = Object.fromEntries([
  'src/team-b/export/index.ts', 'src/team-b/export/lab-model.ts', 'src/team-b/export/lab-recipe.ts',
  'src/team-b/export/lab-result.ts', 'src/team-b/export/errors.ts',
  `${prefix}browser-worker.ts`, `${prefix}browser.html`, `${prefix}vite-audit.config.ts`, `${prefix}verify.ts`,
].map(file => [file, textHash(file)]));
const reportHashes = Object.fromEntries(['README.md', 'browser-report.json', 'browser-console.json', 'browser-build.txt',
  'typecheck.txt', 'test-b.txt', 'check.txt'].map(file => [file, textHash(prefix + file)]));
writeFileSync(new URL('verification.json', folder), JSON.stringify({ role: 'B2', task: 'B2-003', executor: 'Codex',
  identitySource: 'user-declared', date: '2026-10-05', sourceBase: base, mainBase: main,
  claimCommit: '71fc8e985cff89a450539ebaa3205640db17b156', pr: 'https://github.com/KnowCooker/RNC_3D_SIMULATION/pull/61',
  sourceHashEncoding: 'utf8-lf', reportHashEncoding: 'utf8-lf', buildHashEncoding: 'raw-bytes', sourceHashes, reportHashes,
  numericalSourceHashes, buildHashes, frozenFixtures, screenshotSha256: labSha256(readFileSync(new URL('browser-success.png', folder))),
  passed: report.passed, cases: report.cases.length, samplesPerComparison: report.samplesPerComparison,
  sourceAndFixturesUnchanged: true, reportNodeHashesExact: true, consoleErrorsWarnings: [],
}, null, 2) + '\n');
console.log('Browser 218/218; 30 cases exact against Node; 17 numerical hashes and 8 frozen fixtures match; source/build/report hashes saved.');
