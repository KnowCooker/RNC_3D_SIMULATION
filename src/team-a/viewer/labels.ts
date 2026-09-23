type Point = { x: number; y: number };

/** Place fixed 64 × 24 labels near projected hardware, without overlapping labels. */
export function placeLabels(anchors: readonly Point[], width: number, height: number): Point[] {
  const placed: Point[] = [];
  const maxX = Math.max(4, width - 68), maxY = Math.max(4, height - 28);
  const clamp = (point: Point): Point => ({ x: Math.max(4, Math.min(maxX, point.x)), y: Math.max(4, Math.min(maxY, point.y)) });
  const available = (point: Point) => placed.every(other =>
    point.x + 68 <= other.x || other.x + 68 <= point.x || point.y + 28 <= other.y || other.y + 28 <= point.y);
  for (const anchor of anchors) {
    const preferred = clamp({ x: anchor.x - 32, y: anchor.y - 34 });
    const candidates = [preferred];
    // A bounded viewport grid also resolves coincident projections (e.g. a side view).
    for (let y = 4; y <= maxY; y += 28) for (let x = 4; x <= maxX; x += 68) candidates.push({ x, y });
    candidates.sort((a, b) => Math.hypot(a.x - preferred.x, a.y - preferred.y) - Math.hypot(b.x - preferred.x, b.y - preferred.y));
    placed.push(candidates.find(available) ?? preferred);
  }
  return placed;
}
