type Point = { x: number; y: number };
export type LabelObstacle = { x: number; y: number; width: number; height: number };
export type LabLabelPosition = Point & { hidden?: boolean };

/** Near-car callouts avoid actual interface panels, rather than the viewport edges.
 * A label with no available space is suppressed, while its 3D marker stays selectable. */
export function placeLabLabels(anchors: readonly Point[], width: number, height: number, obstacles: readonly LabelObstacle[] = []): LabLabelPosition[] {
  if (!anchors.length) return [];
  const maxX = Math.max(4, width - 68), maxY = Math.max(4, height - 28);
  const clampX = (x: number) => Math.max(4, Math.min(maxX, x));
  const left = Math.min(...anchors.map(p => p.x)), right = Math.max(...anchors.map(p => p.x));
  const center = (left + right) / 2;
  const rails = [clampX(left - 84), clampX(right + 20)];
  const placed: LabLabelPosition[] = Array(anchors.length);
  const used: Point[] = [];
  const available = (p: Point) => p.x >= 4 && p.x <= maxX && p.y >= 4 && p.y <= maxY
    && used.every(q => p.x + 68 <= q.x || q.x + 68 <= p.x || p.y + 28 <= q.y || q.y + 28 <= p.y)
    && obstacles.every(q => p.x + 68 <= q.x || q.x + q.width + 4 <= p.x || p.y + 28 <= q.y || q.y + q.height + 4 <= p.y);
  // Stable vertical ordering keeps leaders from repeatedly swapping while orbiting.
  const order = anchors.map((anchor, index) => ({ anchor, index })).sort((a, b) => a.anchor.y - b.anchor.y || a.index - b.index);
  for (const { anchor, index } of order) {
    const side = anchor.x < center ? 0 : anchor.x > center ? 1 : index % 2;
    const idealY = Math.max(4, Math.min(maxY, anchor.y - 12));
    let best: Point | undefined, score = Infinity;
    const consider = (p: Point, penalty = 0) => {
      if (!available(p)) return;
      const distance = Math.hypot(p.x + 32 - anchor.x, p.y + 12 - anchor.y) + penalty;
      if (distance < score) { best = p; score = distance; }
    };
    for (let rail = 0; rail < rails.length; rail++) {
      consider({ x: rails[rail], y: idealY }, rail === side ? 0 : 24);
      for (let y = 4; y <= maxY; y += 28) consider({ x: rails[rail], y }, rail === side ? 0 : 24);
    }
    // A sidebar may cover an entire rail. Place in the remaining work area,
    // preferring short leaders to sending the label to the opposite screen edge.
    if (!best || score > 200) {
      for (let y = 4; y <= maxY; y += 28) for (let x = 4; x <= maxX; x += 68) {
        consider({ x, y }, x + 64 > left && x < right ? 36 : 0);
      }
    }
    placed[index] = best ?? { x: clampX(anchor.x - 32), y: idealY, hidden: true };
    if (best) used.push(best);
  }
  return placed;
}

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
