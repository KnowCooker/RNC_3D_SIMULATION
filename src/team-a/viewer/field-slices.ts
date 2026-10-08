import type { FieldFrame, Vec3 } from '../../shared/lab-contracts';

import { LEGACY_FIELD_GRID, gridForCount, gridCenters, type FieldGrid } from './field-grid';

export type SliceAxis = 'x' | 'y' | 'z';


/** Keep the exact point order sent to the field worker: x outermost, z innermost. */
export function createFieldPoints(counts: FieldGrid = LEGACY_FIELD_GRID): Vec3[] {
  const points: Vec3[] = [];
  for (let x = 0; x < counts.x; x++) for (let y = 0; y < counts.y; y++) for (let z = 0; z < counts.z; z++) {
    points.push([-0.72 + x * (1.44 / (counts.x - 1)), 0.85 + y * (.84 / (counts.y - 1)), -1.2 + z * (2.03 / (counts.z - 1))]);
  }
  return points;
}

/** Move only the selected queried plane; retain the grid's point order. */
export function createFieldPointsForSlice(axis: SliceAxis, coordinate: number, counts: FieldGrid = LEGACY_FIELD_GRID): Vec3[] {
  if (!Number.isFinite(coordinate)) throw Error('Field slice coordinate must be finite');
  const points = createFieldPoints(counts), centers = gridCenters(counts);
  const component = { x: 0, y: 1, z: 2 }[axis];
  const layer = centers[axis];
  for (let x = 0; x < counts.x; x++) for (let y = 0; y < counts.y; y++) for (let z = 0; z < counts.z; z++) {
    if ([x, y, z][component] !== layer) continue;
    const sample = index(x, y, z, counts), point = points[sample];
    points[sample] = component === 0 ? [coordinate, point[1], point[2]]
      : component === 1 ? [point[0], coordinate, point[2]] : [point[0], point[1], coordinate];
  }
  return points;
}

const index = (x: number, y: number, z: number, counts: FieldGrid) => (x * counts.y + y) * counts.z + z;

export interface FieldSliceTopology {
  axis: SliceAxis;
  sampleIndices: number[];
  positions: Float32Array;
  triangles: number[];
  rows: number;
  columns: number;
}

/** Every vertex is an actual queried field point; only triangle interiors are display interpolation. */
export function createFieldSliceTopology(axis: SliceAxis, points: readonly Vec3[]): FieldSliceTopology {
  const counts = gridForCount(points.length), centers = gridCenters(counts);
  const rows = axis === 'x' ? counts.y : counts.x;
  const columns = axis === 'z' ? counts.y : counts.z;
  const sampleIndices: number[] = [];
  const positions = new Float32Array(rows * columns * 3);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const sample = axis === 'x' ? index(centers.x, row, column, counts)
      : axis === 'y' ? index(row, centers.y, column, counts)
        : index(row, column, centers.z, counts);
    sampleIndices.push(sample);
    positions.set(points[sample], sampleIndices.length * 3 - 3);
  }
  const triangles: number[] = [];
  for (let row = 0; row < rows - 1; row++) for (let column = 0; column < columns - 1; column++) {
    const a = row * columns + column, b = a + columns;
    triangles.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { axis, sampleIndices, positions, triangles, rows, columns };
}

/** Refuse a stale/reordered field frame instead of coloring the wrong physical locations. */
export function fieldFrameMatchesPoints(frame: FieldFrame, points: readonly Vec3[]): boolean {
  if (!frame.valid || frame.points.length !== points.length || frame.primarySpl.length !== points.length || frame.residualSpl.length !== points.length) return false;
  return points.every(([x, y, z], i) => {
    const actual = frame.points[i];
    return !!actual && Math.abs(actual[0] - x) < 1e-5 && Math.abs(actual[1] - y) < 1e-5 && Math.abs(actual[2] - z) < 1e-5
      && Number.isFinite(frame.primarySpl[i]) && Number.isFinite(frame.residualSpl[i]);
  });
}
