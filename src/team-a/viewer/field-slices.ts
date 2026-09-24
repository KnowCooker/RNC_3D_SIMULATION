import type { FieldFrame, Vec3 } from '../../shared/lab-contracts';

export type SliceAxis = 'x' | 'y' | 'z';

const counts = { x: 7, y: 5, z: 8 } as const;
const centers = { x: 3, y: 3, z: 6 } as const;

/** Keep the exact point order sent to the field worker: x outermost, z innermost. */
export function createFieldPoints(): Vec3[] {
  const points: Vec3[] = [];
  for (let x = 0; x < counts.x; x++) for (let y = 0; y < counts.y; y++) for (let z = 0; z < counts.z; z++) {
    points.push([-0.72 + x * 0.24, 0.85 + y * 0.21, -1.2 + z * 0.29]);
  }
  return points;
}

/** Move only the displayed slice's queried plane; retain the 280-point worker layout. */
export function createFieldPointsForSlice(axis: SliceAxis, coordinate: number): Vec3[] {
  if (!Number.isFinite(coordinate)) throw Error('Field slice coordinate must be finite');
  const points = createFieldPoints();
  const component = { x: 0, y: 1, z: 2 }[axis];
  const layer = centers[axis];
  for (let x = 0; x < counts.x; x++) for (let y = 0; y < counts.y; y++) for (let z = 0; z < counts.z; z++) {
    if ([x, y, z][component] !== layer) continue;
    const sample = index(x, y, z), point = points[sample];
    points[sample] = component === 0 ? [coordinate, point[1], point[2]]
      : component === 1 ? [point[0], coordinate, point[2]] : [point[0], point[1], coordinate];
  }
  return points;
}

const index = (x: number, y: number, z: number) => (x * counts.y + y) * counts.z + z;

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
  if (points.length !== counts.x * counts.y * counts.z) throw Error('Field sample grid is incomplete');
  const rows = axis === 'x' ? counts.y : counts.x;
  const columns = axis === 'z' ? counts.y : counts.z;
  const sampleIndices: number[] = [];
  const positions = new Float32Array(rows * columns * 3);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const sample = axis === 'x' ? index(centers.x, row, column)
      : axis === 'y' ? index(row, centers.y, column)
        : index(row, column, centers.z);
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
