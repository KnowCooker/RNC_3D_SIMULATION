import assert from 'node:assert/strict';
import test from 'node:test';
import type { FieldFrame } from '../src/shared/lab-contracts';
import { createFieldPoints, createFieldSliceTopology, fieldFrameMatchesPoints } from '../src/team-a/viewer/field-slices';

test('three slice meshes use the original 280 queried positions, including their fixed physical planes', () => {
  const points = createFieldPoints();
  assert.equal(points.length, 280);
  const sizes = { x: [5, 8, 40, 56], y: [7, 8, 56, 84], z: [7, 5, 35, 48] } as const;
  for (const axis of ['x', 'y', 'z'] as const) {
    const slice = createFieldSliceTopology(axis, points);
    const [rows, columns, samples, triangles] = sizes[axis];
    assert.deepEqual([slice.rows, slice.columns, slice.sampleIndices.length, slice.triangles.length / 3], [rows, columns, samples, triangles]);
    assert.ok(slice.triangles.every(vertex => vertex >= 0 && vertex < samples));
    slice.sampleIndices.forEach((sample, i) => {
      const expected = points[sample];
      const actual = Array.from(slice.positions.slice(i * 3, i * 3 + 3));
      actual.forEach((coordinate, dimension) => assert.ok(Math.abs(coordinate - expected[dimension]) < 1e-6));
      assert.ok(Math.abs(expected[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] - (axis === 'x' ? 0 : axis === 'y' ? 1.48 : 0.54)) < 1e-6);
    });
  }
});

test('a reordered, truncated or non-finite B field frame cannot color the old locations', () => {
  const points = createFieldPoints();
  const values = Float32Array.from(points, (_, i) => 40 + i / 30);
  const frame: FieldFrame = { time: 1, valid: true, points: [...points], primarySpl: values, residualSpl: values.slice(), reductionDb: values.slice() };
  assert.equal(fieldFrameMatchesPoints(frame, points), true);
  const swapped = { ...frame, points: [...points] }; [swapped.points[0], swapped.points[1]] = [swapped.points[1], swapped.points[0]];
  assert.equal(fieldFrameMatchesPoints(swapped, points), false);
  assert.equal(fieldFrameMatchesPoints({ ...frame, residualSpl: values.slice(1) }, points), false);
  const nonFinite = { ...frame, primarySpl: values.slice() }; nonFinite.primarySpl[0] = Number.NaN;
  assert.equal(fieldFrameMatchesPoints(nonFinite, points), false);
  assert.equal(fieldFrameMatchesPoints({ ...frame, valid: false }, points), false);
});
