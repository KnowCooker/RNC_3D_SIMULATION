/** Role:B2; Task:B2-004; Identity-Source:user-declared; Executor:Codex.
 * Candidate report addendum; historical reports keep their original versions.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { ORDER } from '../../../../../src/shared/contracts';
import { XPENG_LAB_LAYOUTS, defaultXPengConfig } from '../../../../../src/shared/lab-contracts';
import { calculateLab, analyzeLab, decodeRecordedNoise } from '../../../../../src/team-b/lab';
import { DEMO_MODEL, LAB_RECIPE_MODEL, LAB_RECORDING_ASSET, ExportError, estimateLabExport,
  encodeLabResult, decodeLabResult, encodeLabResultAsync, decodeLabResultAsync, recomputeLabRecipeAsync } from '../../../../../src/team-b/export';
import { labAssetBytes, labSha256, hashLabSignals, assertLabEqual } from '../../../../../tests/helpers/lab-recipe-audit';

const destination = process.argv[2] ?? 'test-results/B2-004-registered/audit.json';
assert.match(destination, /^test-results\/B2-004-registered(?:-[a-z0-9-]+)?\/audit\.json$/u);
assert.ok(!existsSync(destination), 'Existing audit output must not be overwritten');
const candidate = '795d9095eb8996da2938a7513bbcaa435a18d8e8', main = 'b968d926ce343cb4568e00bdb14da4e87bdd6fc6';
const normalized = (text: string) => Buffer.from(text.replaceAll('\r\n', '\n'));
const textHash = (file: string) => labSha256(normalized(readFileSync(file, 'utf8')));
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
execFileSync('git', ['merge-base', '--is-ancestor', candidate, 'HEAD']);
execFileSync('git', ['diff', '--exit-code', candidate, '--', 'src', 'tests', 'fixtures']);
const bindings = [
  { pr: 55, commit: main, file: 'docs/evidence/B/B2-004/audit.json', scope: 'historical-main-teaching-report' },
  { pr: 55, commit: main, file: 'docs/evidence/B/B2-004/verification.json', scope: 'historical-main-report-hashes' },
  { pr: 60, commit: '382100930ca950adfed27390acbb6226e0af4afc', file: 'docs/evidence/B/B2-003/registered-compat/comparison.json', scope: 'registered-Node-matrix' },
  { pr: 61, commit: candidate, file: 'docs/evidence/B/B2-003/registered-worker/browser-report.json', scope: 'registered-production-Worker' },
  { pr: 61, commit: candidate, file: 'docs/evidence/B/B2-003/registered-worker/verification.json', scope: 'registered-Worker-source-build-report-hashes' },
].map(entry => {
  const saved = execFileSync('git', ['show', `${entry.commit}:${entry.file}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const hash = textHash(entry.file); assert.equal(hash, labSha256(normalized(saved)), entry.file);
  return { ...entry, hashEncoding: 'utf8-lf', sha256: hash };
});
const historical = json(bindings[0].file), oldVerification = json(bindings[1].file);
assert.equal(historical.baseline, '93ed882861e07f23a604cb446fe6dce391f892c7');
assert.equal(historical.numericalModels[1].id, 'lab-v3-teaching-batch-recipe-1');
for (const [name, hash] of Object.entries(oldVerification.hashes)) assert.equal(textHash(`docs/evidence/B/B2-004/${name}`), hash, name);
const node = json(bindings[2].file), browser = json(bindings[3].file), workerVerification = json(bindings[4].file);
assert.deepEqual(node.numericalModel, LAB_RECIPE_MODEL); assert.deepEqual(browser.numericalModel, LAB_RECIPE_MODEL);
assert.equal(node.cases, 30); assert.equal(browser.cases.length, 30); assert.equal(browser.passed, 218); assert.equal(browser.ok, true);
assert.ok(browser.tests.every((test: { passed: boolean }) => test.passed));
for (const row of browser.cases) assert.deepEqual(row.signalHashes, node.results.find((r: { name: string }) => r.name === row.name)?.signalHashes, row.name);
for (const [file, hash] of Object.entries(workerVerification.sourceHashes)) assert.equal(textHash(file), hash, file);
for (const [name, hash] of Object.entries(workerVerification.reportHashes)) assert.equal(textHash(`docs/evidence/B/B2-003/registered-worker/${name}`), hash, name);
const modelSourceHashes = Object.fromEntries([DEMO_MODEL, LAB_RECIPE_MODEL].flatMap(model => Object.entries(model.files).map(([file, expected]) => {
  const actual = textHash(file); assert.equal(actual, expected, file); return [file, actual];
})));
const frozenFixtures: Record<string, string> = {};
for (const name of readdirSync('fixtures/reference').sort()) {
  const file = `fixtures/reference/${name}`, actual = labSha256(readFileSync(file));
  assert.equal(actual, labSha256(execFileSync('git', ['show', `${main}:${file}`], { maxBuffer: 32 * 1024 * 1024 })), file);
  frozenFixtures[file] = actual;
}
assert.equal(Object.keys(frozenFixtures).length, 8);
const asset = labAssetBytes(); assert.equal(asset.length, LAB_RECORDING_ASSET.bytes); assert.equal(labSha256(asset), LAB_RECORDING_ASSET.sha256);
const recording = decodeRecordedNoise(Uint8Array.from(asset).buffer), context = { sourceCommit: candidate, sha256: labSha256 };
const cases = [];
for (const row of XPENG_LAB_LAYOUTS) for (const sourceMode of ['shaped-noise', 'recorded-noise'] as const) {
  const name = `${row.assetId}-${sourceMode}-16s`, config = { ...defaultXPengConfig(row.assetId), sourceMode };
  const result = calculateLab(config, `original-${name}`, sourceMode === 'recorded-noise' ? recording : undefined);
  assert.equal(config.durationSeconds, 16); assert.equal(config.references.length, 4); assert.equal(result.sampleCount, 32000); assert.equal(result.divergence, undefined);
  const input = { mode: 'batch' as const, originSample: 0 as const, source: 'computed-browser' as const, result };
  const before = hashLabSignals(result), bytes = encodeLabResult(input, context), estimate = estimateLabExport(input, context);
  const asyncBytes = await encodeLabResultAsync(input, { ...context, sha256: async value => labSha256(value) });
  assert.deepEqual(asyncBytes, bytes); assert.equal(bytes.length, estimate.containerBytes);
  const imported = decodeLabResult(bytes, labSha256), asynchronous = await decodeLabResultAsync(bytes, async value => labSha256(value));
  for (const decoded of [imported, asynchronous]) {
    assertLabEqual(decoded.result, result); assert.deepEqual(decoded.result.config, config); assert.equal(decoded.source, input.source);
    assert.equal(decoded.result.runId, result.runId); assert.equal(decoded.modelSupported, true); assert.equal(decoded.layoutSupported, true);
    assert.equal(decoded.verifiedMetrics?.rawMetricsMatch, true); assert.equal(decoded.manifest.integrity.payloadBytes, 3072000);
    assert.deepEqual(decoded.manifest.time, { startSeconds: 0, endSeconds: 16, lastSampleSeconds: 15.9995, interval: 'half-open' });
    assert.equal(decoded.manifest.rawMetrics.startSample, 24000); assert.equal(decoded.manifest.rawMetrics.endSample, 32000);
    assert.equal(decoded.manifest.rawMetrics.weighting, 'Z'); assert.equal(Object.hasOwn(decoded.result.config, 'levelOffsetDb'), false);
    assert.equal(decoded.manifest.recipe.normalizedConfig.levelOffsetDb, 0);
  }
  const descriptors = imported.manifest.channels.map(({ signal, index, stableId, unit, sampleCount }) => ({ signal, index, stableId, unit, sampleCount }));
  assert.deepEqual(descriptors, (['q', 'x', 'u', 'd', 'a', 'e'] as const).flatMap(signal => {
    const ids = signal === 'x' ? config.references.map(ref => ref.id) : ORDER;
    const unit = signal === 'q' ? sourceMode === 'recorded-noise' ? 'relative-amplitude' : 'm/s2-equivalent-wheel-excitation'
      : signal === 'x' ? 'm/s2' : signal === 'u' ? 'drive' : 'Pa';
    return ids.map((id, index) => ({ signal, index, stableId: `${signal}:${id}`, unit, sampleCount: 32000 }));
  }));
  let resolverCalls = 0;
  const repeated = await recomputeLabRecipeAsync(imported.manifest.recipe, { runId: `recomputed-${name}`,
    sha256: async value => labSha256(value), resolveAsset: async descriptor => { assert.deepEqual(descriptor, LAB_RECORDING_ASSET); resolverCalls++; return asset; } });
  assertLabEqual(repeated.result, result); assert.equal(repeated.result.config.layoutId, row.id); assert.equal(repeated.result.config.vehicle, row.vehicle);
  assert.equal(repeated.originalRunId, result.runId); assert.notEqual(repeated.result.runId, result.runId); assert.equal(repeated.status, 'completed');
  assert.equal(resolverCalls, sourceMode === 'recorded-noise' ? 1 : 0);
  const analysis = [];
  for (const time of [0, 0.4995, 0.5, 16, 16.5]) for (const weighting of ['Z', 'A'] as const) for (const signal of ['q', 'x', 'u', 'd', 'a', 'e'] as const) {
    const options = { levelWeighting: weighting, spectrumWeighting: weighting }, selection = { signal, channel: 0 };
    const frame = analyzeLab(result, time, selection, options);
    for (const decoded of [imported, asynchronous]) assert.deepEqual(analyzeLab(decoded.result, time, selection, options), frame);
    assert.equal(frame.time, Math.min(32000, Math.floor(time * 2000)) / 2000);
    if (time < 0.5) assert.equal(frame.valid, false);
    assert.equal(frame.spectrumWeighting, ['d', 'a', 'e'].includes(signal) ? weighting : 'Z');
    analysis.push({ requestedTime: time, time: frame.time, signal, levelWeighting: frame.levelWeighting,
      spectrumWeighting: frame.spectrumWeighting, valid: frame.valid, unit: frame.unit, spectrumBins: frame.spectrum?.length ?? null,
      waveformSamples: frame.waveform.length, primarySpl: frame.primarySpl, residualSpl: frame.residualSpl, reductionDb: frame.reductionDb });
  }
  assert.deepEqual(hashLabSignals(result), before); assert.deepEqual(result.config, config);
  cases.push({ name, config, actualSamples: result.sampleCount, channels: descriptors, payloadBytes: estimate.payloadBytes,
    containerBytes: bytes.length, encodeResidentLowerBoundBytes: estimate.minimumResidentSignalBytes,
    time: imported.manifest.time, source: imported.source, rawMetricsWindow: imported.manifest.rawMetrics,
    valuesPerComparison: 768000, signalHashes: before, syncAsyncBytesEqual: true, recipeRecomputeExact: true,
    analysisPerDecode: analysis.length, importedAnalysisExact: true, resolverCalls, analysis });
}
const legacy = decodeLabResult(new Uint8Array(readFileSync('docs/evidence/B/B2-003/registered-compat/legacy-model-1.rncrs')), labSha256);
assert.equal(legacy.modelSupported, false); assert.equal(legacy.verifiedMetrics, null); let legacyResolverCalls = 0;
await assert.rejects(recomputeLabRecipeAsync(legacy.manifest.recipe, { runId: 'new-legacy', resolveAsset: async () => { legacyResolverCalls++; return asset; } }),
  e => e instanceof ExportError && e.code === 'MODEL_MISMATCH');
assert.equal(legacyResolverCalls, 0); assert.equal(labSha256(asset), LAB_RECORDING_ASSET.sha256);
const report = { role: 'B2', task: 'B2-004', identitySource: 'user-declared', executor: 'Codex', date: '2026-10-05',
  phase: 'registered-candidate-report-addendum', candidate, main, checkoutHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version, platform: process.platform, auditSourceSha256: textHash('docs/evidence/B/B2-004/registered-candidate/run-audit.ts'),
  bindings, historicalReportRemainsVersion1: true, savedBrowserRerunThisBatch: false,
  savedRegisteredEvidence: { nodeCases: node.cases, browserCases: browser.cases.length, browserChecks: browser.passed, valuesPerComparison: browser.samplesPerComparison },
  models: [DEMO_MODEL, LAB_RECIPE_MODEL], modelSourceHashes, frozenFixtures, frozenFilesUnchanged: true, recording: LAB_RECORDING_ASSET,
  registeredLayouts: XPENG_LAB_LAYOUTS.map(row => ({ layoutId: row.id, assetId: row.assetId, vehicle: row.vehicle,
    microphoneCount: row.layout.microphones.length, speakerCount: row.layout.speakers.length, sourceCount: row.layout.sources.length, seatRows: row.seatZ.length })),
  newCaseCount: cases.length, valuesPerComparison: cases.length * 768000, analysisFramesPerDecode: cases.reduce((n, row) => n + row.analysisPerDecode, 0),
  comparisonKinds: ['sync-result-decode', 'async-result-decode', 'recipe-recompute'], cases,
  legacyModel1ReadOnly: true, legacyResolverCalls, runtimeSourceUnchanged: true,
  pending: ['registered-layout independent numerical review', 'A1 production B file/Worker/cancel/identity validation',
    'target-device performance', 'actual peak memory', 'second Windows physical offline verification', 'final B2-003/B2-004 acceptance'] };
mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ destination, bindings: bindings.length, cases: cases.length, valuesPerComparison: report.valuesPerComparison,
  analysisFramesPerDecode: report.analysisFramesPerDecode, frozenFiles: 8, phase: report.phase }, null, 2));
