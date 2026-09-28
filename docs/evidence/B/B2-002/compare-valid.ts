/** Role: B2; Task: B2-002; Identity-Source: user-declared; Executor: Codex. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { analyzeAt, steadyMetrics, syntheticSpl } from '../../../../src/team-b/analysis/index';
import { decodeFixture } from '../../../../src/shared/fixture';
import { ORDER, type SignalKind } from '../../../../src/shared/contracts';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const baseline = '3d81ebc84c5b79c561917d86bdea30b2517d6374';
const output = resolve(root, 'test-results/B2-002');
mkdirSync(output, { recursive: true });
const original = execFileSync('git', ['show', `${baseline}:src/team-b/analysis/index.ts`], { cwd: root, encoding: 'utf8' });
const contracts = pathToFileURL(resolve(root, 'src/shared/contracts.ts')).href;
const oldModule = resolve(output, 'baseline-analysis.ts');
writeFileSync(oldModule, original.replace("'../../shared/contracts'", JSON.stringify(contracts)));
const previous = await import(pathToFileURL(oldModule).href);
const fixture = decodeFixture(JSON.parse(readFileSync(resolve(root, 'fixtures/reference/golden_browser_fixture.json'), 'utf8')));
let comparedFrames = 0;
for (const end of [999, 1000, 1023, 1024, 1535, 1536, 2048, 24000, 31999, 32000]) {
  for (const signal of ['x', 'u', 'd', 'a', 'e'] as SignalKind[]) for (const channel of ORDER) {
    const selection = { signal, channel };
    assert.deepEqual(analyzeAt(fixture, end, selection), previous.analyzeAt(fixture, end, selection));
    comparedFrames++;
  }
}
assert.deepEqual(steadyMetrics(fixture.signals), previous.steadyMetrics(fixture.signals));
for (const rms of [0, 1e-14, 1e-10, 20e-6, 0.001, 1, 10]) assert.equal(syntheticSpl(rms), previous.syntheticSpl(rms));
console.log(JSON.stringify({
  role: 'B2', task: 'B2-002', identitySource: 'user-declared', executor: 'Codex', baseline,
  comparedFrames, comparison: 'deep strict equality: RMS, reduction, PSD bins and metadata',
  validFixtureFramesUnchanged: true, steadyMetricsUnchanged: true, nonnegativeSplUnchanged: true,
}, null, 2));
