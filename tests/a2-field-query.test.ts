import test from 'node:test';
import assert from 'node:assert/strict';
import { queryFieldGrid } from '../src/team-a/lab/field-query';
import type { AcousticWeighting, FieldFrame, Vec3 } from '../src/shared/lab-contracts';
import { createFieldPoints } from '../src/team-a/viewer/field-slices';
import { DENSE_FIELD_GRID } from '../src/team-a/viewer/field-grid';

const points = createFieldPoints(DENSE_FIELD_GRID);
const reply = (at: number, batch: Vec3[], weighting: AcousticWeighting): FieldFrame => ({
  time: Math.floor(at * 2000) / 2000, layoutId: 'xpeng-p7plus-bev-v1', weighting, valid: true, points: batch,
  primarySpl: Float32Array.from(batch, p => 60 + p[0]), residualSpl: Float32Array.from(batch, p => 56 + p[0]), reductionDb: new Float32Array(batch.length).fill(4),
});

test('dense queries yield in bounded batches and publish the original point order at one window', async () => {
  let calls = 0; const times = new Set<number>();
  const frame = await queryFieldGrid(async (at, batch, w) => {
    calls++; times.add(at); assert.ok(batch.length <= 192); return reply(at, batch, w);
  }, 3.1279, points, 'A', 2000, () => true);
  assert.equal(calls, 11); assert.equal(times.size, 1); assert.equal(frame.time, 3.1275);
  assert.equal(frame.points, points); assert.equal(frame.primarySpl.length, 1989);
  frame.primarySpl.forEach((value, i) => assert.ok(Math.abs(value - (60 + points[i][0])) < 1e-5));
});

test('a late query is cancelled before more chunks are submitted', async () => {
  let calls = 0;
  await assert.rejects(queryFieldGrid(async (at, batch, w) => { calls++; return reply(at, batch, w); }, 3, points, 'A', 2000, () => calls < 2), /superseded/);
  assert.equal(calls, 2);
});

test('different windows, weighting, positions and layout cannot be merged into one field', async () => {
  for (const change of [
    (f: FieldFrame) => ({...f, time: f.time + .0005}),
    (f: FieldFrame) => ({...f, weighting: 'Z' as const}),
    (f: FieldFrame) => ({...f, layoutId: 'foreign'}),
    (f: FieldFrame) => ({...f, points: [...f.points].reverse()}),
  ]) {
    let calls = 0;
    await assert.rejects(queryFieldGrid(async (at, batch, w) => {
      const f = reply(at, batch, w); return ++calls === 2 ? change(f) : f;
    }, 3, points, 'A', 2000, () => true), /声场分批/);
  }
});

test('an invalid warm-up grid stays invalid instead of becoming a coloured result', async () => {
  const f = await queryFieldGrid(async (at, batch, w) => ({...reply(at, batch, w), valid: false,
    primarySpl: new Float32Array(batch.length).fill(NaN), residualSpl: new Float32Array(batch.length).fill(NaN), reductionDb: new Float32Array(batch.length).fill(NaN),
  }), .25, points, 'A', 2000, () => true);
  assert.equal(f.valid, false); assert.ok(f.primarySpl.every(Number.isNaN));
});
