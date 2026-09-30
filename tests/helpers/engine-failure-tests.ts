import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../../src/shared/defaults';
import { createData } from '../../src/team-b/engine/data';
import { loadCore } from './engine-harness';
import { auditInvalidConfigs, auditValidConfigs, auditNumericFailures } from './engine-failure-audit';

test('B1-003: invalid shapes, every missing/fixed field and nonfinite values return structured config errors', () => {
  auditInvalidConfigs();
});
test('B1-003: all 12 legal configurations have finite isolated Float32 channels and exact zero-step identities', () => {
  assert.equal(auditValidConfigs().length, 12);
});
test('B1-003: nonfinite data, short arrays, drive failure and Float32 overflow never return partial success', () => {
  assert.equal(auditNumericFailures().length, 7);
});
test('B1-003: a failed call preserves prior results and cannot poison the next run', () => {
  let fail = false;
  const engine = loadCore(seed => {
    const data = createData(seed); if (fail) data.d[0][31999] = NaN; return data;
  });
  const previous = engine.calculateSync(DEFAULT_CONFIG, 'previous');
  const saved = structuredClone(previous.signals);
  fail = true;
  assert.throws(() => engine.calculateSync(DEFAULT_CONFIG, 'failed'), (error: unknown) =>
    error instanceof engine.EngineError && error.code === 'NUMERIC_FAILURE' && error.runId === 'failed');
  assert.deepEqual(previous.signals, saved);
  fail = false;
  const next = engine.calculateSync(DEFAULT_CONFIG, 'next');
  assert.equal(previous.runId, 'previous'); assert.equal(next.runId, 'next');
  assert.deepEqual(next.signals, saved); assert.deepEqual(next.metrics, previous.metrics);
  next.signals.e[0][100] = 123;
  assert.deepEqual(previous.signals, saved);
});
