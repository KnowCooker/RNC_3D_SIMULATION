import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createAssetInspection } from './asset-inspection';
import type { ShowroomModel } from './showroom-model';
import { getXPengSpec, type XPengId } from './xpeng-catalog';
import { createP7PlusModel } from './p7plus-model';

type V = [number, number, number];
const mix = THREE.MathUtils.lerp;

/** Semantic, independently movable original geometry, reconstructed from public photography.
 * Exterior surfaces approximate silhouette; all hidden mechanical assemblies are schematic.
 * +Z front, +Y up. Every exploded transform is evaluated from its immutable origin. */
export function createXPengModel(id: XPengId): ShowroomModel {
  return id === 'p7plus' ? createP7PlusModel() : createLegacyXPengModel(id);
}
function createLegacyXPengModel(id: XPengId): ShowroomModel {
  const s = getXPengSpec(id), group = new THREE.Group(); group.name = `xpeng-${id}`;
  const shell: THREE.Mesh[] = [], geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const parts: { id: string; name: string; object: THREE.Group; offset: THREE.Vector3 }[] = [];
  function mat(color: string, roughness = .4, metalness = 0) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, side: THREE.DoubleSide }); materials.add(m); return m;
  }
  const paint = mat(s.color, .26, .62); paint.clearcoat = 1; paint.clearcoatRoughness = .16;
  const black = mat('#151c21', .3, .25), glass = mat('#203a45', .12, .25);
  glass.transparent = true; glass.opacity = .91; glass.depthWrite = false;
  const rubber = mat('#17191b', .92), alloy = mat('#a7afb3', .23, .9), darkAlloy = mat('#414a50', .52, .7);
  const leather = mat(id === 'gx' || id === 'x9' ? '#b8946f' : '#c8beb1', .83);
  const seam = mat('#827361', .85), screen = mat('#142c35', .22, .2), batteryMat = mat('#486574', .63, .5);
  const white = mat('#e2fbff', .2); white.emissive.set('#bfe9ff'); white.emissiveIntensity = 1.8;
  const red = mat('#e73138', .27); red.emissive.set('#e5222c'); red.emissiveIntensity = .85;
  function part(key: string, name: string, offset: V) {
    const object = new THREE.Group(); object.name = key; object.userData.partId = key;
    group.add(object); parts.push({ id: key, name, object, offset: new THREE.Vector3(...offset) }); return object;
  }
  function mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, pos: V = [0, 0, 0], exterior = false) {
    geometries.add(geometry); const item = new THREE.Mesh(geometry, material); item.position.set(...pos);
    item.castShadow = true; item.receiveShadow = true; parent.add(item); if (exterior) shell.push(item); return item;
  }
  function box(parent: THREE.Group, size: V, pos: V, material: THREE.Material, radius = .025, exterior = false) {
    return mesh(parent, new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map(n => n / 2))), material, pos, exterior);
  }
  function tube(parent: THREE.Group, points: V[], radius: number, material: THREE.Material, exterior = false) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(8, points.length * 5), radius, 6, false), material, [0, 0, 0], exterior);
  }
  function surface(parent: THREE.Group, fn: (u: number, v: number) => V, material: THREE.Material, exterior = false, nu = 36, nv = 10) {
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) positions.push(...fn(i / nu, j / nv));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1; indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals();
    return mesh(parent, g, material, [0, 0, 0], exterior);
  }
  const front = s.length / 2, rear = -front, wheelZ = s.wheelbase / 2, tireR = id === 'gx' || id === 'x9' ? .385 : .35;
  const half = s.width / 2;
  const width = (z: number) => half * (1 - .085 * Math.pow(Math.abs(z / front), 5));
  const noseDrop = id === 'm03' || id === 'p7plus' ? .12 : id === 'l03' ? .065 : .015;
  const belt = (z: number) => s.belt + .055 * (-z / front) + .025 * Math.cos(z / front * Math.PI) - noseDrop * Math.pow(Math.max(0, (z - wheelZ) / (front - wheelZ)), 1.6);
  const low = (z: number) => {
    let y = .24;
    for (const axle of [-wheelZ, wheelZ]) { const dz = Math.abs(z - axle), r = tireR + .055; if (dz < r) y = Math.max(y, tireR + Math.sqrt(r * r - dz * dz)); }
    return y;
  };
  const roofY = (z: number) => s.height - .055 - .025 * Math.pow((z - (s.roofFront + s.roofRear) / 2) / ((s.roofFront - s.roofRear) / 2), 2);
  const cabinX = (z: number, t: number) => mix(width(z) - .018, s.roofWidth, t);
  function cabinTop(z: number) {
    if (z > s.roofFront) return mix(roofY(s.roofFront), belt(s.screenFront) + .05, (z - s.roofFront) / (s.screenFront - s.roofFront));
    if (z < s.roofRear) return mix(roofY(s.roofRear), belt(s.screenRear) + .05, (s.roofRear - z) / (s.roofRear - s.screenRear));
    return roofY(z);
  }
  const bonnet = part('hood', '前舱盖 · 外观重建', [0, .95, .65]);
  const hoodEdge = (z: number) => belt(z) + .055 - .061 * Math.pow(THREE.MathUtils.clamp((z - s.screenFront) / (front - s.screenFront), 0, 1), 3);
  surface(bonnet, (u, v) => { const z = mix(s.screenFront, front + .006 - .031 * (v * 2 - 1) ** 4, u), x = (v * 2 - 1) * width(z); return [x, hoodEdge(z) + .045 * (1 - (v * 2 - 1) ** 2) * (1 - .8 * u), z]; }, paint, true);
  const hatch = part('tailgate', '尾门与后灯 · 外观重建', [0, .45, -1.1]);
  surface(hatch, (u, v) => { const z = mix(rear + .04, s.screenRear, u); return [(v * 2 - 1) * width(z), belt(z) + .035 + .025 * Math.sin(v * Math.PI), z]; }, paint, true);
  const roof = part('roof', '全景车顶 / 立柱 / 玻璃', [0, 1.6, 0]);
  surface(roof, (u, v) => { const z = mix(s.roofRear, s.roofFront, u), x = mix(-s.roofWidth, s.roofWidth, v); return [x, roofY(z) + .055 * Math.sin(v * Math.PI), z]; }, black, true);
  surface(roof, (u, v) => { const z = mix(s.roofRear + .1, s.roofFront - .1, u), x = mix(-s.roofWidth + .09, s.roofWidth - .09, v); return [x, roofY(z) + .055 * Math.sin((x / s.roofWidth + 1) * Math.PI / 2) + .006, z]; }, glass, true);
  for (const [baseZ, topZ] of [[s.screenFront, s.roofFront], [s.screenRear, s.roofRear]]) {
    surface(roof, (u, v) => { const z = mix(baseZ, topZ, u), x = (v * 2 - 1) * cabinX(z, u); return [x, mix(belt(baseZ) + .05, roofY(topZ), u) + .045 * Math.sin(v * Math.PI), z]; }, glass, true);
  }
  const doorSplit = -.12;
  for (const side of [-1, 1]) {
    const label = side === 1 ? '左' : '右';
    const panels: [string, string, number, number][] = [
      ['quarter', '后翼子板', rear + .025, s.screenRear + .12],
      ['rear-door', id === 'x9' ? '后滑门' : '后车门', s.screenRear + .12, doorSplit],
      ['front-door', '前车门', doorSplit, s.screenFront - .15],
      ['fender', '前翼子板', s.screenFront - .15, front - .025],
    ];
    for (const [key, name, za, zb] of panels) {
      const panel = part(`${key}-${side}`, `${label}${name}`, [side * (key.includes('door') ? 1.3 : .8), .14, key === 'quarter' ? -.35 : key === 'fender' ? .35 : 0]);
      surface(panel, (u, v) => { const z = mix(za + .007, zb - .007, u), y = mix(low(z), belt(z), v); return [side * (width(z) - .055 * (1 - v) + .038 * Math.sin(Math.PI * v)), y, z - Math.sign(z) * .11 * Math.pow(Math.abs(z / front), 12) * (1 - v) ** 2]; }, paint, true, 56, 10);
      surface(panel, (u, v) => { const z = mix(za + .007, zb - .007, u); const top = z >= s.screenFront ? hoodEdge(z) : z <= s.screenRear ? belt(z) + .035 : belt(z) + .016; return [side * width(z), mix(belt(z), top, v), z]; }, paint, true, 32, 2);
      // Sill/shoulder creases follow each physical panel; seams remain visible between assemblies.
      tube(panel, Array.from({ length: 20 }, (_, i): V => { const z = mix(za + .014, zb - .014, i / 19); return [side * (width(z) + .002), belt(z) - .085, z]; }), .005, paint, true);
      if (zb > s.screenRear && za < s.screenFront) {
        const a = Math.max(za + .015, s.screenRear + .025), b = Math.min(zb - .015, s.screenFront - .025);
        if (b > a) {
          surface(panel, (u, v) => { const z = mix(a, b, u); const top = cabinTop(z); const t = (top - belt(z)) / Math.max(.1, roofY(Math.max(s.roofRear, Math.min(s.roofFront, z))) - belt(z)); return [side * cabinX(z, v * t), mix(belt(z) + .015, top - .023, v), z]; }, glass, true);
          tube(panel, Array.from({ length: 16 }, (_, i): V => { const z = mix(a, b, i / 15); return [side * width(z), belt(z) + .012, z]; }), .012, alloy, true);
          if (key.includes('door')) {
            tube(panel, [[side * width(a), belt(a), a], [side * cabinX(a, .6), mix(belt(a), cabinTop(a), .6), a], [side * cabinX(a, 1), cabinTop(a), a]], .025, black, true);
            box(panel, [.025, .035, .19], [side * (width(a + .2) + .016), belt(a + .2) - .12, a + .2], darkAlloy, .012, true);
            surface(panel, (u, v) => { const z = mix(a + .035, b - .035, u), top = belt(z) - .045; return [side * (width(z) - .075), mix(Math.min(top, Math.max(s.belt - .32, low(z) + .035)), top, v), z]; }, leather, false, 32, 4);
          }
        }
      }
      if (key === 'front-door') {
        box(panel, [.2, .035, .075], [side * (half + .05), s.belt + .09, zb - .13], black, .018, true);
        box(panel, [.23, .105, .22], [side * (half + .14), s.belt + .15, zb - .1], paint, .049, true);
        box(panel, [.19, .07, .012], [side * (half + .15), s.belt + .15, zb - .213], glass, .026, true);
      }
    }
    // Curved A/C pillars and roof rails bind to the removable roof, not arbitrary triangle buckets.
    tube(roof, Array.from({ length: 49 }, (_, i): V => { const z = mix(s.screenRear, s.screenFront, i / 48), y = cabinTop(z); const t = (y - belt(z)) / Math.max(.1, roofY(Math.max(s.roofRear, Math.min(s.roofFront, z))) - belt(z)); return [side * cabinX(z, t), y, z]; }), .026, id === 'gx' ? black : paint, true);
    const rocker = part(`sill-${side}`, `${label}门槛`, [side * .65, .05, 0]);
    box(rocker, [.11, .08, s.wheelbase - tireR * 2], [side * (half - .065), .235, 0], black, .025, true);
  }
  for (const end of [-1, 1]) {
    const fascia = end === -1 ? hatch : part('bumper-front', '前保险杠 / 分体灯组', [0, .15, 1.2]);
    surface(fascia, (u, v) => { const x = (u * 2 - 1) * (width(end * front) - .055 * (1 - v) + .038 * Math.sin(v * Math.PI)), z = end * (front + .006 - .031 * Math.pow(Math.abs(u * 2 - 1), 4) - .11 * (1 - v) ** 2); return [x, mix(.27, belt(end * front) + (end === 1 ? .003 - .009 * (u * 2 - 1) ** 2 : .035), v), z + end * .025 * Math.sin(v * Math.PI)]; }, paint, true);
    box(fascia, [s.width * .67, .135, .045], [0, .4, end * (front + .001)], black, .034, true);
    for (let j = 0; j < 5; j++) box(fascia, [s.width * .62, .008, .015], [0, .355 + j * .022, end * (front + .028)], darkAlloy, .002, true);
    const y = belt(end * front) - .035, lightMat = end === 1 ? white : red;
    if (s.lights === 'ribbon') tube(fascia, Array.from({ length: 17 }, (_, i): V => { const x = mix(-half * .86, half * .86, i / 16); return [x, y + .012 * (1 - (x / half) ** 2), end * (front + .008 - .075 * (x / half) ** 4)]; }), .014, lightMat, true);
    for (const side of [-1, 1]) {
      if (s.lights !== 'ribbon') {
        box(fascia, [.36, .025, .037], [side * half * .73, y, end * (front - .012)], lightMat, .011, true);
        box(fascia, [.032, .17, .037], [side * half * .74, y - .078, end * (front - .005)], lightMat, .013, true);
      } else if (end === 1) {
        box(fascia, [.17, .19, .036], [side * half * .79, y - .245, front - .01], black, .038, true);
        for (let j = 0; j < 2; j++) box(fascia, [.095, .019, .044], [side * half * .79, y - .2 - j * .065, front + .01], white, .007, true);
      }
    }
    box(fascia, [.35, .11, .025], [0, .58, end * (front + .034)], black, .012, true);
  }
  // Model-specific tail spoilers: fastback wing vs high roof lip.
  if (id === 'p7plus' || id === 'm03') box(hatch, [s.width * .86, .025, .15], [0, s.belt + .16, rear + .14], id === 'p7plus' ? black : paint, .01, true);
  else box(roof, [s.roofWidth * 2, .045, .16], [0, roofY(s.roofRear) - .015, s.roofRear - .045], black, .015, true);
  // Wheels: rounded tire profile, shoulder rings, brake rotor and machined radial spokes.
  for (const axle of [-1, 1]) for (const side of [-1, 1]) {
    const z = axle * wheelZ, x = side * (half - .115);
    const wheel = part(`wheel-${axle}-${side}`, `${axle === 1 ? '前' : '后'}${side === 1 ? '左' : '右'}轮 / 制动`, [side * 1.45, 0, axle * .22]);
    wheel.userData.axleZ = z;
    const profile = [[.24, -.125], [tireR - .035, -.125], [tireR, -.09], [tireR, .09], [tireR - .035, .125], [.24, .125], [.24, -.125]].map(([r, y]) => new THREE.Vector2(r, y));
    const tire = mesh(wheel, new THREE.LatheGeometry(profile, 56), rubber, [x, tireR, z]); tire.rotation.z = Math.PI / 2;
    for (const r of [tireR - .025, .253]) { const ring = mesh(wheel, new THREE.TorusGeometry(r, .004, 5, 56), rubber, [x + side * .126, tireR, z]); ring.rotation.y = Math.PI / 2; }
    const rotor = mesh(wheel, new THREE.CylinderGeometry(.225, .225, .015, 40), darkAlloy, [x + side * .07, tireR, z]); rotor.rotation.z = Math.PI / 2;
    const rim = mesh(wheel, new THREE.TorusGeometry(.253, .013, 8, 48), alloy, [x + side * .128, tireR, z]); rim.rotation.y = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const spoke = box(wheel, [.022, .21, .029], [x + side * .127, tireR + Math.cos(a) * .13, z + Math.sin(a) * .13], alloy, .008); spoke.rotation.x = a;
    }
    const hub = mesh(wheel, new THREE.CylinderGeometry(.063, .063, .035, 24), alloy, [x + side * .14, tireR, z]); hub.rotation.z = Math.PI / 2;
    box(wheel, [.045, .13, .065], [x + side * .06, tireR + .02, z + .18], mat('#747c80', .48, .55));
  }
  // Authored interior topology reflects visible row counts; packaging remains schematic.
  const floor = part('platform', '地板 / 纵梁 · 结构示意', [0, .04, -1.3]);
  box(floor, [s.width - .26, .06, s.length - .72], [0, .38, -.12], black, .025);
  for (const side of [-1, 1]) box(floor, [.09, .1, s.wheelbase + .25], [side * .64, .30, 0], darkAlloy);
  const rowZ = s.rows.length === 3 ? [.78, -.35, -1.43] : [.60, -.70];
  s.rows.forEach((count, row) => {
    for (let seat = 0; seat < count; seat++) {
      const x = count === 2 ? (seat ? -.47 : .47) : (1 - seat) * .5;
      const z = rowZ[row], w = count === 2 ? .47 : .43;
      const chair = part(`seat-${row + 1}-${seat + 1}`, `${row + 1}排 ${seat + 1}座 · 内饰重建`, [x * 1.7, .75 + row * .3, -.15 * row]);
      chair.userData.seatRow = row + 1;
      box(chair, [w, .12, .47], [x, .60, z], leather, .055);
      const back = box(chair, [w, .52, .13], [x, .91, z - .24], leather, .06); back.rotation.x = -.12;
      box(chair, [w * .61, .17, .105], [x, 1.24, z - .29], leather, .045);
      for (const side of [-1, 1]) {
        box(chair, [.07, .11, .43], [x + side * (w / 2 - .04), .68, z], leather, .032);
        tube(chair, [[x + side * (w / 2 - .085), .70, z - .20], [x + side * (w / 2 - .085), .91, z - .16], [x + side * (w / 2 - .085), 1.12, z - .20]], .004, seam);
        if (s.rows.length === 3 && row === 1) box(chair, [.065, .06, .29], [x + side * .255, .80, z + .01], leather);
      }
      box(chair, [w * .65, .18, .29], [x, .46, z], darkAlloy);
    }
  });
  const cockpit = part('cockpit', '仪表台 / 方向盘 / 中控屏', [0, .65, 1.1]);
  const dashZ = s.screenFront - .2, dashY = s.belt - .08;
  box(cockpit, [s.width - .2, .15, .34], [0, dashY, dashZ], black, .065);
  box(cockpit, [s.width - .25, .1, .22], [0, dashY - .11, dashZ], leather, .035);
  box(cockpit, [.38, .25, .035], [0, dashY + .085, dashZ - .2], black, .013);
  box(cockpit, [.35, .22, .006], [0, dashY + .085, dashZ - .221], screen, .006);
  for (let j = 0; j < 3; j++) box(cockpit, [.065, .012, .008], [-.105 + j * .105, dashY + .15, dashZ - .227], white, .003);
  if (id !== 'm03' && id !== 'l03') box(cockpit, [.25, .095, .035], [.46, dashY + .065, dashZ - .17], screen, .012);
  const steering = mesh(cockpit, new THREE.TorusGeometry(.155, .017, 10, 40), black, [.46, dashY - .01, dashZ - .38]); steering.rotation.x = -.25;
  box(cockpit, [.22, .032, .028], [.46, dashY - .01, dashZ - .38], alloy, .01);
  box(cockpit, [.065, .09, .04], [.46, dashY - .02, dashZ - .385], black, .02);
  box(cockpit, [.28, .16, .64], [0, .65, .55], leather, .045);
  box(cockpit, [.23, .02, .29], [0, .743, .70], black, .015);
  const battery = part('battery', '动力电池包 · 内部布局示意', [0, .08, 3.25]);
  box(battery, [1.38, .13, s.wheelbase - .72], [0, .235, -.05], batteryMat, .025);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) box(battery, [.41, .03, (s.wheelbase - .86) / 6], [(j - 1) * .435, .317, mix(-s.wheelbase / 2 + .47, s.wheelbase / 2 - .57, i / 5)], alloy, .008);
  // L03 drive axle has not been independently verified: do not invent its motor location.
  const driveAxles = s.drive === 'awd' ? [-1, 1] : s.drive === 'front' ? [1] : s.drive === 'rear' ? [-1] : [];
  for (const axle of [-1, 1]) {
    const subframe = part(`suspension-${axle}`, `${axle === 1 ? '前' : '后'}悬架 / 副车架 · 示意`, [0, .25, axle * 1.9]);
    box(subframe, [1.55, .065, .16], [0, .34, axle * wheelZ], darkAlloy);
    for (const side of [-1, 1]) {
      tube(subframe, [[side * .35, .34, axle * wheelZ - .20], [side * .81, .35, axle * wheelZ], [side * .35, .34, axle * wheelZ + .20]], .023, alloy);
      tube(subframe, [[side * .78, .36, axle * wheelZ], [side * .73, .74, axle * wheelZ]], .027, darkAlloy);
    }
    if (driveAxles.includes(axle)) {
      const motor = part(`motor-${axle}`, `${axle === 1 ? '前' : '后'}电驱总成 · 示意`, [0, .80, axle * 1.9]);
      const body = mesh(motor, new THREE.CylinderGeometry(.135, .135, .39, 24), alloy, [0, .48, axle * wheelZ]); body.rotation.z = Math.PI / 2;
      box(motor, [.32, .1, .22], [0, .65, axle * wheelZ], darkAlloy);
      tube(motor, [[-.75, tireR, axle * wheelZ], [0, .48, axle * wheelZ], [.75, tireR, axle * wheelZ]], .018, alloy);
    }
  }
  if (s.generator) {
    const generator = part('generator', '前舱增程发电机组 · 示意', [0, 1.4, 2.0]);
    box(generator, [.48, .31, .38], [0, .67, wheelZ + .1], darkAlloy, .04);
    box(generator, [.43, .055, .32], [0, .85, wheelZ + .1], black);
  }
  group.updateMatrixWorld(true);
  const inspection = createAssetInspection(group, shell);
  let disposed = false;
  return {
    assetId: `xpeng-${id}`, title: s.name, credit: '原创照片参考重建', source: s.source, group,
    parts: parts.map(({ id: key, name }) => ({ id: key, name })), inspection,
    partForObject(object) { for (let cursor: THREE.Object3D | null = object; cursor && cursor !== group; cursor = cursor.parent) if (typeof cursor.userData.partId === 'string') return cursor.userData.partId; return null; },
    selectPart(key) { inspection.select(parts.find(p => p.id === key)?.object ?? null); },
    setPartProgress(key, progress) { if (!Number.isFinite(progress)) throw new Error('Non-finite disassembly progress'); const p = parts.find(item => item.id === key); if (p) p.object.position.copy(p.offset).multiplyScalar(THREE.MathUtils.clamp(progress, 0, 1)); },
    setPaint(color) { paint.color.set(color); for (const item of shell) { const m = item.material as THREE.MeshPhysicalMaterial; if (m.clearcoat === 1) m.color.set(color); } },
    dispose() { if (disposed) return; disposed = true; inspection.dispose(); for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose(); group.removeFromParent(); group.clear(); },
  };
}
