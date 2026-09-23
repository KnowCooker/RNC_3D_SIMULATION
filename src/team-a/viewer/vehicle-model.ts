import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type VehicleKind = 'ice' | 'bev' | 'hev' | 'erev';
export interface VehiclePart {
  object: THREE.Object3D;
  origin: THREE.Vector3;
  offset: THREE.Vector3;
  category: string;
  name: string;
}
export interface VehicleModel {
  group: THREE.Group;
  parts: VehiclePart[];
  shell: THREE.Mesh[];
  wheels: THREE.Object3D[];
  materials: THREE.Material[];
  dispose(): void;
}
type V3 = [number, number, number];

/** Original teaching geometry; layout sources and accuracy limits: docs/research/vehicle-architectures.md. */
export function createVehicleModel(kind: VehicleKind): VehicleModel {
  if (!['ice', 'bev', 'hev', 'erev'].includes(kind)) throw new Error(`Unsupported vehicle: ${kind}`);
  const group = new THREE.Group(); group.name = `teaching-suv-${kind}`;
  group.userData = { vehicleKind: kind, originalDesign: true, seats: 5, rows: 2 };
  const parts: VehiclePart[] = [], shell: THREE.Mesh[] = [], wheels: THREE.Object3D[] = [];
  const materials: THREE.Material[] = [], geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
  const shellMaterialCopies = new Map<THREE.Material, THREE.Material>();
  const standard = (color: string, roughness = 0.55, metalness = 0.15) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.push(m); return m;
  };
  const paint = new THREE.MeshPhysicalMaterial({ color: { ice: '#466883', bev: '#90b7c1', hev: '#658c7b', erev: '#956b6b' }[kind], metalness: 0.52, roughness: 0.27, clearcoat: 0.8, clearcoatRoughness: 0.16 });
  materials.push(paint);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#88c6d8', transparent: true, opacity: 0.28, metalness: 0.18, roughness: 0.18, side: THREE.DoubleSide, depthWrite: false });
  materials.push(glass);
  const dark = standard('#162530', 0.82), black = standard('#111920', 0.95, 0), steel = standard('#778b98', 0.42, 0.65);
  const underbody = standard('#425562', 0.8, 0.15);
  const trim = standard('#c1d3da', 0.3, 0.8), fabric = standard('#263542', 0.86, 0), insert = standard('#506670', 0.88, 0);
  const copper = standard('#f59039', 0.4, 0.5), battery = standard('#209e91', 0.45, 0.5), engine = standard('#a8adb2', 0.5, 0.55);
  const blue = standard('#398bb8', 0.35, 0.5), red = standard('#bd594f', 0.6, 0.1);
  const headlamp = standard('#d8f5ff', 0.23); headlamp.emissive.set('#d2efff'); headlamp.emissiveIntensity = 1.2;
  const taillamp = standard('#bd302e', 0.23); taillamp.emissive.set('#d44131'); taillamp.emissiveIntensity = 0.8;
  const indicator = standard('#b86b2a', 0.31); indicator.emissive.set('#e79639'); indicator.emissiveIntensity = 0.5;
  const display = standard('#162d42', 0.3); display.emissive.set('#183f53'); display.emissiveIntensity = 0.4;
  const screenAccent = standard('#80c7d8', 0.38, 0.08); screenAccent.emissive.set('#4b91a6'); screenAccent.emissiveIntensity = 0.38;
  const screenMuted = standard('#536f7e', 0.7, 0.05);
  const softTrim = standard('#344650', 0.9, 0);
  const weave = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4, value = 125 + ((x + 2 * y) % 4 < 2 ? 45 : -35);
    weave[i] = weave[i + 1] = weave[i + 2] = value; weave[i + 3] = 255;
  }
  const upholsteryTexture = new THREE.DataTexture(weave, 64, 64); upholsteryTexture.wrapS = upholsteryTexture.wrapT = THREE.RepeatWrapping;
  upholsteryTexture.repeat.set(8, 8); upholsteryTexture.needsUpdate = true; textures.add(upholsteryTexture);
  fabric.bumpMap = insert.bumpMap = upholsteryTexture; fabric.bumpScale = insert.bumpScale = 0.002;
  // Original procedural tread relief. It affects only the wheel rubber, not the vehicle structure or NVH model.
  const treadPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const band = y < 13 || y > 51;
    const groove = band && ((x + Math.floor(y / 4) * 3) % 9 < 2 || x % 24 < 2);
    const value = groove ? 65 : band ? 150 : 125;
    const i = (y * 64 + x) * 4;
    treadPixels[i] = treadPixels[i + 1] = treadPixels[i + 2] = value; treadPixels[i + 3] = 255;
  }
  const treadTexture = new THREE.DataTexture(treadPixels, 64, 64);
  treadTexture.wrapS = treadTexture.wrapT = THREE.RepeatWrapping; treadTexture.repeat.set(3, 1);
  treadTexture.minFilter = treadTexture.magFilter = THREE.LinearFilter; treadTexture.needsUpdate = true; textures.add(treadTexture);
  const tireRubber = standard('#1a2127', 0.98, 0); tireRubber.name = 'procedural-tread-rubber';
  tireRubber.bumpMap = treadTexture; tireRubber.bumpScale = 0.023;
  const stitching = new THREE.LineBasicMaterial({ color: '#ddc9aa', transparent: true, opacity: 0.8 }); materials.push(stitching);
  const screenStroke = new THREE.LineBasicMaterial({ color: '#80c7d8' }); materials.push(screenStroke);

  function part(id: string, name: string, category: string, offset: V3, position: V3 = [0, 0, 0], description = '') {
    const object = new THREE.Group(); object.name = id; object.position.set(...position);
    object.userData = { component: id, description, category, label: name }; group.add(object);
    parts.push({ object, origin: object.position.clone(), offset: new THREE.Vector3(...offset), category, name }); return object;
  }
  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: V3 = [0, 0, 0], isShell = false) {
    // Shell opacity must never mutate a shared tire, upholstery or instrument material.
    if (isShell && material !== paint && material !== glass) {
      if (!shellMaterialCopies.has(material)) { const copy = material.clone(); materials.push(copy); shellMaterialCopies.set(material, copy); }
      material = shellMaterialCopies.get(material)!;
    }
    geometries.add(geometry);
    if (geometry.userData.sectionClosed === undefined) geometry.userData.sectionClosed = ['BoxGeometry', 'RoundedBoxGeometry', 'CylinderGeometry', 'TorusGeometry', 'ExtrudeGeometry', 'SphereGeometry'].includes(geometry.type);
    const object = new THREE.Mesh(geometry, material); object.position.set(...position);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); if (isShell) shell.push(object); return object;
  }
  function box(parent: THREE.Object3D, size: V3, pos: V3, material = steel, radius = 0.025, isShell = false) {
    return mesh(parent, radius ? new RoundedBoxGeometry(...size, 1, radius) : new THREE.BoxGeometry(...size), material, pos, isShell);
  }
  function appendShell(object: THREE.Mesh) {
    const material = object.material as THREE.Material;
    if (material !== paint && material !== glass) {
      if (!shellMaterialCopies.has(material)) { const copy = material.clone(); materials.push(copy); shellMaterialCopies.set(material, copy); }
      object.material = shellMaterialCopies.get(material)!;
    }
    shell.push(object); return object;
  }
  function cylinder(parent: THREE.Object3D, radius: number, length: number, pos: V3, material = steel, axis = 'x', segments = 20) {
    const object = mesh(parent, new THREE.CylinderGeometry(radius, radius, length, segments), material, pos);
    if (axis === 'x') object.rotation.z = Math.PI / 2; else if (axis === 'z') object.rotation.x = Math.PI / 2; return object;
  }
  function tube(parent: THREE.Object3D, points: V3[], radius: number, material = steel) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.min(96, Math.max(10, points.length * 5)), radius, 6, false), material);
  }
  function rod(parent: THREE.Object3D, a: V3, b: V3, radius: number, material = steel) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
    const object = cylinder(parent, radius, delta.length(), av.add(bv).multiplyScalar(0.5).toArray() as V3, material, 'y', 10);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return object;
  }
  function panel(parent: THREE.Object3D, corners: V3[], material: THREE.Material, isShell = true) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals(); return mesh(parent, geometry, material, [0, 0, 0], isShell);
  }
  function glassSeal(parent: THREE.Object3D, points: V3[]) {
    const vertices = points.map(point => new THREE.Vector3(...point));
    const curve = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < vertices.length; i++) curve.add(new THREE.LineCurve3(vertices[i], vertices[(i + 1) % vertices.length]));
    return mesh(parent, new THREE.TubeGeometry(curve, 8, 0.006, 3, true), dark, [0, 0, 0], true);
  }
  function curvedPanel(parent: THREE.Object3D, width: number, z0: number, z1: number, y0: number, y1: number, crown: number) {
    const vertices: number[] = [], nx = 12, nz = 8;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx * 2 - 1, t = j / nz;
      vertices.push(u * width / 2 * (0.95 + 0.05 * Math.sin(t * Math.PI)), y0 + (y1 - y0) * t + crown * (1 - u * u) + 0.018 * Math.sin(t * Math.PI), z0 + (z1 - z0) * t);
    }
    return mesh(parent, skinGeometry(vertices, nx, nz, [0, -0.006, 0]), paint, [0, 0, 0], true);
  }
  function skinGeometry(surface: number[], nx: number, nz: number, thickness: V3) {
    const vertices = [...surface], indices: number[] = [], count = surface.length / 3;
    for (let i = 0; i < count; i++) vertices.push(surface[i * 3] + thickness[0], surface[i * 3 + 1] + thickness[1], surface[i * 3 + 2] + thickness[2]);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + nx + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1, a + count, a + 1 + count, b + count, a + 1 + count, b + 1 + count, b + count);
    }
    const boundary: number[] = [];
    for (let i = 0; i <= nx; i++) boundary.push(i);
    for (let j = 1; j <= nz; j++) boundary.push(j * (nx + 1) + nx);
    for (let i = nx - 1; i >= 0; i--) boundary.push(nz * (nx + 1) + i);
    for (let j = nz - 1; j > 0; j--) boundary.push(j * (nx + 1));
    boundary.forEach((a, i) => { const b = boundary[(i + 1) % boundary.length]; indices.push(a, b, a + count, b, b + count, a + count); });
    const first = new THREE.Vector3().fromArray(vertices, indices[0] * 3), second = new THREE.Vector3().fromArray(vertices, indices[1] * 3), third = new THREE.Vector3().fromArray(vertices, indices[2] * 3);
    if (second.sub(first).cross(third.sub(first)).dot(new THREE.Vector3(...thickness)) > 0) {
      for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.userData.sectionClosed = true; return geometry;
  }
  function seam(parent: THREE.Object3D, points: V3[]) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))); geometries.add(geometry);
    const line = new THREE.Line(geometry, stitching); parent.add(line);
  }
  function screenRing(parent: THREE.Object3D, x: number, y: number, z: number, radius: number) {
    const points = Array.from({ length: 24 }, (_, i) => {
      const angle = i / 24 * Math.PI * 2;
      return new THREE.Vector3(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z);
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points); geometries.add(geometry);
    parent.add(new THREE.LineLoop(geometry, screenStroke));
  }

  // A continuous cushion skin keeps the seat silhouette curved without moving the
  // seat part or the four microphone anchors attached to its headrests.
  function cushionSkin(parent: THREE.Object3D, x: number, z: number, width: number, depth: number, material: THREE.Material, inlay = false) {
    const vertices: number[] = [], nx = inlay ? 6 : 8, nz = inlay ? 4 : 5;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const u = (i / nx * 2 - 1) * (inlay ? 0.67 : 1);
      const t = (j / nz - 0.5) * (inlay ? 0.76 : 1) + 0.5;
      const sideBolster = 0.036 * Math.pow(Math.abs(u), 4) * Math.sin(Math.PI * t);
      const frontRoll = 0.028 * Math.pow(t, 3);
      const edgeTaper = inlay ? 1 - 0.13 * Math.pow(Math.abs(t - 0.5) * 2, 2) : 1 - 0.075 * Math.pow(Math.abs(t - 0.5) * 2, 2);
      vertices.push(x + u * width * edgeTaper / 2, 0.983 + (inlay ? 0.008 : 0) + sideBolster + frontRoll - 0.033 * (1 - u * u) * Math.sin(Math.PI * t), z + (t - 0.5) * depth);
    }
    return mesh(parent, skinGeometry(vertices, nx, nz, [0, inlay ? -0.014 : -0.09, 0]), material);
  }

  function backrestSkin(parent: THREE.Object3D, x: number, z: number, width: number, material: THREE.Material, inlay = false) {
    const vertices: number[] = [], nx = inlay ? 6 : 8, ny = inlay ? 4 : 5;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const u = (i / nx * 2 - 1) * (inlay ? 0.63 : 1);
      const t = inlay ? 0.17 + 0.68 * j / ny : j / ny;
      const taper = inlay ? 0.92 - 0.18 * Math.pow(t, 4) - 0.04 * Math.pow(1 - t, 4)
        : 0.99 - 0.19 * t - 0.06 * Math.sin(Math.PI * t);
      const lumbar = 0.048 * (1 - u * u) * Math.sin(Math.PI * t);
      vertices.push(x + u * width * taper / 2, 1.07 + 0.51 * t, z - 0.14 - 0.085 * t + lumbar + (inlay ? 0.008 : 0));
    }
    return mesh(parent, skinGeometry(vertices, nx, ny, [0, 0, inlay ? -0.014 : -0.115]), material);
  }

  function roofPillar(parent: THREE.Object3D, s: number, bottom: V3, top: V3, widthAtBase: number, widthAtTop: number) {
    const vertices: number[] = [], nx = 1, ny = 6;
    for (let j = 0; j <= ny; j++) {
      const t = j / ny, bow = 0.012 * Math.sin(Math.PI * t);
      const width = widthAtBase * (1 - t) + widthAtTop * t;
      const centerX = bottom[0] * (1 - t) + top[0] * t + s * bow;
      const centerY = bottom[1] * (1 - t) + top[1] * t;
      const centerZ = bottom[2] * (1 - t) + top[2] * t;
      for (const edge of [-1, 1]) vertices.push(centerX, centerY, centerZ + edge * width / 2);
    }
    return mesh(parent, skinGeometry(vertices, nx, ny, [s * 0.035, 0, 0]), paint, [0, 0, 0], true);
  }

  // The exterior patches share the same surface equation as the painted skin,
  // so lamps and grilles do not float away from the vehicle in oblique views.
  function frontSurface(x: number, y: number) {
    const u = Math.max(-1, Math.min(1, x / 0.91));
    const t = Math.max(0, Math.min(1, (y - 0.67) / 0.47));
    return 2.295 + 0.075 * (1 - u * u) * (0.27 + 0.73 * (1 - t)) + 0.013 * Math.sin(Math.PI * t);
  }
  function rearSurface(x: number, y: number) {
    const u = Math.max(-1, Math.min(1, x / 0.935));
    const t = Math.max(0, Math.min(1, (y - 0.72) / 0.5));
    return -2.295 - 0.07 * (1 - u * u) - 0.017 * Math.sin(Math.PI * t);
  }
  function fasciaPatch(parent: THREE.Object3D, x0: number, x1: number, y0: number, y1: number,
    surface: (x: number, y: number) => number, outward: 1 | -1, offset: number, material: THREE.Material) {
    const vertices: number[] = [], nx = 4, ny = 1;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + (x1 - x0) * i / nx, y = y0 + (y1 - y0) * j / ny;
      vertices.push(x, y, surface(x, y) + outward * offset);
    }
    return mesh(parent, skinGeometry(vertices, nx, ny, [0, 0, -outward * 0.012]), material, [0, 0, 0], true);
  }
  function frontFascia(parent: THREE.Object3D) {
    const vertices: number[] = [], nx = 10, ny = 5;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx * 2 - 1, t = j / ny;
      const x = u * 0.905 * (1 - 0.028 * t), y = 0.67 + 0.47 * t;
      vertices.push(x, y, frontSurface(x, y));
    }
    return mesh(parent, skinGeometry(vertices, nx, ny, [0, 0, -0.048]), paint, [0, 0, 0], true);
  }
  function rearFascia(parent: THREE.Object3D) {
    const vertices: number[] = [], nx = 10, ny = 5;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx * 2 - 1, t = j / ny;
      const x = u * (0.935 - 0.018 * t), y = 0.72 + 0.5 * t;
      vertices.push(x, y, rearSurface(x, y));
    }
    return mesh(parent, skinGeometry(vertices, nx, ny, [0, 0, 0.048]), paint, [0, 0, 0], true);
  }

  const chassis = part('chassis', '承载式底板、纵梁与副车架', 'chassis', [0, -0.1, 0]);
  box(chassis, [1.66, 0.09, 3.95], [0, 0.64, -0.08], underbody);
  for (const x of [-0.74, 0.74]) box(chassis, [0.13, 0.18, 4.1], [x, 0.57, 0], steel);
  for (const z of [-1.45, 1.45]) {
    box(chassis, [1.55, 0.13, 0.28], [0, 0.56, z], steel);
    box(chassis, [1.46, 0.075, 0.12], [0, 0.62, z + 0.28], dark);
  }
  for (const z of [-0.9, -0.05, 0.9]) box(chassis, [1.5, 0.07, 0.08], [0, 0.63, z], steel);

  for (const [index, [x, z]] of ([[1, 1.45], [-1, 1.45], [1, -1.45], [-1, -1.45]] as [number, number][]).entries()) {
    const corner = ['fl', 'fr', 'rl', 'rr'][index], s = Math.sign(x);
    const suspension = part(`suspension-${corner}`, `${corner.toUpperCase()} 独立悬架与制动`, 'suspension', [s * 0.34, 0, 0]);
    rod(suspension, [s * 0.43, 0.52, z - 0.23], [s * 0.89, 0.43, z], 0.037);
    rod(suspension, [s * 0.43, 0.52, z + 0.23], [s * 0.89, 0.43, z], 0.037);
    rod(suspension, [s * 0.86, 0.48, z], [s * 0.71, 1.04, z], 0.042, dark);
    const spring: V3[] = [];
    for (let i = 0; i <= 64; i++) { const t = i / 64, a = t * Math.PI * 12; spring.push([s * (0.82 - 0.1 * t) + 0.062 * Math.cos(a), 0.61 + t * 0.33, z + 0.062 * Math.sin(a)]); }
    tube(suspension, spring, 0.011, copper);
    cylinder(suspension, 0.24, 0.024, [s * 0.885, 0.42, z], trim);
    box(suspension, [0.08, 0.18, 0.09], [s * 0.89, 0.46, z + 0.2], red);
    const wheel = part(`wheel-${corner}`, `${corner.toUpperCase()} 轮胎与轮辋`, 'wheel', [s * 0.55, 0, 0], [x, 0.42, z]);
    wheels.push(wheel);
    const tireGeometry = new THREE.TorusGeometry(0.315, 0.085, 10, 40); tireGeometry.rotateY(Math.PI / 2); tireGeometry.scale(1.5, 1, 1);
    mesh(wheel, tireGeometry, tireRubber);
    const lipGeometry = new THREE.TorusGeometry(0.247, 0.017, 6, 32); lipGeometry.rotateY(Math.PI / 2);
    mesh(wheel, lipGeometry, trim, [s * 0.105, 0, 0]);
    cylinder(wheel, 0.08, 0.19, [0, 0, 0], steel);
    for (let k = 0; k < 10; k++) {
      const a = k * Math.PI / 5;
      rod(wheel, [s * 0.105, Math.cos(a) * 0.065, Math.sin(a) * 0.065], [s * 0.10, Math.cos(a + 0.16) * 0.24, Math.sin(a + 0.16) * 0.24], 0.024, trim);
    }
    // Three circumferential tread grooves remain model geometry, requiring no remote textures.
    for (const xx of [-0.075, 0, 0.075]) { const g = new THREE.TorusGeometry(0.394 - Math.abs(xx) * 0.2, 0.004, 4, 24); g.rotateY(Math.PI / 2); mesh(wheel, g, dark, [xx, 0, 0]); }
  }

  for (const [index, [x, z, width]] of ([[0.48, 0.55, 0.62], [-0.48, 0.55, 0.62], [0.5, -0.79, 0.57], [0, -0.79, 0.42], [-0.5, -0.79, 0.57]] as [number, number, number][]).entries()) {
    const seat = part(`seat-${index + 1}`, `${index < 2 ? '前排' : '后排'}座椅 ${index + 1}（含头枕）`, 'cabin', [0, 0.45, 0]);
    box(seat, [width - 0.13, 0.14, 0.46], [x, 0.76, z], dark);
    cushionSkin(seat, x, z, width, 0.57, fabric);
    cushionSkin(seat, x, z, width, 0.57, insert, true);
    backrestSkin(seat, x, z, width, fabric);
    backrestSkin(seat, x, z, width, insert, true);
    for (const dx of [-width * 0.37, width * 0.37]) {
      const bolster = box(seat, [0.075, 0.43, 0.13], [x + dx, 1.27, z - 0.155], fabric, 0.037); bolster.rotation.x = -0.1;
    }
    for (const dx of [-0.085, 0.085]) cylinder(seat, 0.012, 0.14, [x + dx, 1.63, z - 0.25], trim, 'y', 8);
    box(seat, [Math.min(width * 0.64, 0.35), 0.21, 0.17], [x, 1.77, z - 0.25], fabric, 0.078);
    box(seat, [0.045, 0.1, 0.05], [x + width / 2 - 0.035, 1.01, z - 0.1], red, 0.01);
    for (const direction of [-1, 1]) {
      seam(seat, [[x + direction * width * 0.28, 1.03, z - 0.2], [x + direction * width * 0.29, 1.014, z + 0.16], [x + direction * width * 0.25, 1.006, z + 0.21]]);
      seam(seat, [[x + direction * width * 0.27, 1.09, z - 0.115], [x + direction * width * 0.28, 1.47, z - 0.115], [x + direction * width * 0.22, 1.53, z - 0.14]]);
    }
  }
  const cockpit = part('cockpit', '仪表台、方向盘、踏板与中央扶手', 'cabin', [0, 0.45, 0]);
  const dashboardVertices: number[] = [], dashboardNx = 12, dashboardNz = 5;
  for (let j = 0; j <= dashboardNz; j++) for (let i = 0; i <= dashboardNx; i++) {
    const x = -0.845 + i / dashboardNx * 1.69, t = j / dashboardNz;
    const binnacle = 0.062 * Math.exp(-(((x - 0.46) / 0.28) ** 2)) * Math.sin(Math.PI * t);
    dashboardVertices.push(x, 1.31 - 0.09 * t + binnacle + 0.012 * (1 - (x / 0.845) ** 2), 1.01 + 0.34 * t);
  }
  mesh(cockpit, skinGeometry(dashboardVertices, dashboardNx, dashboardNz, [0, -0.12, 0]), dark);
  box(cockpit, [1.58, 0.035, 0.02], [0, 1.29, 0.995], trim, 0.005);
  // These are decorative vehicle displays, not RNC readings or a live instrument feed.
  box(cockpit, [0.42, 0.205, 0.054], [0.45, 1.43, 1.105], black, 0.018);
  box(cockpit, [0.36, 0.152, 0.005], [0.45, 1.43, 1.074], display, 0);
  for (const dx of [-0.078, 0.078]) {
    screenRing(cockpit, 0.45 + dx, 1.435, 1.067, 0.041);
    box(cockpit, [0.042, 0.005, 0.004], [0.45 + dx, 1.403, 1.066], screenMuted, 0);
  }
  box(cockpit, [0.115, 0.007, 0.004], [0.45, 1.49, 1.066], screenMuted, 0);
  box(cockpit, [0.49, 0.315, 0.055], [0, 1.41, 1.005], black, 0.018);
  box(cockpit, [0.43, 0.255, 0.005], [0, 1.41, 0.973], display, 0);
  box(cockpit, [0.39, 0.011, 0.004], [0, 1.515, 0.966], screenAccent, 0);
  for (const [y, width] of [[1.46, 0.16], [1.415, 0.13], [1.37, 0.18]] as const) {
    box(cockpit, [width, 0.009, 0.004], [-0.105, y, 0.966], screenMuted, 0);
  }
  screenRing(cockpit, 0.125, 1.405, 0.965, 0.048);
  box(cockpit, [0.082, 0.008, 0.004], [0.125, 1.33, 0.966], screenMuted, 0);
  for (const x of [-0.68, 0.68]) { box(cockpit, [0.17, 0.085, 0.02], [x, 1.28, 0.98], black, 0.007); for (let j = -1; j <= 1; j++) box(cockpit, [0.15, 0.007, 0.024], [x, 1.28 + j * 0.024, 0.973], steel, 0); }
  const steering = mesh(cockpit, new THREE.TorusGeometry(0.17, 0.024, 8, 32), black, [0.48, 1.37, 0.86]); steering.rotation.x = -0.28;
  for (const a of [0, Math.PI * 0.7, -Math.PI * 0.7]) rod(cockpit, [0.48, 1.37, 0.86], [0.48 + Math.sin(a) * 0.145, 1.37 + Math.cos(a) * 0.145, 0.86], 0.022, dark);
  box(cockpit, [0.11, 0.095, 0.04], [0.48, 1.37, 0.85], fabric);
  for (const x of [0.37, 0.59]) {
    box(cockpit, [0.045, 0.024, 0.012], [x, 1.375, 0.838], softTrim, 0);
    box(cockpit, [0.025, 0.006, 0.004], [x, 1.375, 0.829], trim, 0);
  }
  rod(cockpit, [0.51, 1.34, 0.93], [0.69, 1.34, 0.93], 0.008, black);
  rod(cockpit, [0.48, 1.37, 0.9], [0.48, 1.19, 1.19], 0.035, dark);
  for (const [x, w] of [[0.57, 0.1], [0.35, 0.075]]) { rod(cockpit, [x, 0.85, 1.01], [x, 0.73, 0.98], 0.012); const pedal = box(cockpit, [w, 0.12, 0.025], [x, 0.72, 0.97], black, 0.01); pedal.rotation.x = -0.25; }
  box(cockpit, [0.27, 0.24, 0.94], [0, 0.93, 0.2], dark, 0.045);
  box(cockpit, [0.3, 0.11, 0.41], [0, 1.09, -0.05], fabric, 0.035);
  seam(cockpit, [[0, 1.147, -0.225], [0, 1.147, 0.11]]);
  box(cockpit, [0.075, 0.015, 0.013], [0, 1.105, 0.163], trim, 0);
  for (const z of [0.32, 0.5]) {
    cylinder(cockpit, 0.05, 0.004, [0, 1.054, z], black, 'y', 12);
    const ring = mesh(cockpit, new THREE.TorusGeometry(0.061, 0.012, 6, 20), steel, [0, 1.055, z]); ring.rotation.x = Math.PI / 2;
  }
  box(cockpit, [0.07, 0.035, 0.075], [0, 1.085, 0.62], black, 0);
  box(cockpit, [0.035, 0.018, 0.045], [0, 1.11, 0.62], trim, 0);
  const luggage = part('cargo-floor', '后备箱地板与行李空间', 'cabin', [0, 0.45, 0]);
  box(luggage, [1.55, 0.1, 0.93], [0, 0.87, -1.68], dark, 0.03);

  // Wheel-arch cutouts belong to the silhouette rather than covering tires with rectangular slabs.
  for (const s of [-1, 1]) {
    const side = part(`side-${s}`, `${s > 0 ? '左' : '右'}侧围、轮眉与门槛`, 'shell', [s * 0.68, 0.15, 0]);
    const shape = new THREE.Shape(); shape.moveTo(2.36, 0.59);
    for (const cz of [-1.45, 1.45]) {
      shape.lineTo(-(cz - 0.48), 0.59);
      for (let i = 0; i <= 18; i++) { const a = Math.PI - i / 18 * Math.PI; shape.lineTo(-(cz + 0.48 * Math.cos(a)), 0.49 + 0.43 * Math.sin(a)); }
    }
    shape.lineTo(-2.36, 0.65); shape.lineTo(-2.31, 1.11); shape.quadraticCurveTo(-1.4, 1.31, -0.9, 1.24);
    shape.lineTo(1.7, 1.23); shape.quadraticCurveTo(2.34, 1.2, 2.36, 1.05); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.015, bevelSegments: 2, steps: 1, curveSegments: 10 });
    g.rotateY(Math.PI / 2);
    const skin = g.getAttribute('position');
    for (let i = 0; i < skin.count; i++) {
      const y = skin.getY(i), z = skin.getZ(i);
      const shoulder = 0.023 * Math.sin(Math.PI * Math.max(0, Math.min(1, (y - 0.58) / 0.74)));
      const endTaper = 0.06 * Math.max(0, Math.abs(z) - 1.83) / 0.56;
      skin.setX(i, skin.getX(i) + s * (shoulder - endTaper));
    }
    g.computeVertexNormals();
    const normals = g.getAttribute('normal'), smooth = new Map<string, THREE.Vector3>();
    const vertexKey = (i: number) => `${skin.getX(i).toFixed(5)},${skin.getY(i).toFixed(5)},${skin.getZ(i).toFixed(5)}`;
    for (let i = 0; i < skin.count; i++) { const key = vertexKey(i), normal = new THREE.Vector3().fromBufferAttribute(normals, i); smooth.set(key, (smooth.get(key) ?? new THREE.Vector3()).add(normal)); }
    smooth.forEach(normal => normal.normalize());
    for (let i = 0; i < skin.count; i++) { const normal = smooth.get(vertexKey(i))!; normals.setXYZ(i, normal.x, normal.y, normal.z); }
    mesh(side, g, paint, [s > 0 ? 0.91 : -0.965, 0, 0], true);
    box(side, [0.075, 0.085, 1.81], [s * 0.957, 0.615, 0], dark, 0.032, true);
    for (const z of [-1.45, 1.45]) {
      const linerVertices: number[] = [], segments = 18;
      for (let radiusIndex = 0; radiusIndex <= 1; radiusIndex++) for (let i = 0; i <= segments; i++) {
        const angle = 0.13 + i / segments * (Math.PI - 0.26), radius = radiusIndex ? 0.53 : 0.405;
        linerVertices.push(s * 0.966, 0.49 + Math.sin(angle) * radius, z + Math.cos(angle) * radius);
      }
      mesh(side, skinGeometry(linerVertices, segments, 1, [-s * 0.012, 0, 0]), dark, [0, 0, 0], true);
      const arch: V3[] = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; arch.push([s * 0.994, 0.49 + Math.sin(a) * 0.445, z + Math.cos(a) * 0.49]); }
      appendShell(tube(side, arch, 0.031, dark));
    }
    for (const [id, z, length] of [['front', 0.62, 1.19], ['rear', -0.73, 1.35]] as [string, number, number][]) {
      const door = part(`door-${id}-${s}`, `${s > 0 ? '左' : '右'}${id === 'front' ? '前' : '后'}车门及扬声器`, 'shell', [s * 0.72, 0.35, 0]);
      const doorVertices: number[] = [];
      for (let j = 0; j <= 8; j++) for (let i = 0; i <= 4; i++) {
        const t = i / 4, longitudinal = j / 8;
        const shoulder = 0.039 * Math.exp(-(((t - 0.79) / 0.22) ** 2));
        const lowerSculpt = -0.014 * (1 - t) ** 2;
        const endEase = 0.7 + 0.3 * Math.sin(longitudinal * Math.PI);
        doorVertices.push(s * (0.994 + (shoulder + lowerSculpt) * endEase), 0.765 + 0.48 * t, z - length / 2 + length * longitudinal);
      }
      const doorGeometry = skinGeometry(doorVertices, 4, 8, [-s * 0.008, 0, 0]);
      // Both orientations are visible because thin exterior skins can be viewed from inside after an exploded view.
      const doorPanel = mesh(door, doorGeometry, paint, [0, 0, 0], true);
      // A thin dark outline makes door shut lines visible without painted-on unrelated texture.
      appendShell(tube(door, [[s * 1.002, 1.24, z + length / 2], [s * 1.008, 0.85, z + length / 2 - 0.04], [s * 1.008, 0.78, z], [s * 1.002, 0.84, z - length / 2], [s * 1.002, 1.24, z - length / 2]], 0.006, dark));
      box(door, [0.045, 0.035, 0.17], [s * 1.019, 1.16, z - 0.22], trim, 0.012, true);
      box(door, [0.06, 0.46, length * 0.88], [s * 0.88, 1.015, z], fabric, 0.035);
      box(door, [0.09, 0.065, 0.44], [s * 0.83, 1.1, z + 0.02], dark);
      box(door, [0.019, 0.09, length * 0.7], [s * 0.841, 1.18, z], softTrim, 0);
      box(door, [0.018, 0.012, 0.2], [s * 0.823, 1.205, z + 0.23], trim, 0);
      seam(door, [[s * 0.837, 1.13, z - length * 0.34], [s * 0.837, 1.13, z + length * 0.34]]);
      const speakerZ = id === 'front' ? 0.65 : -0.75;
      const speaker = cylinder(door, 0.108, 0.027, [s * 0.96, 1.1, speakerZ], dark);
      speaker.name = `speaker-${id === 'front' ? 'f' : 'r'}${s > 0 ? 'l' : 'r'}`; speaker.userData.component = speaker.name;
      const surround = new THREE.TorusGeometry(0.09, 0.008, 6, 24); surround.rotateY(Math.PI / 2); mesh(door, surround, trim, [s * 0.939, 1.1, speakerZ]);
      cylinder(door, 0.033, 0.032, [s * 0.938, 1.1, speakerZ], steel);
      doorPanel.userData.component = `door-skin-${id}-${s}`;
    }
  }
  const hood = part('hood', '曲面前舱盖与前灯', 'shell', [0, 0.74, 0.3]);
  curvedPanel(hood, 1.87, 1.15, 2.31, 1.22, 1.09, 0.06);
  frontFascia(hood);
  fasciaPatch(hood, -0.78, 0.78, 0.685, 0.755, frontSurface, 1, 0.018, dark);
  fasciaPatch(hood, -0.61, 0.61, 0.785, 0.935, frontSurface, 1, 0.019, dark);
  for (let i = -6; i <= 6; i++) {
    const x = i * 0.082;
    box(hood, [0.015, 0.105, 0.013], [x, 0.857, frontSurface(x, 0.857) + 0.027], steel, 0, true);
  }
  for (const s of [-1, 1]) {
    const left = s > 0 ? 0.35 : -0.87, right = s > 0 ? 0.87 : -0.35;
    fasciaPatch(hood, left, right, 1.025, 1.115, frontSurface, 1, 0.02, dark);
    fasciaPatch(hood, left + 0.026, right - 0.026, 1.072, 1.09, frontSurface, 1, 0.034, headlamp);
    fasciaPatch(hood, s > 0 ? 0.67 : -0.84, s > 0 ? 0.84 : -0.67, 1.026, 1.058, frontSurface, 1, 0.035, headlamp);
    fasciaPatch(hood, s > 0 ? 0.77 : -0.855, s > 0 ? 0.855 : -0.77, 1.092, 1.11, frontSurface, 1, 0.041, indicator);
    fasciaPatch(hood, s > 0 ? 0.64 : -0.84, s > 0 ? 0.84 : -0.64, 0.72, 0.8, frontSurface, 1, 0.023, dark);
    appendShell(tube(hood, [[s * 0.66, 1.228, 1.28], [s * 0.61, 1.203, 1.68], [s * 0.62, 1.142, 2.2]], 0.003, trim));
  }
  const tail = part('tailgate', '尾门、尾灯与后保险杠', 'shell', [0, 0.46, -0.48]);
  rearFascia(tail);
  fasciaPatch(tail, -0.87, 0.87, 1.14, 1.19, rearSurface, -1, 0.016, taillamp);
  for (const s of [-1, 1]) {
    const left = s > 0 ? 0.39 : -0.86, right = s > 0 ? 0.86 : -0.39;
    fasciaPatch(tail, left, right, 0.985, 1.09, rearSurface, -1, 0.015, dark);
    for (let i = 0; i < 4; i++) {
      const x = s * (0.46 + i * 0.105);
      fasciaPatch(tail, x - 0.034, x + 0.034, 1.035, 1.06, rearSurface, -1, 0.029, taillamp);
    }
    fasciaPatch(tail, s > 0 ? 0.43 : -0.54, s > 0 ? 0.54 : -0.43, 0.996, 1.016, rearSurface, -1, 0.029, headlamp);
  }
  fasciaPatch(tail, -0.865, 0.865, 0.615, 0.765, rearSurface, -1, 0.028, dark);
  fasciaPatch(tail, -0.23, 0.23, 0.855, 0.925, rearSurface, -1, 0.018, dark);
  box(tail, [1.6, 0.055, 0.16], [0, 1.89, -1.84], paint, 0.02, true);
  const roof = part('roof', '车顶、立柱与玻璃', 'shell', [0, 1.0, 0]);
  curvedPanel(roof, 1.59, -1.76, 0.7, 1.91, 1.96, 0.035);
  panel(roof, [[-0.89, 1.27, 1.15], [0.89, 1.27, 1.15], [0.755, 1.94, 0.64], [-0.755, 1.94, 0.64]], glass);
  panel(roof, [[0.87, 1.26, -2.19], [-0.87, 1.26, -2.19], [-0.74, 1.91, -1.71], [0.74, 1.91, -1.71]], glass);
  glassSeal(roof, [[-0.89, 1.275, 1.15], [0.89, 1.275, 1.15], [0.755, 1.945, 0.64], [-0.755, 1.945, 0.64]]);
  glassSeal(roof, [[0.87, 1.265, -2.19], [-0.87, 1.265, -2.19], [-0.74, 1.915, -1.71], [0.74, 1.915, -1.71]]);
  for (const s of [-1, 1]) {
    const topX = s * 0.775, bottomX = s * 0.92;
    panel(roof, [[bottomX, 1.26, 1.08], [bottomX, 1.26, -0.15], [topX, 1.93, -0.15], [topX, 1.93, 0.61]], glass);
    panel(roof, [[bottomX, 1.26, -0.24], [bottomX, 1.26, -1.89], [topX, 1.90, -1.65], [topX, 1.93, -0.24]], glass);
    glassSeal(roof, [[bottomX + s * 0.006, 1.265, 1.075], [bottomX + s * 0.006, 1.265, -0.15], [topX + s * 0.006, 1.935, -0.15], [topX + s * 0.006, 1.935, 0.605]]);
    glassSeal(roof, [[bottomX + s * 0.006, 1.265, -0.245], [bottomX + s * 0.006, 1.265, -1.885], [topX + s * 0.006, 1.905, -1.65], [topX + s * 0.006, 1.935, -0.245]]);
    roofPillar(roof, s, [bottomX, 1.23, 1.14], [topX, 1.96, 0.66], 0.135, 0.095);
    roofPillar(roof, s, [bottomX, 1.24, -0.195], [topX, 1.97, -0.195], 0.085, 0.075);
    roofPillar(roof, s, [bottomX, 1.24, -2.15], [topX, 1.91, -1.72], 0.19, 0.115);
    // A closed shoulder joins the crown to the side glazing instead of a floating roof bar.
    const shoulderVertices: number[] = [], segments = 8;
    for (let j = 0; j <= segments; j++) for (let i = 0; i <= 2; i++) {
      const t = j / segments, z = -1.70 + 2.35 * t, u = i / 2;
      const topY = 1.915 + 0.045 * t + 0.012 * Math.sin(t * Math.PI);
      shoulderVertices.push(s * (0.705 + 0.082 * u), topY - 0.045 * u, z);
    }
    mesh(roof, skinGeometry(shoulderVertices, 2, segments, [0, -0.028, 0]), paint, [0, 0, 0], true);
    const mirror = part(`mirror-${s}`, `${s > 0 ? '左' : '右'}后视镜`, 'shell', [s * 0.72, 0.3, 0]);
    appendShell(rod(mirror, [s * 0.95, 1.24, 0.91], [s * 1.12, 1.32, 0.88], 0.024, dark));
    box(mirror, [0.23, 0.13, 0.23], [s * 1.12, 1.34, 0.85], paint, 0.05, true);
    box(mirror, [0.18, 0.085, 0.012], [s * 1.12, 1.35, 0.737], trim, 0.025, true);
  }
  for (const s of [-1, 1]) appendShell(rod(roof, [s * 0.58, 1.29, 1.13], [s * 0.14, 1.37, 1.066], 0.012, dark));

  const auxiliary = part('auxiliary-electrical', '12V 电池、配电与冷却散热器', 'electrical', [-0.24, 0.22, 0.2]);
  box(auxiliary, [0.3, 0.22, 0.25], [-0.6, 0.98, 1.88], dark);
  for (const x of [-0.69, -0.52]) box(auxiliary, [0.04, 0.025, 0.04], [x, 1.106, 1.88], x < -0.6 ? red : steel, 0.003);
  box(auxiliary, [1.15, 0.29, 0.06], [0, 0.87, 2.09], steel);
  for (let i = 0; i < 14; i++) box(auxiliary, [0.015, 0.245, 0.015], [-0.52 + i * 0.08, 0.87, 2.13], dark, 0);
  function makeBattery(id: string, name: string, size: V3, position: V3) {
    const p = part(id, name, 'energy', [0, -0.32, 0]); box(p, size, position, battery, 0.04);
    // Exterior enclosure, skid rim and longitudinal mounts; no invented cell internals.
    for (const s of [-1, 1]) box(p, [0.045, 0.075, size[2] * 0.88], [position[0] + s * (size[0] / 2 - 0.06), position[1] - size[1] / 2 - 0.04, position[2]], steel, 0);
    for (const s of [-1, 1]) box(p, [size[0] * 0.92, 0.035, 0.045], [position[0], position[1] - size[1] / 2 - 0.04, position[2] + s * size[2] * 0.42], steel, 0);
    for (let i = 0; i < 7; i++) box(p, [size[0] * 0.9, 0.014, 0.025], [position[0], position[1] + size[1] / 2 + 0.008, position[2] - size[2] * 0.42 + i * size[2] * 0.14], trim, 0);
    box(p, [0.13, 0.09, 0.12], [position[0] + size[0] / 2 + 0.015, position[1], position[2] + size[2] * 0.32], copper, 0.015);
    return p;
  }
  function electricDrive(front: boolean) {
    const z = front ? 1.45 : -1.45;
    const p = part(front ? 'traction-motor-front' : 'traction-motor-rear', front ? 'MG2 前驱电机与减速差速器' : '后驱电机与减速差速器', 'powertrain', [0, 0.15, front ? 0.22 : -0.25]);
    const motorX = front ? 0.49 : -0.18, motorLength = front ? 0.3 : 0.49;
    const radius = front ? 0.155 : 0.18;
    cylinder(p, radius, motorLength, [motorX, 0.72, z], blue); box(p, [0.25, 0.26, 0.3], [0.18, 0.62, z], steel, 0.055);
    for (const end of [-1, 1]) cylinder(p, radius * 1.045, 0.025, [motorX + end * motorLength * 0.49, 0.72, z], dark, 'x', 12);
    cylinder(p, 0.105, 0.13, [0.18, 0.62, z], trim, 'x', 12);
    rod(p, [motorX + motorLength * 0.38, 0.72, z], [0.18, 0.62, z], 0.045, steel);
    for (const s of [-1, 1]) rod(p, [s * 0.15, 0.49, z], [s * 0.9, 0.44, z], 0.029);
    for (let i = 0; i < 6; i++) cylinder(p, front ? 0.161 : 0.187, 0.008, [motorX - motorLength * 0.42 + i * motorLength * 0.168, 0.72, z], steel);
    return p;
  }
  if (kind === 'bev' || kind === 'erev') {
    makeBattery('traction-battery', '底板动力电池', [1.43, 0.17, kind === 'bev' ? 2.63 : 1.91], [0, 0.46, kind === 'bev' ? 0 : 0.3]);
    electricDrive(false);
  } else if (kind === 'hev') makeBattery('traction-battery', '后排下 HEV 动力电池', [1.24, 0.17, 0.48], [0, 0.72, -0.76]);
  if (kind !== 'ice') {
    const electronics = part('inverter', '逆变器与高压配电', 'electrical', [0.2, 0.33, 0]);
    const z = kind === 'hev' ? 1.34 : -1.46;
    box(electronics, [0.52, 0.11, 0.37], [0, 0.98, z], copper);
    box(electronics, [0.6, 0.025, 0.43], [0, 0.91, z], dark, 0.012);
    for (let i = 0; i < 8; i++) box(electronics, [0.012, 0.026, 0.32], [-0.21 + i * 0.06, 1.046, z], steel, 0);
    for (const x of [-0.15, 0.15]) cylinder(electronics, 0.035, 0.035, [x, 1.06, z - 0.15], dark, 'z', 10);
    tube(electronics, [[0.24, 0.54, kind === 'hev' ? -0.75 : 0], [0.53, 0.57, 0.25], [0.53, 0.8, z], [0.17, 0.98, z]], 0.018, copper);
    if (kind !== 'hev') {
      const charger = part('charge-system', '外接充电口、车载充电器与 DC/DC', 'electrical', [-0.3, 0.28, 0]);
      const chargerPosition: V3 = kind === 'erev' ? [-0.52, 0.89, 1.05] : [-0.31, 0.92, 1.53];
      box(charger, [0.43, 0.14, 0.36], chargerPosition, blue);
      box(charger, [0.47, 0.018, 0.4], [chargerPosition[0], chargerPosition[1] - 0.08, chargerPosition[2]], dark, 0.008);
      box(charger, [0.24, 0.12, 0.28], kind === 'erev' ? [0.65, 0.98, 1.13] : [0.29, 0.9, 1.82], steel);
      box(charger, [0.025, 0.13, 0.14], [-0.999, 1.085, -1.88], dark, 0.025);
      const chargeRim = mesh(charger, new THREE.TorusGeometry(0.064, 0.009, 5, 16), trim, [-1.016, 1.085, -1.88]); chargeRim.rotation.y = Math.PI / 2;
      tube(charger, [[-0.95, 1.08, -1.88], [-0.69, 0.59, -1.68], [-0.66, 0.57, 1.04], chargerPosition], 0.014, copper);
    }
  }
  if (kind !== 'bev') {
    const combustion = part('combustion-engine', kind === 'erev' ? '增程发动机（仅驱动发电机）' : '横置四缸汽油发动机', 'powertrain', [0, 0.23, 0.4], [0, 0, 0], kind === 'erev' ? '仅与发电机机械连接，不驱动车轮' : '机械动力经变速/分流机构到前差速器');
    const engineX = kind === 'hev' ? -0.34 : -0.17, engineWidth = kind === 'hev' ? 0.56 : 0.69;
    box(combustion, [engineWidth, 0.34, 0.39], [engineX, 0.86, 1.64], engine, 0.055);
    box(combustion, [engineWidth + 0.06, 0.11, 0.35], [engineX, 0.64, 1.64], dark, 0.03);
    box(combustion, [engineWidth - 0.07, 0.07, 0.33], [engineX, 1.067, 1.64], dark, 0.025);
    box(combustion, [engineWidth - 0.13, 0.1, 0.16], [engineX, 1.17, 1.47], steel, 0.04);
    for (let i = 0; i < 4; i++) { const cylinderX = engineX + (i - 1.5) * engineWidth * 0.21; cylinder(combustion, 0.045, 0.028, [cylinderX, 1.116, 1.64], steel, 'y', 12); tube(combustion, [[cylinderX, 0.87, 1.42], [cylinderX, 0.67, 1.29], [-0.1, 0.53, 1.18]], 0.022, steel); }
    for (let i = 0; i < 4; i++) {
      const x = engineX + (i - 1.5) * engineWidth * 0.21;
      rod(combustion, [x, 1.13, 1.48], [x, 1.05, 1.6], 0.018, dark);
    }
    const fuel = part('fuel-tank', '燃油箱与供油管', 'energy', [0.25, -0.19, -0.12]);
    box(fuel, [0.98, 0.2, 0.54], [0.11, 0.48, kind === 'erev' ? -0.94 : -1.11], dark, 0.08);
    for (const x of [-0.19, 0.38]) box(fuel, [0.035, 0.025, 0.58], [x, 0.365, kind === 'erev' ? -0.94 : -1.11], steel, 0);
    tube(fuel, [[0.58, 0.51, -1.15], [0.65, 0.55, 0], [0.56, 0.79, 1.4], [0.13, 0.9, 1.64]], 0.008, steel);
    const exhaust = part('exhaust', '催化器、排气管与后消声器', 'exhaust', [-0.22, -0.15, 0]);
    tube(exhaust, [[-0.1, 0.54, 1.2], [-0.58, 0.43, 0.92], [-0.7, 0.38, -0.5], [-0.61, 0.44, -1.83], [-0.5, 0.44, -2.38]], 0.033);
    cylinder(exhaust, 0.095, 0.26, [-0.6, 0.43, 0.83], engine, 'z');
    box(exhaust, [0.46, 0.16, 0.36], [-0.52, 0.43, -1.92], engine, 0.055);
    box(exhaust, [0.45, 0.015, 0.53], [-0.52, 0.535, -1.89], steel, 0.004);
    if (kind === 'ice') {
      const gearbox = part('transmission', '前置变速器、差速器与驱动半轴', 'powertrain', [0.18, 0.15, 0.27]);
      box(gearbox, [0.42, 0.35, 0.44], [0.4, 0.7, 1.51], steel, 0.085);
      const bell = mesh(gearbox, new THREE.CylinderGeometry(0.17, 0.23, 0.2, 12), engine, [0.22, 0.78, 1.62]); bell.rotation.z = Math.PI / 2;
      cylinder(gearbox, 0.115, 0.12, [0.18, 0.53, 1.45], dark, 'x', 12);
      for (const s of [-1, 1]) rod(gearbox, [s * 0.18, 0.52, 1.45], [s * 0.9, 0.44, 1.45], 0.03);
    } else if (kind === 'hev') {
      electricDrive(true);
      const split = part('power-split', '行星功率分流器与 MG1 发电机', 'powertrain', [0.36, 0.36, 0.28], [0, 0, 0], '发动机同时连机械输出与 MG1 发电支路；MG2 经减速器驱动车轮');
      cylinder(split, 0.13, 0.14, [0.18, 0.91, 1.68], copper);
      cylinder(split, 0.105, 0.23, [0.48, 0.95, 1.79], blue);
      cylinder(split, 0.14, 0.025, [0.18, 0.91, 1.68], dark, 'x', 12);
      cylinder(split, 0.108, 0.025, [0.61, 0.95, 1.79], dark, 'x', 12);
      rod(split, [-0.08, 0.91, 1.68], [0.18, 0.91, 1.68], 0.022);
      rod(split, [0.18, 0.91, 1.68], [0.48, 0.95, 1.79], 0.022);
      rod(split, [0.18, 0.91, 1.68], [0.18, 0.62, 1.45], 0.024);
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; cylinder(split, 0.03, 0.15, [0.18, 0.91 + Math.cos(a) * 0.075, 1.68 + Math.sin(a) * 0.075], steel); }
    } else {
      const generator = part('range-generator', '增程发电机与电气输出（无车轮传动轴）', 'powertrain', [0.35, 0.27, 0.37], [0, 0, 0], '发动机→发电机→高压母线/电池→后逆变器→后电机；无发动机到车轮的机械通路');
      cylinder(generator, 0.15, 0.31, [0.44, 0.87, 1.64], blue);
      cylinder(generator, 0.157, 0.025, [0.61, 0.87, 1.64], dark, 'x', 12);
      cylinder(generator, 0.07, 0.075, [0.18, 0.87, 1.64], steel, 'x', 12);
      rod(generator, [0.1, 0.87, 1.64], [0.44, 0.87, 1.64], 0.028);
      tube(generator, [[0.43, 0.91, 1.64], [0.62, 0.7, 1.27], [0.61, 0.58, 0.4], [0.23, 0.54, 0.3]], 0.021, copper);
    }
  }
  let disposed = false;
  return { group, parts, shell, wheels, materials, dispose() {
    if (disposed) return; disposed = true;
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
    group.clear();
  } };
}
