import * as THREE from 'three';

export interface MeshSection {
  cap: THREE.BufferGeometry | null;
  contour: THREE.BufferGeometry | null;
  closedLoops: number;
  openChains: number;
}

/** Intersect one mesh in its own coordinates. Never bridge contours belonging to different parts. */
export function sectionGeometry(geometry: THREE.BufferGeometry, plane: THREE.Plane, closedSolid: boolean): MeshSection {
  const empty = (): MeshSection => ({ cap: null, contour: null, closedLoops: 0, openChains: 0 });
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  if (!geometry.boundingBox?.intersectsPlane(plane)) return empty();
  const position = geometry.getAttribute('position'), indices = geometry.index;
  if (!position) return empty();
  const epsilon = 1e-5;
  const points: THREE.Vector3[] = [], welded = new Map<string, number>(), edges = new Map<string, [number, number]>();
  const planarEdges = new Map<string, { edge: [number, number]; positive: boolean; negative: boolean }>();
  const keyFor = (p: THREE.Vector3) => `${Math.round(p.x / epsilon)},${Math.round(p.y / epsilon)},${Math.round(p.z / epsilon)}`;
  function vertex(p: THREE.Vector3) {
    const key = keyFor(p), known = welded.get(key);
    if (known !== undefined) return known;
    const id = points.length; points.push(p.clone()); welded.set(key, id); return id;
  }
  function edge(a: number, b: number) {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`; edges.set(key, [a, b]);
  }
  const count = indices?.count ?? position.count;
  let hasPositive = false, hasNegative = false;
  const vertices = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let offset = 0; offset < count; offset += 3) {
    vertices.forEach((p, i) => p.fromBufferAttribute(position, indices ? indices.getX(offset + i) : offset + i));
    const distances = vertices.map(p => plane.distanceToPoint(p));
    const positive = distances.some(d => d > epsilon), negative = distances.some(d => d < -epsilon);
    hasPositive ||= positive; hasNegative ||= negative;
    const onPlane = distances.map(d => Math.abs(d) <= epsilon);
    if (onPlane.filter(Boolean).length === 2) {
      const ids = vertices.filter((_, i) => onPlane[i]).map(vertex), [a, b] = ids;
      if (a !== b) {
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        const previous = planarEdges.get(key) ?? { edge: [a, b], positive: false, negative: false };
        previous.positive ||= positive; previous.negative ||= negative; planarEdges.set(key, previous);
      }
    }
    if (!positive || !negative) continue;
    const intersections = new Set<number>();
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      if (onPlane[i]) intersections.add(vertex(vertices[i]));
      if (!onPlane[i] && !onPlane[j] && distances[i] * distances[j] < 0) {
        intersections.add(vertex(vertices[i].clone().lerp(vertices[j], distances[i] / (distances[i] - distances[j]))));
      }
    }
    if (intersections.size === 2) { const [a, b] = intersections; edge(a, b); }
  }
  // Pure tangencies / an existing coplanar face have no new cut area.
  if (!hasPositive || !hasNegative) return empty();
  planarEdges.forEach(value => { if (value.positive && value.negative) edge(...value.edge); });
  if (!edges.size) return empty();
  const contourVertices: number[] = [], neighbours = new Map<number, number[]>();
  edges.forEach(([a, b]) => {
    contourVertices.push(...points[a].toArray(), ...points[b].toArray());
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]); neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  });
  const contour = new THREE.BufferGeometry(); contour.setAttribute('position', new THREE.Float32BufferAttribute(contourVertices, 3));
  const visited = new Set<number>(), loops: number[][] = []; let openChains = 0;
  for (const start of neighbours.keys()) {
    if (visited.has(start)) continue;
    const component: number[] = [], stack = [start];
    while (stack.length) {
      const id = stack.pop()!; if (visited.has(id)) continue;
      visited.add(id); component.push(id); stack.push(...neighbours.get(id)!);
    }
    if (component.some(id => neighbours.get(id)!.length !== 2)) { openChains++; continue; }
    const loop = [start]; let previous = start, current = neighbours.get(start)![0];
    while (current !== start && loop.length <= component.length) {
      loop.push(current); const next = neighbours.get(current)!.find(id => id !== previous)!; previous = current; current = next;
    }
    if (current === start && loop.length >= 3) loops.push(loop); else openChains++;
  }
  if (!closedSolid || !loops.length) return { cap: null, contour, closedLoops: loops.length, openChains };
  const normal = plane.normal.clone().normalize();
  const u = new THREE.Vector3(Math.abs(normal.x) < 0.8 ? 1 : 0, Math.abs(normal.x) < 0.8 ? 0 : 1, 0).cross(normal).normalize();
  const v = normal.clone().cross(u).normalize();
  const projected = loops.map(loop => loop.map(id => new THREE.Vector2(points[id].dot(u), points[id].dot(v))));
  const areas = projected.map(loop => Math.abs(THREE.ShapeUtils.area(loop)));
  function inside(p: THREE.Vector2, polygon: THREE.Vector2[]) {
    let contained = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) contained = !contained;
    }
    return contained;
  }
  const parents = projected.map((loop, i) => {
    let parent = -1;
    projected.forEach((candidate, j) => { if (areas[j] > areas[i] + epsilon * epsilon && inside(loop[0], candidate) && (parent < 0 || areas[j] < areas[parent])) parent = j; });
    return parent;
  });
  const depths = parents.map((parent) => { let depth = 0; while (parent >= 0) { depth++; parent = parents[parent]; } return depth; });
  const capVertices: number[] = [], normals: number[] = [], uv: number[] = [];
  projected.forEach((outer, i) => {
    if (depths[i] % 2 || areas[i] < epsilon * epsilon) return;
    const holeIds = parents.map((p, j) => p === i && depths[j] === depths[i] + 1 ? j : -1).filter(j => j >= 0);
    const flatIds = [...loops[i], ...holeIds.flatMap(j => loops[j])];
    for (const triangle of THREE.ShapeUtils.triangulateShape(outer, holeIds.map(j => projected[j]))) {
      const ids = triangle.map(id => flatIds[id]);
      const faceNormal = points[ids[1]].clone().sub(points[ids[0]]).cross(points[ids[2]].clone().sub(points[ids[0]]));
      if (faceNormal.lengthSq() < epsilon ** 4) continue;
      if (faceNormal.dot(normal) > 0) [ids[1], ids[2]] = [ids[2], ids[1]];
      ids.forEach(id => { const p = points[id]; capVertices.push(...p.toArray()); normals.push(-normal.x, -normal.y, -normal.z); uv.push(p.dot(u), p.dot(v)); });
    }
  });
  if (!capVertices.length) return { cap: null, contour, closedLoops: loops.length, openChains };
  const cap = new THREE.BufferGeometry(); cap.setAttribute('position', new THREE.Float32BufferAttribute(capVertices, 3));
  cap.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); cap.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return { cap, contour, closedLoops: loops.length, openChains };
}
