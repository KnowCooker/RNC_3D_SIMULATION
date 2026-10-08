/** Legacy grid is retained for historical fixtures and callers. */
export interface FieldGrid { readonly x: number; readonly y: number; readonly z: number }
export const LEGACY_FIELD_GRID: FieldGrid = { x: 7, y: 5, z: 8 };
/** 1,989 independent engine queries; texture interpolation adds no physical samples. */
export const DENSE_FIELD_GRID: FieldGrid = { x: 13, y: 9, z: 17 };
export const gridCount = (grid: FieldGrid) => grid.x * grid.y * grid.z;
export function gridForCount(count: number): FieldGrid {
  const grid = [LEGACY_FIELD_GRID, DENSE_FIELD_GRID].find(value => gridCount(value) === count);
  if (!grid) throw Error('Unsupported field grid size');
  return grid;
}
export const gridCenters = (grid: FieldGrid) => ({
  x: Math.round((grid.x - 1) * .5), y: Math.round((grid.y - 1) * .75), z: Math.round((grid.z - 1) * 6 / 7),
});
