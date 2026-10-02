import test from 'node:test';
import assert from 'node:assert/strict';
import type { FieldFrame } from '../src/shared/lab-contracts';
import { DENSE_FIELD_GRID, gridCount } from '../src/team-a/viewer/field-grid';
import { createFieldPoints, createFieldSliceTopology, fieldFrameMatchesPoints } from '../src/team-a/viewer/field-slices';
import { packFieldVolume, displayEnergy } from '../src/team-a/viewer/field-display-data';
import { createFieldDisplay } from '../src/team-a/viewer/field-display';

const points = createFieldPoints(DENSE_FIELD_GRID);
const frame = (time: number, db: number): FieldFrame => ({
  layoutId: 'xpeng-p7plus-bev-v1', weighting: 'A', valid: true, time, points,
  primarySpl: new Float32Array(points.length).fill(db),
  residualSpl: new Float32Array(points.length).fill(db - 4),
  reductionDb: new Float32Array(points.length).fill(4),
});

test('dense grid queries 1989 distinct locations across the original spatial extent', () => {
  assert.equal(points.length, 1989);
  assert.equal(new Set(points.map(p => p.join(','))).size, gridCount(DENSE_FIELD_GRID));
  assert.deepEqual(points[0], createFieldPoints()[0]);
  assert.deepEqual(points.at(-1), createFieldPoints().at(-1));
  for (const axis of ['x', 'y', 'z'] as const) {
    const topology = createFieldSliceTopology(axis, points);
    topology.sampleIndices.forEach((sample, i) => points[sample].forEach((v, j) =>
      assert.ok(Math.abs(topology.positions[i * 3 + j] - v) < 1e-6)));
  }
  assert.equal(fieldFrameMatchesPoints(frame(2, 60), createFieldPoints()), false);
});

test('dense texture retains the exact engine point order and paired channel energy', () => {
  const f = frame(2, 60);
  f.primarySpl = Float32Array.from(points, (_, i) => 40 + i / 100);
  const texture = packFieldVolume(f), {x: nx, y: ny, z: nz} = DENSE_FIELD_GRID;
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
    const sample = (x * ny + y) * nz + z, texel = ((z * ny + y) * nx + x) * 2;
    assert.ok(Math.abs(60 + 10 * Math.log10(texture[texel]) - f.primarySpl[sample]) < 1e-5);
    assert.ok(Math.abs(60 + 10 * Math.log10(texture[texel + 1]) - f.residualSpl[sample]) < 1e-5);
  }
});

test('volume mode contains no visible planar slices; explicit slices remain available', () => {
  const view = createFieldDisplay(points, true);
  view.update(frame(1, 60), 'residual', 'volume', [30, 80]);
  assert.equal(view.volume.visible, true);
  assert.equal([...view.slices.values()].some(row => row.mesh.visible), false);
  view.update(frame(1, 60), 'residual', 'y', [30, 80]);
  assert.equal(view.volume.visible, false);
  assert.equal(view.slices.get('y')!.mesh.visible, true);
  assert.equal(view.slices.get('x')!.mesh.visible, false);
  view.dispose();
});

test('temporal transition blends energy and a replacement starts at the displayed energy', () => {
  const view = createFieldDisplay(points, true), u = view.volume.material.uniforms;
  view.advance(1, true); view.update(frame(1, 40), 'residual', 'volume', [30, 80], true);
  view.advance(1.1, true); view.update(frame(1.1, 60), 'residual', 'volume', [30, 80], true);
  view.advance(1.15, true); assert.ok(Math.abs(view.blend - .5) < 1e-10);
  const expected = (displayEnergy(40) + displayEnergy(60)) / 2;
  view.update(frame(1.2, 70), 'residual', 'volume', [30, 80], true);
  assert.ok(Math.abs(u.previousSamples.value.image.data[0] - expected) < 1e-6);
  assert.equal(view.blend, 0);
  view.advance(1.16, false); assert.equal(view.blend, 1);
  view.dispose();
});

test('rewind, weighting, layout and point changes never blend incompatible frames', () => {
  const view = createFieldDisplay(points, false);
  view.update(frame(3, 60), 'residual', 'volume', [30, 80], true);
  for (const f of [frame(2, 45), {...frame(4, 50), weighting: 'Z' as const}, {...frame(5, 55), layoutId: 'foreign'}]) {
    view.update(f, 'residual', 'volume', [30, 80], true);
    assert.equal(view.blend, 1);
  }
  view.setPoints(points); view.update(frame(6, 70), 'residual', 'volume', [30, 80], true);
  assert.equal(view.blend, 1);
  view.clear(); view.update(frame(7, 50), 'residual', 'volume', [30, 80], true);
  assert.equal(view.blend, 1);
  view.dispose();
});
