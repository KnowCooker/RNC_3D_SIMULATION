type Point = { x: number; y: number };

/** Keep the dense lab-v3 hardware list outside the central vehicle silhouette. */
export function placeLabLabels(anchors: readonly Point[], width: number, height: number): Point[] {
  // Put dense lab labels beside the car. Keep their correspondence with the
  // projected hardware through leader lines, rather than covering the cabin.
  if (width >= 320 && height >= 240 && anchors.length <= 2 * Math.floor((height - 8) / 28)) {
    const rails: { index: number; anchor: Point }[][] = [[], []];
    const capacity = Math.floor((height - 8) / 28);
    anchors.forEach((anchor, index) => {
      let side = anchor.x < width / 2 ? 0 : 1;
      if (Math.abs(anchor.x - width / 2) < 20) side = rails[0].length <= rails[1].length ? 0 : 1;
      if (rails[side].length >= capacity) side = 1 - side;
      rails[side].push({ index, anchor });
    });
    const result: Point[] = Array(anchors.length);
    rails.forEach((rail, side) => {
      rail.sort((a, b) => a.anchor.y - b.anchor.y || a.index - b.index);
      const top = Math.max(4, height - 28);
      const ys = rail.map(({ anchor }) => Math.max(4, Math.min(top, anchor.y - 12)));
      for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + 28);
      if (ys.length && ys.at(-1)! > top) {
        ys[ys.length - 1] = top;
        for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - 28);
      }
      rail.forEach(({ index }, i) => { result[index] = { x: side === 0 ? 4 : width - 68, y: ys[i] }; });
    });
    return result;
  }
  return placeLabels(anchors, width, height);
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
