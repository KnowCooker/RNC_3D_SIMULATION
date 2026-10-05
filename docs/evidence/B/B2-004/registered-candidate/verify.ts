/** Role:B2; Task:B2-004; Identity-Source:user-declared; Executor:Codex. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const directory = 'docs/evidence/B/B2-004/registered-candidate';
const bytesHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const textHash = (file: string) => bytesHash(Buffer.from(readFileSync(file, 'utf8').replaceAll('\r\n', '\n')));
const audit = JSON.parse(readFileSync(`${directory}/audit.json`, 'utf8'));
assert.equal(audit.candidate, '795d9095eb8996da2938a7513bbcaa435a18d8e8');
assert.equal(audit.auditSourceSha256, textHash(`${directory}/run-audit.ts`));
assert.equal(audit.newCaseCount, 10); assert.equal(audit.cases.length, 10);
assert.equal(audit.valuesPerComparison, 7680000); assert.equal(audit.analysisFramesPerDecode, 600);
assert.equal(new Set(audit.cases.map((row: { name: string }) => row.name)).size, 10);
for (const row of audit.cases) {
  assert.equal(row.actualSamples, 32000); assert.equal(row.channels.length, 24);
  assert.equal(row.payloadBytes, 3072000); assert.equal(row.analysis.length, 60);
  assert.equal(row.syncAsyncBytesEqual, true); assert.equal(row.recipeRecomputeExact, true);
  assert.equal(row.importedAnalysisExact, true);
}
assert.equal(audit.bindings.length, 5);
for (const binding of audit.bindings) {
  assert.equal(textHash(binding.file), binding.sha256);
  const saved = execFileSync('git', ['show', `${binding.commit}:${binding.file}`], { maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' });
  assert.equal(bytesHash(Buffer.from(saved.replaceAll('\r\n', '\n'))), binding.sha256);
}
for (const [file, hash] of Object.entries(audit.modelSourceHashes)) assert.equal(textHash(file), hash, file);
for (const [file, hash] of Object.entries(audit.frozenFixtures)) assert.equal(bytesHash(readFileSync(file)), hash, file);
execFileSync('git', ['diff', '--exit-code', audit.candidate, '--', 'src', 'tests', 'fixtures']);
const bLog = readFileSync(`${directory}/test-b.txt`, 'utf8');
const fullLog = readFileSync(`${directory}/check.txt`, 'utf8');
assert.match(bLog, /tests 125/u); assert.match(bLog, /pass 125/u); assert.match(bLog, /fail 0/u);
assert.match(fullLog, /tests 295/u); assert.match(fullLog, /pass 295/u); assert.match(fullLog, /fail 0/u);
const files = ['README.md', 'DATA_CONTRACT.md', 'SECOND_WINDOWS.md', 'run-audit.ts', 'verify.ts',
  'audit.json', 'audit-command.txt', 'audit-typecheck.txt', 'initial-typecheck-failure.txt', 'test-b.txt', 'check.txt'];
const links: { document: string; target: string }[] = [];
for (const document of files.filter(file => file.endsWith('.md'))) {
  for (const match of readFileSync(`${directory}/${document}`, 'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const target = match[1].split('#')[0];
    if (!target || /^https?:\/\//u.test(target)) continue;
    assert.ok(existsSync(resolve(directory, target)), `${document}: ${target}`);
    links.push({ document, target });
  }
}
const verification = { role: 'B2', task: 'B2-004', identitySource: 'user-declared', executor: 'Codex',
  date: '2026-10-05', candidate: audit.candidate, main: audit.main,
  hashEncoding: 'utf8-lf', reportHashes: Object.fromEntries(files.map(file => [file, textHash(`${directory}/${file}`)])),
  modelSourceHashes: audit.modelSourceHashes, frozenFixtures: audit.frozenFixtures, immutableBindings: audit.bindings,
  links, checks: { cases: 10, valuesPerComparison: 7680000, analysisFramesPerDecode: 600, bTests: 125, allTests: 295,
    runtimeSourceUnchanged: true, reportLinksExist: true }, pending: audit.pending };
writeFileSync(`${directory}/verification.json`, JSON.stringify(verification, null, 2) + '\n');
console.log(JSON.stringify({ reports: files.length, links: links.length, cases: 10, bTests: 125, allTests: 295 }));
