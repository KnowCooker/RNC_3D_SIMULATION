/** Role: B2; Task: B2-004; Identity-Source: user-declared; Executor: Codex.
 * Report preparation: bind saved evidence to commits and probe the current public data APIs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_CONFIG } from '../../../../src/shared/defaults';
import { ORDER } from '../../../../src/shared/contracts';
import { defaultLabConfig } from '../../../../src/shared/lab-contracts';
import { calculateSync } from '../../../../src/team-b/engine/core';
import { analyzeAt } from '../../../../src/team-b/analysis';
import { analyzeLab, calculateLab, decodeRecordedNoise } from '../../../../src/team-b/lab';
import { DEMO_MODEL, LAB_RECIPE_MODEL, LAB_RECORDING_ASSET, encodeResult, decodeResult,
  encodeLabResult, decodeLabResult } from '../../../../src/team-b/export';
import { matrixConfig, labAssetBytes } from '../../../../tests/helpers/lab-recipe-audit';

const destination = process.argv[2] ?? 'test-results/B2-004/audit.json';
assert.match(destination, /^test-results\/B2-004(?:-[a-z0-9-]+)?\/audit\.json$/u);
assert.ok(!existsSync(destination), 'Existing evidence must not be overwritten');
const baseline = '93ed882861e07f23a604cb446fe6dce391f892c7';
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const normalized = (value: string) => Buffer.from(value.replaceAll('\r\n', '\n'));
const textHash = (path: string) => sha(normalized(readFileSync(path, 'utf8')));
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
git('merge-base', '--is-ancestor', baseline, 'HEAD');
const delivery = [
  { pr: 48, commit: 'fa805e2da2ec16ce7e17a087b202ec3380a48ba2', report: 'B1-001/comparison.json' },
  { pr: 50, commit: '67387f68c6a6c1d9ad0826794f61ebde74aa649c', report: 'B1-002/result.json' },
  { pr: 50, commit: '67387f68c6a6c1d9ad0826794f61ebde74aa649c', report: 'B1-003/result.json' },
  { pr: 51, commit: 'c2b0f43abff449e25a87eb3dba35ce188ff1057f', report: 'B2-003/demo-api/audit.json' },
  { pr: 52, commit: '181952687d6fb303e540e9f1b3981d228b52e744', report: 'B2-003/async-api/browser-result.json' },
  { pr: 53, commit: '33fbddca6b605b521f38a4bcfee7dc828f43fc04', report: 'B2-003/lab-recipe/comparison.json' },
  { pr: 54, commit: baseline, report: 'B2-003/lab-result/comparison.json' },
  { pr: 54, commit: baseline, report: 'B2-003/lab-result/browser-report.json' },
];
const evidence = delivery.map(entry => {
  const path = `docs/evidence/B/${entry.report}`;
  git('merge-base', '--is-ancestor', entry.commit, baseline);
  const committed = execFileSync('git', ['show', `${entry.commit}:${path}`], { encoding: 'utf8' });
  assert.equal(textHash(path), sha(normalized(committed)), `${path}: differs from merged evidence`);
  return { ...entry, path, sha256: textHash(path), hashEncoding: 'utf8-lf' };
});
const numeric = json('docs/evidence/B/B1-001/comparison.json');
assert.equal(numeric.cases.length, 5); assert.equal(numeric.comparedSamples, 3200000);
assert.ok(numeric.cases.every((c: any) => c.passed && c.repeatExact && c.pythonFloat64RepeatExact));
const timing = json('docs/evidence/B/B1-002/result.json');
assert.equal(timing.mutations.length, 11); assert.ok(timing.mutations.every((c: any) => c.detected));
const failures = json('docs/evidence/B/B1-003/result.json');
assert.equal(failures.invalid.invalidConfigurations, 128); assert.equal(failures.valid.length, 12);
assert.equal(failures.faults.length, 7);
const labRecipe = json('docs/evidence/B/B2-003/lab-recipe/comparison.json');
const labResult = json('docs/evidence/B/B2-003/lab-result/comparison.json');
assert.equal(labRecipe.caseCount, 25); assert.equal(labRecipe.totalSamplesCompared, 2405816);
assert.equal(labResult.caseCount, 29); assert.equal(labResult.samplesPerSyncOrAsyncRoundtrip, 2789816);
const browser = json('docs/evidence/B/B2-003/lab-result/browser-report.json');
assert.equal(browser.ok, true); assert.equal(browser.passed, 15);
assert.ok(browser.tests.every((entry: any) => entry.passed));

const integrity = json('docs/evidence/B/B2-003/lab-result/source-integrity.json');
for (const [path, hash] of Object.entries(integrity.sourceHashes)) assert.equal(textHash(path), hash, path);
for (const model of [DEMO_MODEL, LAB_RECIPE_MODEL])
  for (const [path, hash] of Object.entries(model.files)) assert.equal(textHash(path), hash, `${model.id}: ${path}`);
const frozen = integrity.frozenFixtures;
const verifyFrozen = () => {
  const tracked = git('ls-files', 'fixtures/reference').split(/\r?\n/u).sort();
  assert.deepEqual(tracked, Object.keys(frozen).sort());
  for (const [path, hash] of Object.entries(frozen)) assert.equal(sha(readFileSync(path)), hash, path);
};
verifyFrozen(); assert.equal(sha(labAssetBytes()), LAB_RECORDING_ASSET.sha256);
const context = { sourceCommit: baseline, sha256: sha };
const channelsExact = (actual: readonly Float32Array[], expected: readonly Float32Array[]) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((channel, i) => {
    assert.equal(channel.length, expected[i].length); assert.ok(channel.every(Number.isFinite));
    assert.deepEqual(channel, expected[i]); assert.notEqual(channel.buffer, expected[i].buffer);
  });
};
const demo = [0.08, 0].map(stepSize => {
  const result = calculateSync({ ...DEFAULT_CONFIG, stepSize: stepSize as 0 | 0.08 }, `b2-004-demo-${stepSize}`);
  assert.equal(result.sampleCount, 32000); assert.deepEqual(result.order, ORDER);
  assert.deepEqual(result.units, { x: 'm/s2', u: 'drive', d: 'Pa', a: 'Pa', e: 'Pa' });
  assert.equal(result.source, 'computed-browser');
  const bytes = encodeResult({ mode: 'batch', originSample: 0, result }, context);
  const imported = decodeResult(bytes, sha);
  let maxSuperpositionError = 0;
  for (const kind of ['x', 'u', 'd', 'a', 'e'] as const) channelsExact(imported.result.signals[kind], result.signals[kind]);
  for (let mic = 0; mic < 4; mic++) for (let i = 0; i < 32000; i++) {
    maxSuperpositionError = Math.max(maxSuperpositionError, Math.abs(result.signals.e[mic][i] - result.signals.d[mic][i] - result.signals.a[mic][i]));
    if (stepSize === 0) {
      assert.equal(result.signals.u[mic][i], 0); assert.equal(result.signals.a[mic][i], 0);
      assert.equal(result.signals.e[mic][i], result.signals.d[mic][i]);
    }
  }
  assert.ok(maxSuperpositionError <= 1e-5);
  const analysis = [0, 999, 1000, 1024, 32000, 32001].map(end => {
    const frame = analyzeAt(result, end, { signal: 'e', channel: 'fl' });
    assert.deepEqual(analyzeAt(imported.result, end, { signal: 'e', channel: 'fl' }), frame);
    assert.equal(frame.endSampleExclusive, Math.min(end, 32000));
    if (end < 1000) { assert.equal(frame.valid, false); assert.equal(frame.reason, 'warming-up'); }
    if (frame.spectrum) { assert.equal(frame.spectrum.psd.length, 513); assert.equal(frame.spectrum.binHz, 2000 / 1024); }
    return { requestedEndSampleExclusive: end, endSampleExclusive: frame.endSampleExclusive, valid: frame.valid,
      reason: frame.reason, spectrumBins: frame.spectrum?.psd.length ?? null };
  });
  return { config: result.config, source: result.source, sampleCount: result.sampleCount, channels: 20,
    payloadBytes: 2560000, containerBytes: bytes.length, endSecondsExclusive: 16, lastSampleSeconds: 15.9995,
    maxSuperpositionError, roundTripExact: true, importedAnalysisExact: true, analysis };
});
const lab = [
  { name: 'shaped-1', config: matrixConfig('bev', 'shaped-noise', 1) },
  { name: 'recorded-8', config: matrixConfig('ice', 'recorded-noise', 8) },
  { name: 'diverged-4', config: { ...defaultLabConfig(), durationSeconds: 3, stepSize: 2 } },
].map(({ name, config }) => {
  const recording = config.sourceMode === 'recorded-noise' ? decodeRecordedNoise(labAssetBytes().buffer) : undefined;
  const result = calculateLab(config, `b2-004-${name}`, recording);
  const bytes = encodeLabResult({ mode: 'batch', originSample: 0, source: 'computed-browser', result }, context);
  const imported = decodeLabResult(bytes, sha), manifest = imported.manifest;
  assert.deepEqual(imported.result.config, config); assert.equal(imported.result.runId, result.runId);
  assert.equal(imported.source, 'computed-browser'); assert.equal(imported.verifiedMetrics?.rawMetricsMatch, true);
  assert.equal(manifest.channels.length, 20 + config.references.length);
  const expectedChannels = (['q', 'x', 'u', 'd', 'a', 'e'] as const).flatMap(signal => {
    const ids = signal === 'x' ? config.references.map(ref => ref.id) : ORDER;
    const unit = signal === 'q' ? (config.sourceMode === 'recorded-noise' ? 'relative-amplitude' : 'm/s2-equivalent-wheel-excitation')
      : signal === 'x' ? 'm/s2' : signal === 'u' ? 'drive' : 'Pa';
    return ids.map((id, index) => ({ signal, index, stableId: `${signal}:${id}`, unit, sampleCount: result.sampleCount }));
  });
  assert.deepEqual(manifest.channels.map(({ signal, index, stableId, unit, sampleCount }) =>
    ({ signal, index, stableId, unit, sampleCount })), expectedChannels);
  channelsExact(imported.result.sources, result.sources);
  for (const kind of ['x', 'u', 'd', 'a', 'e'] as const) channelsExact(imported.result.signals[kind], result.signals[kind]);
  assert.equal(manifest.integrity.payloadBytes, (20 + config.references.length) * result.sampleCount * 4);
  assert.equal(manifest.time.endSeconds, result.sampleCount / 2000);
  assert.equal(manifest.time.lastSampleSeconds, result.sampleCount ? (result.sampleCount - 1) / 2000 : null);
  if (result.divergence) { assert.equal(result.sampleCount, 2909); assert.equal(result.divergence.sample, result.sampleCount); }
  else assert.equal(result.sampleCount, config.durationSeconds * 2000);
  const analysis = [0, 0.4995, 0.5, result.sampleCount / 2000, config.durationSeconds].map(time => {
    const frame = analyzeLab(result, time, { signal: 'e', channel: 0 });
    assert.deepEqual(analyzeLab(imported.result, time, { signal: 'e', channel: 0 }), frame);
    assert.equal(frame.time, Math.min(result.sampleCount, Math.floor(time * 2000)) / 2000);
    if (time < 0.5) assert.equal(frame.valid, false);
    return { requestedTime: time, time: frame.time, valid: frame.valid, levelWeighting: frame.levelWeighting,
      spectrumWeighting: frame.spectrumWeighting, spectrumBins: frame.spectrum?.length ?? null };
  });
  return { name, config, source: imported.source, requestedSamples: config.durationSeconds * 2000,
    actualSamples: result.sampleCount, status: manifest.run.status, time: manifest.time,
    channels: manifest.channels.map(({ signal, index, stableId, unit, sampleCount }) => ({ signal, index, stableId, unit, sampleCount })),
    payloadBytes: manifest.integrity.payloadBytes, containerBytes: bytes.length, rawMetricsMatch: true,
    roundTripExact: true, importedAnalysisExact: true, analysis };
});
verifyFrozen();
const report = { role: 'B2', task: 'B2-004', identitySource: 'user-declared', executor: 'Codex',
  date: '2026-10-01', phase: 'report-preparation', baseline, checkoutHead: git('rev-parse', 'HEAD'),
  auditSourceSha256: textHash('docs/evidence/B/B2-004/run-audit.ts'), auditSourceHashEncoding: 'utf8-lf',
  node: process.version, platform: process.platform, evidence,
  savedEvidenceSummary: { demoOracleSamples: numeric.comparedSamples, detectedMutations: timing.mutations.length,
    invalidConfigurations: failures.invalid.invalidConfigurations, validConfigurations: failures.valid.length,
    injectedNumericFaults: failures.faults.length, labRecipeCases: labRecipe.caseCount, labResultCases: labResult.caseCount,
    historicalLabWorkerChecks: browser.passed, historicalBrowserRerunThisBatch: false },
  numericalModels: [DEMO_MODEL, LAB_RECIPE_MODEL], sourceHashes: integrity.sourceHashes,
  recording: LAB_RECORDING_ASSET, frozenFixtures: frozen, frozenFixturesUnchanged: true, demo, lab,
  newRoundtripValues: demo.reduce((sum, c) => sum + c.sampleCount * c.channels, 0) + lab.reduce((sum, c) => sum + c.actualSamples * c.channels.length, 0),
  pending: ['A1 product file/Worker/cancel/experiment-isolation', 'B1 new-layout review', 'target-device performance',
    'actual browser peak memory', 'second Windows physical offline reproduction', 'final B2-003/B2-004 acceptance'] };
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ destination, evidenceBindings: evidence.length, demoCases: demo.length, labCases: lab.length,
  newRoundtripValues: report.newRoundtripValues, frozenFixturesUnchanged: true, phase: report.phase }, null, 2));
