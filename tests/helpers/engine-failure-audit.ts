import assert from 'node:assert/strict';
import { calculateSync, validateConfig, EngineError } from '../../src/team-b/engine/core';
import { createData } from '../../src/team-b/engine/data';
import { DEFAULT_CONFIG } from '../../src/shared/defaults';
import type { RunConfig } from '../../src/shared/contracts';
import { loadCore, type Data } from './engine-harness';

export function invalidCases(): { name: string; value: unknown }[] {
  const cases: { name: string; value: unknown }[] = [
    { name: 'null', value: null }, { name: 'undefined', value: undefined },
    { name: 'array', value: [] }, { name: 'number', value: 7 },
    { name: 'string', value: 'demo-v2' }, { name: 'boolean', value: true },
    { name: 'array-with-config-properties', value: Object.assign([], DEFAULT_CONFIG) },
  ];
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof RunConfig)[]) {
    const absent: Partial<RunConfig> = { ...DEFAULT_CONFIG }; delete absent[key];
    cases.push({ name: `missing-${key}`, value: absent });
    for (const value of [null, NaN, Infinity, -Infinity, {}, [], true]) {
      cases.push({ name: `${key}-${String(value)}`, value: { ...DEFAULT_CONFIG, [key]: value } });
    }
    const value = DEFAULT_CONFIG[key];
    cases.push({ name: `${key}-wrong-value`, value: { ...DEFAULT_CONFIG, [key]: typeof value === 'number' ? value + 0.5 : `${value}-unknown` } });
    if (typeof value === 'number') cases.push({ name: `${key}-numeric-string`, value: { ...DEFAULT_CONFIG, [key]: String(value) } });
  }
  for (const [key, value] of [['taps', 31], ['taps', 0], ['taps', 128], ['seed', 42], ['stepSize', -0.08], ['stepSize', 0.5]] as const) {
    cases.push({ name: `${key}-${value}`, value: { ...DEFAULT_CONFIG, [key]: value } });
  }
  return cases;
}
export function auditInvalidConfigs() {
  const cases = invalidCases();
  for (const { name, value } of cases) for (const action of [validateConfig, calculateSync]) {
    assert.throws(() => action(value as RunConfig, `bad-${name}`), (error: unknown) =>
      error instanceof EngineError && error.code === 'INVALID_CONFIG' && error.runId === `bad-${name}` && error.message.length > 0,
    `${name}: expected structured INVALID_CONFIG`);
  }
  return { invalidConfigurations: cases.length, checkedEntryPoints: ['validateConfig', 'calculateSync'], passed: true };
}

export function auditValidConfigs() {
  const rows = [];
  for (const seed of [11, 29, 47] as const) for (const taps of [32, 64] as const) for (const stepSize of [0, 0.08] as const) {
    const config = Object.freeze({ ...DEFAULT_CONFIG, seed, taps, stepSize });
    const result = calculateSync(config, `valid-${seed}-${taps}-${stepSize}`);
    assert.deepEqual(result.config, config); assert.notEqual(result.config, config);
    assert.equal(result.sampleCount, 32000);
    const buffers = new Set<ArrayBufferLike>();
    let maxDrive = 0, maxSuperpositionError = 0;
    for (const key of ['x', 'u', 'd', 'a', 'e'] as const) {
      assert.equal(result.signals[key].length, 4);
      for (const signal of result.signals[key]) {
        assert.ok(signal instanceof Float32Array); assert.equal(signal.length, 32000);
        assert.ok(signal.every(Number.isFinite)); buffers.add(signal.buffer);
        if (key === 'u') for (const value of signal) maxDrive = Math.max(maxDrive, Math.abs(value));
      }
    }
    assert.equal(buffers.size, 20, 'output channels must not alias');
    assert.ok(result.metrics.reductionDbByMic.every(Number.isFinite));
    assert.ok(Number.isFinite(result.metrics.aggregateReductionDb));
    for (let c = 0; c < 4; c++) for (let n = 0; n < 32000; n++) {
      maxSuperpositionError = Math.max(maxSuperpositionError,
        Math.abs(result.signals.e[c][n] - result.signals.d[c][n] - result.signals.a[c][n]));
      if (!stepSize) {
        assert.equal(result.signals.u[c][n], 0); assert.equal(result.signals.a[c][n], 0);
        assert.equal(result.signals.e[c][n], result.signals.d[c][n]);
      }
    }
    assert.ok(maxSuperpositionError <= 1e-5);
    if (!stepSize) {
      assert.deepEqual(result.metrics.reductionDbByMic, [0, 0, 0, 0]); assert.equal(result.metrics.aggregateReductionDb, 0);
    }
    rows.push({ seed, taps, stepSize, maxDrive, maxSuperpositionError, all20ChannelsFinite: true,
      reductionDbByMic: result.metrics.reductionDbByMic, aggregateReductionDb: result.metrics.aggregateReductionDb });
  }
  assert.ok(rows.some(row => row.maxDrive > 1), 'control output must not be clipped to PCM full scale');
  return rows;
}

const faults: { name: string; edit: (data: Data) => void }[] = [
  { name: 'reference-NaN', edit: d => { d.x[2][0] = NaN; } },
  { name: 'primary-Infinity', edit: d => { d.d[1][0] = Infinity; } },
  { name: 'secondary-NaN', edit: d => { d.secondary[0][1][5] = NaN; } },
  { name: 'last-sample-NaN', edit: d => { d.d[1][31999] = NaN; } },
  { name: 'Float32-export-overflow', edit: d => { d.d[0][31999] = 1e40; } },
  { name: 'short-reference', edit: d => { d.x[0] = d.x[0].slice(0, 31000); } },
  { name: 'legacy-drive-bound', edit: d => { d.x.forEach(x => { for (let i = 0; i < x.length; i++) x[i] *= 100; }); } },
];
export function auditNumericFailures() {
  return faults.map(({ name, edit }) => {
    const data = createData(11); edit(data);
    const engine = loadCore(() => data);
    let captured: { name: string; code: string; runId: string; message: string } | undefined;
    assert.throws(() => engine.calculateSync(DEFAULT_CONFIG, `fault-${name}`), (error: unknown) => {
      if (!(error instanceof engine.EngineError) || error.code !== 'NUMERIC_FAILURE' || error.runId !== `fault-${name}`) return false;
      captured = { name, code: error.code, runId: error.runId, message: error.message }; return true;
    });
    return captured!;
  });
}
