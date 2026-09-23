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
  const materials: THREE.Material[] = [], geometries = new Set<THREE.BufferGeometry>();
  const shellMaterialCopies = new Map<THREE.Material, THREE.Material>();
  const standard = (color: string, roughness = 0.55, metalness = 0.15) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.push(m); return m;
  };
  const paint = new THREE.MeshPhysicalMaterial({ color: '#86b8bf', metalness: 0.62, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  materials.push(paint);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#88c6d8', transparent: true, opacity: 0.28, metalness: 0.18, roughness: 0.18, side: THREE.DoubleSide, depthWrite: false });
  materials.push(glass);
  const dark = standard('#162530', 0.82), black = standard('#111920', 0.95, 0), steel = standard('#778b98', 0.42, 0.65);
  const trim = standard('#c1d3da', 0.3, 0.8), fabric = standard('#46586a', 0.92, 0), insert = standard('#72899a', 0.85, 0);
  const copper = standard('#f59039', 0.4, 0.5), battery = standard('#209e91', 0.45, 0.5), engine = standard('#a8adb2', 0.5, 0.55);
  const blue = standard('#398bb8', 0.35, 0.5), red = standard('#bd594f', 0.6, 0.1);
  const headlamp = standard('#d8f5ff', 0.23); headlamp.emissive.set('#d2efff'); headlamp.emissiveIntensity = 1.2;
  const taillamp = standard('#bd302e', 0.23); taillamp.emissive.set('#d44131'); taillamp.emissiveIntensity = 0.8;
  const display = standard('#162d42', 0.3); display.emissive.set('#183f53'); display.emissiveIntensity = 0.4;

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
    geometries.add(geometry); const object = new THREE.Mesh(geometry, material); object.position.set(...position);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); if (isShell) shell.push(object); return object;
  }
  function box(parent: THREE.Object3D, size: V3, pos: V3, material = steel, radius = 0.025, isShell = false) {
    return mesh(parent, radius ? new RoundedBoxGeometry(...size, 1, radius) : new THREE.BoxGeometry(...size), material, pos, isShell);
  }
  function cylinder(parent: THREE.Object3D, radius: number, length: number, pos: V3, material = steel, axis = 'x', segments = 20) {
    const object = mesh(parent, new THREE.CylinderGeometry(radius, radius, length, segments), material, pos);
    if (axis === 'x') object.rotation.z = Math.PI / 2; else if (axis === 'z') object.rotation.x = Math.PI / 2; return object;
  }
  function tube(parent: THREE.Object3D, points: V3[], radius: number, material = steel) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.min(128, Math.max(10, points.length * 5)), radius, 6, false), material);
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
  function curvedPanel(parent: THREE.Object3D, width: number, z0: number, z1: number, y0: number, y1: number, crown: number) {
    const vertices: number[] = [], indices: number[] = [], nx = 12, nz = 8;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx * 2 - 1, t = j / nz;
      vertices.push(u * width / 2 * (0.96 + 0.04 * Math.sin(t * Math.PI)), y0 + (y1 - y0) * t + crown * (1 - u * u), z0 + (z1 - z0) * t);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i; indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return mesh(parent, geometry, paint, [0, 0, 0], true);
  }

  const chassis = part('chassis', '承载式底板、纵梁与副车架', 'chassis', [0, -0.1, 0]);
  box(chassis, [1.66, 0.09, 3.95], [0, 0.64, -0.08], dark);
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
    mesh(wheel, tireGeometry, black);
    const lipGeometry = new THREE.TorusGeometry(0.247, 0.017, 6, 32); lipGeometry.rotateY(Math.PI / 2);
    mesh(wheel, lipGeometry, trim, [s * 0.105, 0, 0]);
    cylinder(wheel, 0.08, 0.19, [0, 0, 0], steel);
    for (let k = 0; k < 10; k++) {
      const a = k * Math.PI / 5;
      rod(wheel, [s * 0.105, Math.cos(a) * 0.065, Math.sin(a) * 0.065], [s * 0.10, Math.cos(a + 0.16) * 0.24, Math.sin(a + 0.16) * 0.24], 0.024, trim);
    }
    // Three circumferential tread grooves remain model geometry, requiring no remote textures.
    for (const xx of [-0.075, 0, 0.075]) { const g = new THREE.TorusGeometry(0.394 - Math.abs(xx) * 0.2, 0.004, 4, 40); g.rotateY(Math.PI / 2); mesh(wheel, g, dark, [xx, 0, 0]); }
  }

  for (const [index, [x, z, width]] of ([[0.48, 0.55, 0.62], [-0.48, 0.55, 0.62], [0.5, -0.79, 0.57], [0, -0.79, 0.42], [-0.5, -0.79, 0.57]] as [number, number, number][]).entries()) {
    const seat = part(`seat-${index + 1}`, `${index < 2 ? '前排' : '后排'}座椅 ${index + 1}（含头枕）`, 'cabin', [0, 0.45, 0]);
    box(seat, [width - 0.13, 0.14, 0.46], [x, 0.76, z], dark);
    box(seat, [width, 0.17, 0.57], [x, 0.91, z], fabric, 0.07);
    box(seat, [width * 0.67, 0.035, 0.46], [x, 1.007, z + 0.015], insert, 0.025);
    const back = box(seat, [width, 0.6, 0.16], [x, 1.29, z - 0.24], fabric, 0.075); back.rotation.x = -0.1;
    box(seat, [width * 0.64, 0.46, 0.035], [x, 1.3, z - 0.14], insert, 0.04);
    for (const dx of [-width * 0.35, width * 0.35]) box(seat, [0.09, 0.43, 0.21], [x + dx, 1.22, z - 0.19], fabric, 0.04);
    for (const dx of [-0.085, 0.085]) cylinder(seat, 0.012, 0.14, [x + dx, 1.63, z - 0.25], trim, 'y', 8);
    box(seat, [Math.min(width * 0.62, 0.34), 0.22, 0.15], [x, 1.77, z - 0.25], fabric, 0.055);
    box(seat, [0.045, 0.1, 0.05], [x + width / 2 - 0.035, 1.01, z - 0.1], red, 0.01);
  }
  const cockpit = part('cockpit', '仪表台、方向盘、踏板与中央扶手', 'cabin', [0, 0.45, 0]);
  box(cockpit, [1.69, 0.24, 0.35], [0, 1.23, 1.18], dark, 0.07);
  box(cockpit, [1.58, 0.035, 0.02], [0, 1.29, 0.995], trim, 0.005);
  box(cockpit, [0.4, 0.19, 0.025], [0.45, 1.43, 1.105], display, 0.01);
  box(cockpit, [0.43, 0.27, 0.035], [0, 1.41, 1.005], display, 0.01);
  for (const x of [-0.68, 0.68]) { box(cockpit, [0.17, 0.085, 0.02], [x, 1.28, 0.98], black, 0.007); for (let j = -1; j <= 1; j++) box(cockpit, [0.15, 0.007, 0.024], [x, 1.28 + j * 0.024, 0.973], steel, 0); }
  const steering = mesh(cockpit, new THREE.TorusGeometry(0.17, 0.024, 8, 32), black, [0.48, 1.37, 0.86]); steering.rotation.x = -0.28;
  for (const a of [0, Math.PI * 0.7, -Math.PI * 0.7]) rod(cockpit, [0.48, 1.37, 0.86], [0.48 + Math.sin(a) * 0.145, 1.37 + Math.cos(a) * 0.145, 0.86], 0.022, dark);
  box(cockpit, [0.11, 0.095, 0.04], [0.48, 1.37, 0.85], fabric);
  rod(cockpit, [0.48, 1.37, 0.9], [0.48, 1.19, 1.19], 0.035, dark);
  for (const [x, w] of [[0.57, 0.1], [0.35, 0.075]]) { rod(cockpit, [x, 0.85, 1.01], [x, 0.73, 0.98], 0.012); const pedal = box(cockpit, [w, 0.12, 0.025], [x, 0.72, 0.97], black, 0.01); pedal.rotation.x = -0.25; }
  box(cockpit, [0.27, 0.24, 0.94], [0, 0.93, 0.2], dark, 0.045);
  box(cockpit, [0.3, 0.11, 0.41], [0, 1.09, -0.05], fabric, 0.035);
  for (const z of [0.32, 0.5]) { const ring = mesh(cockpit, new THREE.TorusGeometry(0.061, 0.012, 6, 20), steel, [0, 1.055, z]); ring.rotation.x = Math.PI / 2; }
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
    g.rotateY(Math.PI / 2); mesh(side, g, paint, [s > 0 ? 0.91 : -0.965, 0, 0], true);
    box(side, [0.095, 0.13, 1.81], [s * 0.957, 0.61, 0], dark, 0.035, true);
    for (const z of [-1.45, 1.45]) {
      const arch: V3[] = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; arch.push([s * 0.994, 0.49 + Math.sin(a) * 0.445, z + Math.cos(a) * 0.49]); }
      tube(side, arch, 0.031, dark);
    }
    for (const [id, z, length] of [['front', 0.62, 1.19], ['rear', -0.73, 1.35]] as [string, number, number][]) {
      const door = part(`door-${id}-${s}`, `${s > 0 ? '左' : '右'}${id === 'front' ? '前' : '后'}车门及扬声器`, 'shell', [s * 0.72, 0.35, 0]);
      const doorPanel = box(door, [0.024, 0.48, length], [s * 0.983, 1.005, z], paint, 0.01, true);
      // A thin dark outline makes door shut lines visible without painted-on unrelated texture.
      tube(door, [[s * 1.002, 1.24, z + length / 2], [s * 1.008, 0.85, z + length / 2 - 0.04], [s * 1.008, 0.78, z], [s * 1.002, 0.84, z - length / 2], [s * 1.002, 1.24, z - length / 2]], 0.006, dark);
      box(door, [0.045, 0.035, 0.17], [s * 1.019, 1.16, z - 0.22], trim, 0.012);
      box(door, [0.06, 0.46, length * 0.88], [s * 0.88, 1.015, z], fabric, 0.035);
      box(door, [0.09, 0.065, 0.44], [s * 0.83, 1.1, z + 0.02], dark);
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
  box(hood, [1.8, 0.21, 0.1], [0, 0.86, 2.32], dark, 0.065, true);
  for (const s of [-1, 1]) { box(hood, [0.55, 0.085, 0.07], [s * 0.61, 1.035, 2.33], headlamp, 0.025); box(hood, [0.2, 0.09, 0.045], [s * 0.74, 0.79, 2.38], dark); }
  const tail = part('tailgate', '尾门、尾灯与后保险杠', 'shell', [0, 0.46, -0.48]);
  box(tail, [1.87, 0.47, 0.13], [0, 0.98, -2.29], paint, 0.07, true);
  box(tail, [1.8, 0.06, 0.07], [0, 1.16, -2.37], taillamp, 0.02);
  box(tail, [1.77, 0.14, 0.18], [0, 0.63, -2.3], dark, 0.05, true);
  box(tail, [0.45, 0.13, 0.014], [0, 0.89, -2.367], dark);
  const roof = part('roof', '车顶、立柱与玻璃', 'shell', [0, 1.0, 0]);
  curvedPanel(roof, 1.59, -1.76, 0.7, 1.91, 1.96, 0.035);
  panel(roof, [[-0.89, 1.27, 1.15], [0.89, 1.27, 1.15], [0.755, 1.94, 0.64], [-0.755, 1.94, 0.64]], glass);
  panel(roof, [[0.87, 1.26, -2.19], [-0.87, 1.26, -2.19], [-0.74, 1.91, -1.71], [0.74, 1.91, -1.71]], glass);
  for (const s of [-1, 1]) {
    const topX = s * 0.775, bottomX = s * 0.92;
    panel(roof, [[bottomX, 1.26, 1.08], [bottomX, 1.26, -0.15], [topX, 1.93, -0.15], [topX, 1.93, 0.61]], glass);
    panel(roof, [[bottomX, 1.26, -0.24], [bottomX, 1.26, -1.89], [topX, 1.90, -1.65], [topX, 1.93, -0.24]], glass);
    for (const [a, b] of [[[bottomX, 1.23, 1.14], [topX, 1.96, 0.66]], [[bottomX, 1.24, -0.195], [topX, 1.97, -0.195]], [[bottomX, 1.24, -2.15], [topX, 1.91, -1.72]]] as [V3, V3][]) {
      const pillar = rod(roof, a, b, 0.041, paint); shell.push(pillar);
    }
    const rail = tube(roof, [[s * 0.64, 1.998, -1.48], [s * 0.67, 2.014, -0.3], [s * 0.64, 2.02, 0.45]], 0.024, paint); shell.push(rail);
    const mirror = part(`mirror-${s}`, `${s > 0 ? '左' : '右'}后视镜`, 'shell', [s * 0.72, 0.3, 0]);
    rod(mirror, [s * 0.95, 1.24, 0.91], [s * 1.12, 1.32, 0.88], 0.024, dark);
    box(mirror, [0.23, 0.13, 0.23], [s * 1.12, 1.34, 0.85], paint, 0.05, true);
    box(mirror, [0.18, 0.085, 0.012], [s * 1.12, 1.35, 0.737], trim, 0.025);
  }
  for (const s of [-1, 1]) rod(roof, [s * 0.58, 1.29, 1.13], [s * 0.14, 1.37, 1.066], 0.012, dark);

  const auxiliary = part('auxiliary-electrical', '12V 电池、配电与冷却散热器', 'electrical', [-0.24, 0.22, 0.2]);
  box(auxiliary, [0.3, 0.22, 0.25], [-0.6, 0.98, 1.88], dark);
  for (const x of [-0.69, -0.52]) box(auxiliary, [0.04, 0.025, 0.04], [x, 1.106, 1.88], x < -0.6 ? red : steel, 0.003);
  box(auxiliary, [1.15, 0.29, 0.06], [0, 0.87, 2.09], steel);
  for (let i = 0; i < 14; i++) box(auxiliary, [0.015, 0.245, 0.015], [-0.52 + i * 0.08, 0.87, 2.13], dark, 0);
  function makeBattery(id: string, name: string, size: V3, position: V3) {
    const p = part(id, name, 'energy', [0, -0.32, 0]); box(p, size, position, battery, 0.04);
    for (let i = 0; i < 7; i++) box(p, [size[0] * 0.9, 0.014, 0.025], [position[0], position[1] + size[1] / 2 + 0.008, position[2] - size[2] * 0.42 + i * size[2] * 0.14], trim, 0.004);
    return p;
  }
  function electricDrive(front: boolean) {
    const z = front ? 1.45 : -1.45;
    const p = part(front ? 'traction-motor-front' : 'traction-motor-rear', front ? 'MG2 前驱电机与减速差速器' : '后驱电机与减速差速器', 'powertrain', [0, 0.15, front ? 0.22 : -0.25]);
    const motorX = front ? 0.49 : -0.18, motorLength = front ? 0.3 : 0.49;
    cylinder(p, front ? 0.155 : 0.18, motorLength, [motorX, 0.72, z], blue); box(p, [0.25, 0.26, 0.3], [0.18, 0.62, z], steel, 0.055);
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
    for (let i = 0; i < 8; i++) box(electronics, [0.012, 0.026, 0.32], [-0.21 + i * 0.06, 1.046, z], steel, 0);
    tube(electronics, [[0.24, 0.54, kind === 'hev' ? -0.75 : 0], [0.53, 0.57, 0.25], [0.53, 0.8, z], [0.17, 0.98, z]], 0.018, copper);
    if (kind !== 'hev') {
      const charger = part('charge-system', '外接充电口、车载充电器与 DC/DC', 'electrical', [-0.3, 0.28, 0]);
      const chargerPosition: V3 = kind === 'erev' ? [-0.52, 0.89, 1.05] : [-0.31, 0.92, 1.53];
      box(charger, [0.43, 0.14, 0.36], chargerPosition, blue);
      box(charger, [0.24, 0.12, 0.28], kind === 'erev' ? [0.65, 0.98, 1.13] : [0.29, 0.9, 1.82], steel);
      box(charger, [0.025, 0.13, 0.14], [-0.999, 1.085, -1.88], dark, 0.025);
      tube(charger, [[-0.95, 1.08, -1.88], [-0.69, 0.59, -1.68], [-0.66, 0.57, 1.04], chargerPosition], 0.014, copper);
    }
  }
  if (kind !== 'bev') {
    const combustion = part('combustion-engine', kind === 'erev' ? '增程发动机（仅驱动发电机）' : '横置四缸汽油发动机', 'powertrain', [0, 0.23, 0.4], [0, 0, 0], kind === 'erev' ? '仅与发电机机械连接，不驱动车轮' : '机械动力经变速/分流机构到前差速器');
    const engineX = kind === 'hev' ? -0.34 : -0.17, engineWidth = kind === 'hev' ? 0.56 : 0.69;
    box(combustion, [engineWidth, 0.34, 0.39], [engineX, 0.86, 1.64], engine, 0.055);
    box(combustion, [engineWidth - 0.07, 0.07, 0.33], [engineX, 1.067, 1.64], dark, 0.025);
    for (let i = 0; i < 4; i++) { const cylinderX = engineX + (i - 1.5) * engineWidth * 0.21; cylinder(combustion, 0.045, 0.028, [cylinderX, 1.116, 1.64], steel, 'y', 12); tube(combustion, [[cylinderX, 0.87, 1.42], [cylinderX, 0.67, 1.29], [-0.1, 0.53, 1.18]], 0.022, steel); }
    const fuel = part('fuel-tank', '燃油箱与供油管', 'energy', [0.25, -0.19, -0.12]);
    box(fuel, [0.98, 0.2, 0.54], [0.11, 0.48, kind === 'erev' ? -0.94 : -1.11], dark, 0.08);
    tube(fuel, [[0.58, 0.51, -1.15], [0.65, 0.55, 0], [0.56, 0.79, 1.4], [0.13, 0.9, 1.64]], 0.008, steel);
    const exhaust = part('exhaust', '催化器、排气管与后消声器', 'exhaust', [-0.22, -0.15, 0]);
    tube(exhaust, [[-0.1, 0.54, 1.2], [-0.58, 0.43, 0.92], [-0.7, 0.38, -0.5], [-0.61, 0.44, -1.83], [-0.5, 0.44, -2.38]], 0.033);
    cylinder(exhaust, 0.095, 0.26, [-0.6, 0.43, 0.83], engine, 'z');
    box(exhaust, [0.46, 0.16, 0.36], [-0.52, 0.43, -1.92], engine, 0.055);
    if (kind === 'ice') {
      const gearbox = part('transmission', '前置变速器、差速器与驱动半轴', 'powertrain', [0.18, 0.15, 0.27]);
      box(gearbox, [0.42, 0.35, 0.44], [0.4, 0.7, 1.51], steel, 0.085);
      for (const s of [-1, 1]) rod(gearbox, [s * 0.18, 0.52, 1.45], [s * 0.9, 0.44, 1.45], 0.03);
    } else if (kind === 'hev') {
      electricDrive(true);
      const split = part('power-split', '行星功率分流器与 MG1 发电机', 'powertrain', [0.36, 0.36, 0.28], [0, 0, 0], '发动机同时连机械输出与 MG1 发电支路；MG2 经减速器驱动车轮');
      cylinder(split, 0.13, 0.14, [0.18, 0.91, 1.68], copper);
      cylinder(split, 0.105, 0.23, [0.48, 0.95, 1.79], blue);
      rod(split, [-0.08, 0.91, 1.68], [0.18, 0.91, 1.68], 0.022);
      rod(split, [0.18, 0.91, 1.68], [0.48, 0.95, 1.79], 0.022);
      rod(split, [0.18, 0.91, 1.68], [0.18, 0.62, 1.45], 0.024);
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; cylinder(split, 0.03, 0.15, [0.18, 0.91 + Math.cos(a) * 0.075, 1.68 + Math.sin(a) * 0.075], steel); }
    } else {
      const generator = part('range-generator', '增程发电机与电气输出（无车轮传动轴）', 'powertrain', [0.35, 0.27, 0.37], [0, 0, 0], '发动机→发电机→高压母线/电池→后逆变器→后电机；无发动机到车轮的机械通路');
      cylinder(generator, 0.15, 0.31, [0.44, 0.87, 1.64], blue);
      rod(generator, [0.1, 0.87, 1.64], [0.44, 0.87, 1.64], 0.028);
      tube(generator, [[0.43, 0.91, 1.64], [0.62, 0.7, 1.27], [0.61, 0.58, 0.4], [0.23, 0.54, 0.3]], 0.021, copper);
    }
  }
  let disposed = false;
  return { group, parts, shell, wheels, materials, dispose() {
    if (disposed) return; disposed = true;
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    group.clear();
  } };
}
