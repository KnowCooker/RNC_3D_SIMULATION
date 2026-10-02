/** Read-only previous API compatibility check. Generated outputs must be new and remain in test-results. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';
import { decodeFixture } from '../../../../../src/shared/fixture';
import { encodeResultAsync, decodeResultAsync } from '../../../../../src/team-b/export';
import { sha256, batchInput } from '../../../../../tests/helpers/export-audit';

const priorCommit = 'c2b0f43abff449e25a87eb3dba35ce188ff1057f';
const directory = resolve(process.argv[2] ?? 'test-results/B2-003-async-compat');
const local = relative(resolve('test-results'), directory);
if (!local || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local) || existsSync(directory)) throw new Error('Use a new directory inside test-results');
mkdirSync(directory, { recursive: true });
const prior = execFileSync('git', ['show', `${priorCommit}:src/team-b/export/index.ts`], { encoding: 'utf8' });
const copied = prior.replaceAll('../../shared/', '../../src/shared/').replaceAll('../engine/core', '../../src/team-b/engine/core')
  .replaceAll("'../analysis'", "'../../src/team-b/analysis'").replaceAll("'./model'", "'../../src/team-b/export/model'");
// Copy is directly under a two-level test-results directory; no production source or fixture is rewritten.
if (relative(resolve('test-results'), directory).includes(sep)) throw new Error('Use a single child directory of test-results');
const modulePath = resolve(directory, 'prior-api.ts'); writeFileSync(modulePath, copied, { flag: 'wx' });
const oldApi = await import(pathToFileURL(modulePath).href);
const fixture = decodeFixture(JSON.parse(readFileSync('fixtures/reference/golden_browser_fixture.json', 'utf8')));
const oldBytes: Uint8Array = oldApi.encodeResult(batchInput(fixture), { sourceCommit: priorCommit, sha256 });
const asyncHash = async (bytes: Uint8Array) => Buffer.from(await webcrypto.subtle.digest('SHA-256', Uint8Array.from(bytes))).toString('hex');
const newBytes = await encodeResultAsync(batchInput(fixture), { sourceCommit: priorCommit, sha256: asyncHash });
assert.deepEqual(newBytes, oldBytes);
assert.deepEqual((await decodeResultAsync(oldBytes, asyncHash)).result, oldApi.decodeResult(newBytes, sha256).result);
const report = { role: 'B2', task: 'B2-003', identitySource: 'user-declared', executor: 'Codex', priorCommit,
  priorSourceSha256: sha256(Buffer.from(prior)), containerBytes: oldBytes.length, containerSha256: sha256(oldBytes),
  byteCompatible: true, bothDirectionsReadable: true };
writeFileSync(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
