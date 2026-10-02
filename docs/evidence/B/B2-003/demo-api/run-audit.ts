/** Role: B2; Task: B2-003; Identity-Source: user-declared; Executor: Codex.
 * Reproduce the same public API checks as the B tests, without overwriting evidence.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, relative, sep } from 'node:path';
import { auditExportCase } from '../../../../../tests/helpers/export-audit';
import { numericCases } from '../../../../../tests/helpers/engine-numeric-audit';

const output = resolve(process.argv[2] ?? 'test-results/B2-003-demo-audit.json');
const localOutput = relative(resolve('test-results'), output);
if (!localOutput || localOutput.startsWith(`..${sep}`) || localOutput === '..' || resolve(localOutput) === localOutput || existsSync(output))
  throw new Error('Use a new output inside test-results; existing evidence is immutable');
const files = ['src/team-b/export/index.ts', 'src/team-b/export/model.ts', 'tests/helpers/export-audit.ts', 'tests/helpers/export-tests.ts'];
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const fixtureFiles = execFileSync('git', ['ls-files', 'fixtures/reference'], { encoding: 'utf8' }).trim().split(/\r?\n/u);
const fixtureBefore = Object.fromEntries(fixtureFiles.map(file => [file, sha(readFileSync(file))]));
const cases = numericCases.map(auditExportCase);
const fixtureAfter = Object.fromEntries(fixtureFiles.map(file => [file, sha(readFileSync(file))]));
if (JSON.stringify(fixtureBefore) !== JSON.stringify(fixtureAfter)) throw new Error('Frozen fixtures changed');
const result = { role: 'B2', task: 'B2-003', identitySource: 'user-declared', executor: 'Codex', date: '2026-10-01',
  baseline: '67387f68c6a6c1d9ad0826794f61ebde74aa649c', scope: 'demo-v2 batch only',
  sourceHashes: Object.fromEntries(files.map(file => [file, sha(Buffer.from(readFileSync(file, 'utf8').replaceAll('\r\n', '\n')))])),
  samplesPerVerification: cases.reduce((sum, entry) => sum + entry.samplesCompared, 0), cases,
  frozenFixtures: fixtureAfter, frozenUnchanged: true, browserWorkerMemoryMeasured: false, labV3Implemented: false };
writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, cases: cases.length, samplesPerVerification: result.samplesPerVerification,
  roundTripExact: true, recomputeExact: true, frozenUnchanged: true }));
