import { coachworkSurface } from './coachwork-surface';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createAssetInspection } from './asset-inspection';
import type { ShowroomModel } from './showroom-model';

type V = [number, number, number];
type Profile = readonly (readonly [number, number])[];
const lerp = THREE.MathUtils.lerp;
/** Cubic longitudinal stations, independently traced for the P7+ (metres, +Z forward).
 * The public photographs constrain silhouette, not OEM engineering tolerances. */
function sample(rows: Profile, z: number): number {
  let i = 0; while (i < rows.length - 2 && z > rows[i + 1][0]) i++;
  const a = rows[i], b = rows[i + 1], prev = rows[Math.max(0, i - 1)], next = rows[Math.min(rows.length - 1, i + 2)];
  const t = THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1), d = b[0] - a[0];
  const m0 = (b[1] - prev[1]) / (b[0] - prev[0]), m1 = (next[1] - a[1]) / (next[0] - a[0]);
  return (2 * t ** 3 - 3 * t * t + 1) * a[1] + (t ** 3 - 2 * t * t + t) * d * m0 + (-2 * t ** 3 + 3 * t * t) * b[1] + (t ** 3 - t * t) * d * m1;
}
const roofStations: Profile = [[-2.31, 1.09], [-1.92, 1.185], [-1.42, 1.315], [-.85, 1.438], [-.25, 1.502], [.28, 1.489], [.65, 1.414], [1.03, 1.24], [1.39, 1.035]];
const shoulderStations: Profile = [[-2.22, 1.065], [-1.7, 1.08], [-1, 1.06], [0, 1.02], [.8, .998], [1.35, 1.017], [1.65, 1.003], [1.96, .957], [2.22, .872]];
const widthStations: Profile = [[-2.22, .938], [-1.6, .966], [-.7, .946], [.1, .938], [.85, .951], [1.5, .967], [1.9, .954], [2.22, .934]];
const hoodStations: Profile = [[1.2, 1.003], [1.48, .996], [1.78, .956], [2.06, .891], [2.45, .769]];
export const p7Surface = {
  roof: (z: number) => sample(roofStations, z),
  shoulder: (z: number) => sample(shoulderStations, z),
  width: (z: number) => sample(widthStations, z),
  hood: (z: number) => sample(hoodStations, z),
};

/** Dedicated P7+ exterior. Other XPeng factories deliberately remain untouched. */
export function createP7PlusModel(): ShowroomModel {
  const group = new THREE.Group(); group.name = 'xpeng-p7plus'; group.userData.revision = 'p7plus-photo-v5';
  const parts: { id: string; name: string; object: THREE.Group; offset: THREE.Vector3 }[] = [];
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), shell: THREE.Mesh[] = [];
  function material(color: string, roughness: number, metalness = 0) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, side: THREE.DoubleSide }); materials.add(m); return m;
  }
  const paint = material('#b8bdc2', .28, .42); paint.clearcoat = 1; paint.clearcoatRoughness = .20;
  const gloss = material('#11161c', .22, .34), rubber = material('#141619', .92), metal = material('#b5bdc5', .24, .9);
  const gunmetal = material('#3c4349', .42, .8), lining = material('#252c35', .9);
  const glass = material('#0b1721', .13, .02); glass.transparent = true; glass.opacity = .97; glass.depthWrite = false;
  glass.envMapIntensity = .7; glass.name = 'p7-window-glass';
  const lampHousing=material('#080c11',.40,.09);lampHousing.envMapIntensity=.20;
  const lens = material('#17222b', .12, .55), leather = material('#c2b6a2', .68), leatherDark = material('#736a60', .79);
  const ivory = material('#c9c7ba', .65), display = material('#18252f', .24, .22), stitch = material('#879099', .9);
  const led = material('#d9f5ff', .23); led.emissive.set('#b9e3f0'); led.emissiveIntensity = 1.15;
  const tail = material('#d22329', .24); tail.emissive.set('#ed101c'); tail.emissiveIntensity = .85;
  const ambient = material('#5978cd', .5); ambient.emissive.set('#406cff'); ambient.emissiveIntensity = .6;
  const cellMat = material('#596c74', .6, .5);
  function part(id: string, name: string, offset: V) {
    const object = new THREE.Group(); object.name = id; object.userData.partId = id;
    group.add(object); parts.push({ id, name, object, offset: new THREE.Vector3(...offset) }); return object;
  }
  function mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, mat: THREE.Material, pos: V = [0, 0, 0], outer = false) {
    geometries.add(geometry); const object = new THREE.Mesh(geometry, mat); object.position.set(...pos); object.castShadow = object.receiveShadow = true;
    parent.add(object); if (outer) shell.push(object); return object;
  }
  function box(parent: THREE.Group, size: V, pos: V, mat: THREE.Material, radius = .018, outer = false) {
    return mesh(parent, new RoundedBoxGeometry(...size, 5, Math.min(radius, ...size.map(v => v / 2))), mat, pos, outer);
  }
  function surface(parent: THREE.Group, fn: (u: number, v: number) => V, mat: THREE.Material, outer = false, nu = 64, nv = 16) {
    return mesh(parent, coachworkSurface(fn, nu, nv), mat, [0, 0, 0], outer);
  }
  function tube(parent: THREE.Group, points: V[], radius: number, mat: THREE.Material, outer = false, closed = false) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal'), Math.max(16, points.length * 3), radius, 8, closed), mat, [0, 0, 0], outer);
  }
  function polygon(parent: THREE.Group, points: V[], mat: THREE.Material, outer = false) {
    const shape = new THREE.BufferGeometry();
    const normal = new THREE.Vector3();
    points.forEach((a, i) => { const b = points[(i + 1) % points.length]; normal.x += (a[1] - b[1]) * (a[2] + b[2]); normal.y += (a[2] - b[2]) * (a[0] + b[0]); normal.z += (a[0] - b[0]) * (a[1] + b[1]); });
    const axis = Math.abs(normal.x) > Math.abs(normal.y) && Math.abs(normal.x) > Math.abs(normal.z) ? 0 : Math.abs(normal.y) > Math.abs(normal.z) ? 1 : 2;
    const contour = points.map(p => new THREE.Vector2(p[(axis + 1) % 3], p[(axis + 2) % 3]));
    const indices = THREE.ShapeUtils.triangulateShape(contour, []).flat();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3)); shape.setIndex(indices); shape.computeVertexNormals(); return mesh(parent, shape, mat, [0, 0, 0], outer);
  }
  const tireR = .369, axleZ = 1.5;
  const lower = (z: number) => { let y = .205; for (const axle of [-axleZ, axleZ]) { const d = z - axle, r = .407; if (Math.abs(d) < r) y = Math.max(y, tireR + Math.sqrt(r * r - d * d)); } return y; };
  const sideX = (z: number, y: number) => {
    const top = p7Surface.shoulder(z), t = THREE.MathUtils.clamp((y - .205) / (top - .205), 0, 1);
    return p7Surface.width(z) + sample([[0, -.058], [.13, -.020], [.40, -.027], [.69, .001], [.82, 0], [1, -.058]], t);
  };
  const belt = (z: number) => lerp(1.081, 1.01, THREE.MathUtils.clamp((z + 2.31) / 3.7, 0, 1));
  const canopyEdge = (z: number): V => {
    const y = p7Surface.roof(z) - .027, t = THREE.MathUtils.clamp((y - belt(z)) / (1.47 - belt(z)), 0, 1);
    return [lerp(.906, .737, t), y, z];
  };
  const canopyPoint = (z: number, u: number): V => { const edge = canopyEdge(z); return [edge[0] * u, p7Surface.roof(z) - .027 * u * u, z]; };
  const hoodPoint = (u: number, v: number): V => {
    const x = v * lerp(.808, .860, u), z = lerp(1.2, 2.433 - .224 * Math.abs(v) ** 3, u);
    return [x, p7Surface.hood(z) + .016 * Math.abs(v) ** 4 - .012 * Math.exp(-Math.pow((Math.abs(v) - .74) / .12, 2)), z];
  };
  const hood = part('hood', 'P7+ 前舱盖 · 双曲面压线', [0, 1.00, .55]);
  surface(hood, (u, v) => hoodPoint(u, v * 2 - 1), paint, true, 64, 40);
  // Bonnet seam follows the sampled sheet, with a physical narrow panel gap.
  for (const side of [-1, 1]) tube(hood, Array.from({ length: 40 }, (_, i): V => { const p = hoodPoint(i / 39, side); return [p[0], p[1] + .0005, p[2]]; }), .0028, gloss, true);
  // Four swept wings of the bonnet badge, mapped to the sheet instead of floating above it.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) polygon(hood, [[sx * .006, 0, 2.296], [sx * .070, 0, 2.296 + sz * .025], [sx * .045, 0, 2.296 + sz * .002]].map(([x, , z]): V => [x, p7Surface.hood(z) + .004, z]), gunmetal, true);

  const roof = part('roof', 'P7+ 悬浮车顶 / 全景天幕 / 前风挡', [0, 1.58, 0]);
  const rear = part('tailgate', 'P7+ 掀背后风挡 / 尾门 / 尾灯总成', [0, .45, -1.1]);
  for (const [za, zb, mat] of [[-2.31, -.85, glass], [-.85, .50, gloss], [.50, 1.39, glass]] as [number, number, THREE.Material][]) surface(za === -2.31 ? rear : roof, (u, v) => canopyPoint(lerp(za, zb, u), v * 2 - 1), mat, true, 60, 32);
  surface(roof, (u, v) => { const p = canopyPoint(lerp(-.77, .435, u), (v * 2 - 1) * .92); p[1] += .002; return p; }, glass, true);
  surface(roof,(u,v)=>{const z=lerp(1.20,1.42,u),t=v*2-1;return [t*.805,lerp(p7Surface.roof(1.20)-.027*t*t,p7Surface.hood(1.42)+.002,u),z];},gloss,true,24,24);
  for (const side of [-1, 1]) {
    tube(roof, Array.from({ length: 80 }, (_, i): V => { const p = canopyEdge(lerp(-2.31, 1.39, i / 79)); return [p[0] * side, p[1], p[2]]; }), .016, gloss, true);
    // Windshield wipers and cowl sit below the windscreen edge.
    tube(roof, [[side * .1, 1.024, 1.38], [side * .39, 1.039, 1.34], [side * .72, 1.046, 1.31]], .008, rubber, true);
  }
  for (const side of [-1, 1]) {
    const label = side === 1 ? '左' : '右';
    const ranges: [string, string, number, number][] = [['quarter', '后翼子板 / 三角窗', -2.22, -1.18], ['rear-door', '无框后车门', -1.18, -.05], ['front-door', '无框前车门', -.05, 1.02], ['fender', '前翼子板', 1.02, 2.22]];
    for (const [key, title, za, zb] of ranges) {
      const panel = part(`${key}-${side}`, `P7+ ${label}${title}`, [side * (key.includes('door') ? 1.3 : .90), .10, key === 'quarter' ? -.38 : key === 'fender' ? .38 : 0]);
      const zAt = (u: number) => lerp(za + .0025, zb - .0025, u);
      surface(panel, (u, v) => { const z = zAt(u), y = lerp(lower(z), p7Surface.shoulder(z), v); return [side * sideX(z, y), y, z]; }, paint, true, 80, 24);
      // Turn the arch skin inwards; visible wells are dark, not open paper-thin cutouts.
      surface(panel, (u, v) => { const z = zAt(u), y = lower(z); return [side * (sideX(z, y) - v * .065), y - v * .012, z]; }, paint, true, 80, 3);
      if (zb > -2.31 && za < 1.39) {
        const a = Math.max(za + .004, -1.73), b = Math.min(zb - .004, 1.39);
        surface(panel, (u, v) => { const z = lerp(a, b, u), edge = canopyEdge(z), baseY = Math.max(belt(z), p7Surface.shoulder(z)); return [side * lerp(sideX(z, baseY), edge[0], v), lerp(baseY + .008, Math.max(baseY + .01, edge[1] - .005), v), z]; }, glass, true, 48, 12);
        tube(panel, Array.from({ length: 40 }, (_, i): V => { const z = lerp(a, b, i / 39), y = Math.max(belt(z), p7Surface.shoulder(z)); return [side * sideX(z, y), y + .006, z]; }), .008, gloss, true);
        // Upper shoulder rolls inwards to the window belt.
        surface(panel, (u, v) => { const z = lerp(a, b, u), y = lerp(p7Surface.shoulder(z), Math.max(belt(z), p7Surface.shoulder(z)) + .008, v); return [side * sideX(z, p7Surface.shoulder(z)), y, z]; }, paint, true, 36, 3);
        if (key.includes('door')) {
          const z = a + .06, e = canopyEdge(z);
          surface(panel, (u, v) => { const zz = z + u * .04; return [side * lerp(sideX(zz, belt(zz)) + .002, e[0] + .002, v), lerp(belt(zz), e[1], v), zz]; }, gloss, true, 2, 12);
          const handleZ = a + .22, handleY = p7Surface.shoulder(handleZ) - .13;
          box(panel, [.012, .027, .203], [side * (sideX(handleZ, handleY) + .005), handleY, handleZ], gunmetal, .012, true);
          box(panel, [.015, .018, .191], [side * (sideX(handleZ, handleY) + .008), handleY + .001, handleZ], paint, .008, true);
          surface(panel, (u, v) => { const zz = lerp(a + .05, b - .05, u), top = belt(zz) - .035; return [side * (sideX(zz, top) - .05), lerp(Math.min(top, Math.max(lower(zz) + .03, .66)), top, v), zz]; }, leatherDark, false, 40, 4);
          tube(panel, [[side * .84, .91, a + .11], [side * .84, .9, (a + b) / 2], [side * .83, .9, b - .11]], .006, ambient);
          box(panel, [.055, .055, .42], [side * .795, .79, (a + b) / 2], leather, .023);
        }
      }
      if(key!=='fender')surface(panel,(u,v)=>{const z=zAt(u),y0=p7Surface.shoulder(z),y1=Math.max(belt(z),y0)+.008;return [side*sideX(z,lerp(y0,y1,v)),lerp(y0,y1,v),z];},paint,true,80,8);
      if(key==='quarter')surface(panel,(u,v)=>{const z=lerp(za+.003,-1.734,u),edge=canopyEdge(z),baseY=Math.max(belt(z),p7Surface.shoulder(z));return [side*lerp(sideX(z,baseY),edge[0],v),lerp(baseY+.008,Math.max(baseY+.01,edge[1]),v),z];},paint,true,64,24);
      if (key === 'fender') {
        // Explicit wing-to-bonnet patch preserves raised fender crowns.
        surface(panel, (u, v) => { const inner = hoodPoint(u, side), z = inner[2], y = p7Surface.shoulder(z); return [lerp(inner[0] + side * .004, side * sideX(z, y), v), lerp(inner[1], y, v) + .025 * Math.sin(v * Math.PI), z]; }, paint, true, 64, 14);
        box(panel, [.018, .03, .105], [side * .95, .85, 1.04], gloss, .014, true);
      }
      if (key === 'front-door') {
        tube(panel, [[side * .875, 1.015, .82], [side * 1.022, 1.04, .84]], .023, gloss, true);
        const mirror = mesh(panel, new THREE.SphereGeometry(1, 28, 16), gloss, [side * 1.035, 1.106, .89], true); mirror.scale.set(.148, .068, .118);
        const cap = mesh(panel, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gloss, [side * 1.035, 1.111, .89], true); cap.scale.set(.149, .063, .119);
        box(panel, [.205, .071, .006], [side * 1.044, 1.098, .788], metal, .03, true);
      }
      if (key === 'quarter' && side === 1) {
        const points = [[-.10, -.055], [.085, -.055], [.10, -.035], [.10, .055], [-.085, .055], [-.10, .035], [-.10, -.055]];
        tube(panel, points.map(([dz, dy]): V => { const z = -1.95 + dz, y = .985 + dy; return [sideX(z, y) + .003, y, z]; }), .0025, gloss, true);
      }
    }
    const sill = part(`sill-${side}`, `P7+ ${label}空气动力学侧裙`, [side * .70, 0, 0]);
    surface(sill, (u, v) => { const z = lerp(-1.08, 1.07, u); return [side * (.87 + .036 * Math.sin(v * Math.PI)), .195 + .046 * v, z]; }, gloss, true, 40, 8);
    tube(sill, [[side * .898, .221, -1.07], [side * .896, .222, 0], [side * .898, .221, 1.07]], .007, gunmetal, true);
  }
  // Front bumper is a rounded wraparound surface, not a planar box.
  const nose = part('bumper-front', 'P7+ 2026 星翼灯 / 分体前灯 / 双段格栅', [0, .15, 1.15]);
  const noseZ = (x: number, y: number) => { const t = Math.abs(x) / sideX(2.22, y); return 2.22 + .313 * Math.sqrt(Math.max(0, 1 - t ** 3.3)) - .025*((y-.53)/.37)**2*(1-t*t) - .10 * Math.pow(THREE.MathUtils.clamp((.43 - y) / .22, 0, 1), 2) * (1 - t) ** 2 - .016 * Math.exp(-Math.pow((y - .69) / .075,2)) * (1 - t * t) - .022*THREE.MathUtils.smoothstep(Math.abs(x),.58,.64)*(1-THREE.MathUtils.smoothstep(Math.abs(x),.88,.93))*THREE.MathUtils.smoothstep(y,.545,.585)*(1-THREE.MathUtils.smoothstep(y,.66,.70)); };
  const noseTopWidth = sideX(2.22, .872);
  const noseY = (x: number) => .756 + .116 * Math.pow(Math.abs(x) / noseTopWidth, 2.5);
  surface(nose, (u, v) => { const t = u * 2 - 1, y = lerp(.205, noseY(t * noseTopWidth), v), x = t * sideX(2.22, y); return [x, y, noseZ(x, y)]; }, paint, true, 100, 28);
  surface(nose, (u, v) => { const t = u * 2 - 1, h = hoodPoint(1, t), x = lerp(h[0], t * noseTopWidth, v), y = lerp(h[1] - .003, noseY(t * noseTopWidth), v); return [x, y, lerp(h[2] + .004, noseZ(x, y), v)]; }, paint, true, 80, 12);
  const drlPath = Array.from({ length: 70 }, (_, i): V => { const x = lerp(-.87, .87, i / 69), y = noseY(x) - .021; return [x, y, noseZ(x, y) + .006]; });
  tube(nose, drlPath, .018, gloss, true); tube(nose, drlPath.map(([x, y, z]): V => [x, y - .006, z + .017]), .0065, led, true);
  const frontPatch = (x0: number, x1: number, y0: number, y1: number, m: THREE.Material, skew = 0) => surface(nose, (u, v) => { const x = lerp(x0, x1, u), y = lerp(y0, y1, v) + skew * u; return [x, y, noseZ(x, y) + (m===lining?.027:m===gunmetal?.029:.021)]; }, m, true, 24, 10);
  for (const side of [-1, 1]) {
    // Tapered separate headlight pockets below the continuous upper light.
    // Rounded, swept trapezoids traced from official front/detail photos, not rectangular emissive blocks.
    const outline = new THREE.CatmullRomCurve3([[.592,.662],[.76,.687],[.899,.697],[.921,.663],[.929,.55],[.90,.546],[.648,.567],[.62,.585]].map(([x,y])=>new THREE.Vector3(side*x,y,0)),true,'centripetal');
    surface(nose,(u,v)=>{const p=outline.getPoint(u),x=lerp(side*.77,p.x,v),y=lerp(.62,p.y,v);return [x,y,noseZ(x,y)+.010+.002*v];},lampHousing,true,96,10).name='front-lamp-pocket';
    const pocketEdge=outline.getPoints(96).map(p=>[p.x,p.y,noseZ(p.x,p.y)+.015] as V);
    tube(nose,pocketEdge,.0035,gunmetal,true,true);
    const guide:V[]=Array.from({length:36},(_,i)=>{const t=i/35,x=side*lerp(.639,.914,t),y=.579-.025*t+.011*Math.exp(-t*15);return [x,y,noseZ(x,y)+.020];});
    tube(nose,guide,.0065,led,true);
    for(let i=0;i<3;i++){
      const x=side*(.664+i*.085),y=.637+i*.009;
      frontPatch(x-.032,x+.032,y-.017,y+.017,gunmetal);
      const optic=mesh(nose,new THREE.SphereGeometry(1,24,12),lens,[x,y,noseZ(x,y)+.026],true);optic.scale.set(.025,.013,.008);optic.name='headlamp-projector';
      frontPatch(x-.021,x+.021,y+.008,y+.011,metal);
    }
    // Closed aero shutter, bevelled vertical vanes and bright lower lip, as in the 2026 fascia.
    frontPatch(side*.115,side*.885,.240,.401,gloss,-.003);
    frontPatch(side*.14,side*.60,.257,.382,lining);
    for(const [a,b] of [[.14,.20],[.59,.67],[.84,.89]]) surface(nose,(u,v)=>{const x=side*lerp(a,b,u)+side*.028*(1-v),y=lerp(.24,.404,v);return [x,y,noseZ(x,y)+.016+.017*Math.sin(u*Math.PI)];},gloss,true,8,16);
    tube(nose,Array.from({length:32},(_,i):V=>{const x=side*lerp(.14,.875,i/31),y=.238;return [x,y,noseZ(x,y)+.019];}),.012,metal,true);
    for (const x of [side * .43, side * .87]) {
      const sensor = mesh(nose, new THREE.CylinderGeometry(.009, .009, .004, 16), paint, [x, .469, noseZ(x, .469) + .006], true); sensor.rotation.x = Math.PI / 2;
    }
  }
  frontPatch(-.16, .16, .225, .396, gloss);
  const frontCamera=mesh(nose,new THREE.SphereGeometry(.011,20,12),lens,[0,.642,noseZ(0,.642)+.011],true);frontCamera.name='front-camera';
  box(nose,[.063,.070,.003],[.49,.518,noseZ(.49,.518)+.007],gunmetal,.016,true);
  box(nose,[.059,.066,.003],[.49,.518,noseZ(.49,.518)+.009],paint,.014,true);
  tube(nose, Array.from({ length: 45 }, (_, i): V => { const x = lerp(-.88, .88, i / 44); return [x, .217, noseZ(x, .217) + .008]; }), .014, gunmetal, true);
  box(nose, [.405, .137, .014], [0, .46, 2.542], gloss, .008, true);
  // P7+ lettering is authored stroke geometry, not a redistributed photo texture.
  const glyph: Record<string, number[][][]> = { P: [[[0, 0], [0, 1], [.65, 1], [.8, .85], [.65, .6], [0, .6]]], '7': [[[0, 1], [.8, 1], [.25, 0]]], '+': [[[0, .5], [.8, .5]], [[.4, .1], [.4, .9]]], X: [[[0, 0], [.8, 1]], [[0, 1], [.8, 0]]], E: [[[.8, 1], [0, 1], [0, 0], [.8, 0]], [[0, .5], [.6, .5]]], N: [[[0, 0], [0, 1], [.8, 0], [.8, 1]]], G: [[[.8, .85], [.65, 1], [.1, 1], [0, .8], [0, .2], [.1, 0], [.8, 0], [.8, .5], [.5, .5]]] };
  function lettering(parent: THREE.Group, text: string, height: number, origin: V, direction: number, mat: THREE.Material) {
    [...text].forEach((char, i) => { for (const points of glyph[char] ?? []) tube(parent, points.map(([x, y]): V => [origin[0] + direction * (x + i * 1.32) * height, origin[1] + y * height, origin[2]]), height * .04, mat, true); });
  }
  lettering(nose, 'P7+', .046, [-.079, .45, 2.551], 1, ivory);
  const rearZ = (x: number, y: number) => { const t = Math.abs(x) / sideX(-2.22, y), recess = .070 * THREE.MathUtils.smoothstep(.38-Math.abs(x),0,.035) * THREE.MathUtils.smoothstep(y,.420,.452) * (1-THREE.MathUtils.smoothstep(y,.603,.635)); return -2.22 - .313 * Math.sqrt(Math.max(0, 1 - t ** 3.5)) + .075 * Math.pow(THREE.MathUtils.clamp((.5 - y) / .3, 0, 1), 2) * (1 - t) ** 2 + recess + .021*Math.exp(-Math.pow((y-.73)/.085,2))*(1-t*t); };
  const bumperRear = part('bumper-rear', 'P7+ 后保险杠 / 牌照凹槽 / 扩散器', [0, .08, -1.75]);
  surface(bumperRear, (u, v) => { const t = u * 2 - 1, y = lerp(.205, .638, v), x = t * sideX(-2.22, y); return [x, y, rearZ(x, y)]; }, paint, true, 88, 18);
  surface(rear, (u, v) => { const t = u * 2 - 1, y = lerp(.642, 1.065 - .027 * (1 - t * t), v), x = t * sideX(-2.22, y); return [x, y, rearZ(x, y)]; }, paint, true, 88, 18);
  // Recessed seal backs the physical panel gap without joining the detachable assemblies.
  surface(rear, (u, v) => { const y=lerp(.628,.652,v),x=(u*2-1)*sideX(-2.22,y); return [x,y,rearZ(x,y)+.006]; }, lining, true, 88, 4);
  surface(rear, (u, v) => { const t = u * 2 - 1, y = lerp(1.074, 1.038 + .027 * t * t, v), x = t * sideX(-2.22, y); return [x, y, lerp(-2.21, rearZ(x, y), v)]; }, paint, true, 60, 10);
  const rearBar = Array.from({ length: 65 }, (_, i): V => { const x = lerp(-.92, .92, i / 64), y = .867 - .013 * (1 - (x / .92) ** 2); return [x, y, rearZ(x, y) - .008]; });
  tube(rear, rearBar, .024, gloss, true); tube(rear, rearBar.map(([x, y, z]): V => [x, y+.003, z - .024]), .009, tail, true);
  tube(rear,rearBar.map(([x,y,z]):V=>[x,y-.015,z-.020]),.003,gunmetal,true);
  for (const side of [-1, 1]) {
    const p: V[] = [[side * .77, .865, rearZ(side * .77, .865) - .014], [side * .91, 1.025, rearZ(side * .91, 1.025) - .012], [side * .925, .872, rearZ(side * .925, .872) - .01]];
    surface(rear, (u, v) => { const x = lerp(p[0][0], lerp(p[1][0], p[2][0], u), v), y = lerp(p[0][1], lerp(p[1][1], p[2][1], u), v); return [x, y, rearZ(x, y) - .014]; }, gloss, true, 16, 14);
    tube(rear, Array.from({ length: 18 }, (_, i): V => { const x = lerp(p[1][0], p[0][0], i / 17), y = lerp(p[1][1], p[0][1], i / 17); return [x, y, rearZ(x, y) - .028]; }), .012, tail, true);
    tube(bumperRear, [[side * .64, .329, rearZ(side * .64, .329) - .01], [side * .85, .34, rearZ(side * .85, .34) - .01]], .008, tail, true);
  }
  surface(bumperRear, (u, v) => { const x = lerp(-.83, .83, u), y = lerp(.221, .34 + .032 * Math.abs(u * 2 - 1), v); return [x, y, rearZ(x, y) - .009]; }, gloss, true, 48, 6);
  for (const x of [-.6, -.32, .32, .6]) box(bumperRear, [.009, .049, .13], [x, .227, -2.38], gunmetal, .003, true);
  box(bumperRear, [.41, .135, .015], [0, .535, -2.487], gloss, .008, true); lettering(bumperRear, 'P7+', .046, [.079, .525, -2.497], -1, ivory);
  // Widely spaced letters conform to the tailgate curvature; no floating straight wordmark.
  [...'XPENG'].forEach((char,i)=>{const x=.40-i*.20,y=.949;lettering(rear,char,.043,[x,y,rearZ(x-.018,y)-.006],-1,gunmetal);});
  for(const side of [-1,1]) tube(rear,Array.from({length:35},(_,i):V=>{const y=lerp(.653,1.045,i/34),x=side*lerp(.75,.80,i/34);return [x,y,rearZ(x,y)-.003];}),.002,gloss,true);
  box(rear,[.50,.019,.013],[0,.666,rearZ(0,.666)-.016],gloss,.007,true);
  const rearCamera=mesh(rear,new THREE.SphereGeometry(.011,20,12),lens,[0,.670,rearZ(0,.670)-.025],true);rearCamera.name='rear-camera';
  const spoiler = part('spoiler', 'P7+ 悬浮双层尾翼', [0, .70, -.48]);
  for (const side of [-1, 1]) box(spoiler, [.054, .085, .19], [side * .73, 1.075, -2.22], gloss, .021, true);
  surface(spoiler, (u, v) => { const x = (u * 2 - 1) * .90, z = lerp(-2.44, -2.18, v) + .12 * (x / .90) ** 2; return [x, 1.113 + .034 * Math.sin(v * Math.PI) - .023 * (x / .90) ** 2, z]; }, paint, true, 64, 12);
  surface(spoiler,(u,v)=>{const x=(u*2-1)*.90;return [x,1.091-.021*(x/.90)**2,lerp(-2.44,-2.18,v)+.12*(x/.90)**2];},gloss,true,64,8);
  tube(spoiler, Array.from({ length: 40 }, (_, i): V => { const x = lerp(-.90, .90, i / 39); return [x, 1.114 - .023 * (x / .9) ** 2, -2.44 + .12 * (x / .9) ** 2]; }), .014, gloss, true);

  // 20-inch five split-spoke aero wheels from the official side/detail photography.
  for (const axle of [-1, 1]) for (const side of [-1, 1]) {
    const x = side * .831, z = axle * axleZ, wheel = part(`wheel-${axle}-${side}`, `P7+ ${axle === 1 ? '前' : '后'}${side === 1 ? '左' : '右'}20英寸轮组`, [side * 1.5, 0, axle * .22]); wheel.userData.axleZ = z; wheel.userData.rollingCenter = [x, tireR, z]; wheel.userData.rollingRadius = tireR;
    const profile = [[.256, -.127], [.323, -.127], [.359, -.108], [tireR, -.079], [tireR, .079], [.359, .108], [.323, .127], [.256, .127], [.256, -.127]].map(([r, a]) => new THREE.Vector2(r, a));
    const tire = mesh(wheel, new THREE.LatheGeometry(profile, 80), rubber, [x, tireR, z]); tire.rotation.z = Math.PI / 2;
    for (const shift of [-.064, -.02, .02, .064]) { const ring = mesh(wheel, new THREE.TorusGeometry(tireR - .0025, .0015, 4, 80), lining, [x + shift, tireR, z]); ring.rotation.y = Math.PI / 2; }
    for (const r of [.330, .343]) { const ring = mesh(wheel, new THREE.TorusGeometry(r, .0018, 4, 80), gunmetal, [x + side * .126, tireR, z]); ring.rotation.y = Math.PI / 2; }
    const rotor = mesh(wheel, new THREE.CylinderGeometry(.208, .208, .016, 64), gunmetal, [x + side * .045, tireR, z]); rotor.rotation.z = Math.PI / 2;
    const rim = mesh(wheel, new THREE.CylinderGeometry(.256, .256, .205, 64, 1, true), gloss, [x, tireR, z]); rim.rotation.z = Math.PI / 2;
    const lip = mesh(wheel, new THREE.TorusGeometry(.249, .009, 8, 64), metal, [x + side * .128, tireR, z]); lip.rotation.y = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      // Broad, machined five-arm aero face, rather than thin generic Y spokes.
      const outline = [[.056,-.029],[.183,-.079],[.235,-.096],[.251,-.061],[.179,-.022],[.249,.038],[.236,.081],[.087,.033]];
      polygon(wheel,outline.map(([r,t]):V=>[x+side*.132,tireR+r*Math.cos(angle)-t*Math.sin(angle),z+r*Math.sin(angle)+t*Math.cos(angle)]),metal);
      for(let k=0;k<outline.length;k++){
        const a=outline[k],b=outline[(k+1)%outline.length];
        polygon(wheel,[[a[0],a[1],.132],[b[0],b[1],.132],[b[0],b[1],.118],[a[0],a[1],.118]].map(([r,t,depth]):V=>[x+side*depth,tireR+r*Math.cos(angle)-t*Math.sin(angle),z+r*Math.sin(angle)+t*Math.cos(angle)]),gunmetal);
      }
      const bolt = mesh(wheel, new THREE.CylinderGeometry(.009, .009, .006, 10), gloss, [x + side * .143, tireR + .047 * Math.cos(angle), z + .047 * Math.sin(angle)]); bolt.rotation.z = Math.PI / 2;
    }
    const hub = mesh(wheel, new THREE.CylinderGeometry(.062, .062, .025, 32), gunmetal, [x + side * .134, tireR, z]); hub.rotation.z = Math.PI / 2;
    tube(wheel, [[x + side * .15, tireR - .016, z - .023], [x + side * .15, tireR, z], [x + side * .15, tireR + .016, z + .023]], .003, metal);
    tube(wheel, [[x + side * .15, tireR + .016, z - .023], [x + side * .15, tireR, z], [x + side * .15, tireR - .016, z + .023]], .003, metal);
    box(wheel, [.044, .135, .065], [x + side * .058, tireR + .01, z + .18], gunmetal, .02).name = 'brake-caliper';
  }

  const floor = part('platform', 'P7+ 乘员舱地板 / 门槛纵梁', [0, .04, -1.25]);
  box(floor, [1.65, .055, 4.30], [0, .378, -.03], lining, .025);
  for (const side of [-1, 1]) box(floor, [.09, .085, 3.20], [side * .65, .31, 0], gunmetal);
  for (const [row, count, z] of [[1, 2, .48], [2, 3, -.72]]) for (let n = 0; n < count; n++) {
    const x = count === 2 ? (n ? -.465 : .465) : (1 - n) * .49, w = count === 2 ? .475 : .455;
    const seat = part(`seat-${row}-${n + 1}`, `P7+ ${row}排 ${n + 1}座`, [x * 1.8, .9 + .3 * (row - 1), -.13 * (row - 1)]); seat.userData.seatRow = row;
    box(seat, [w, .13, .48], [x, .565, z], leather, .06);
    const back = box(seat, [w, .50, .14], [x, .88, z - .236], leather, .065); back.rotation.x = -.12;
    box(seat, [w * .59, .165, .128], [x, 1.225, z - .28], leatherDark, .054);
    box(seat, [w * .70, .36, .025], [x, .885, z - .145], leatherDark, .04);
    for (const side of [-1, 1]) {
      box(seat, [.07, .10, .46], [x + side * (w / 2 - .042), .62, z], leather, .035);
      tube(seat, [[x + side * w * .37, .7, z - .12], [x + side * w * .38, .9, z - .12], [x + side * w * .35, 1.08, z - .17]], .0025, stitch);
    }
    for (let j = 0; j < 5; j++) tube(seat, [[x - w * .28, .645, z - .13 + j * .07], [x, .648, z - .13 + j * .07], [x + w * .28, .645, z - .13 + j * .07]], .0018, stitch);
    box(seat, [w * .7, .14, .34], [x, .455, z], gloss);
    for(const side of [-1,1]) {
      box(seat,[.035,.029,.43],[x+side*w*.30,.414,z],metal,.008);
      tube(seat,[[x+side*w*.20,1.12,z-.26],[x+side*w*.20,1.20,z-.28]],.008,metal);
      const bolster=box(seat,[.074,.37,.11],[x+side*w*.405,.88,z-.18],leather,.034);bolster.rotation.x=-.12;bolster.rotation.z=side*.075;
    }
    surface(seat,(u,v)=>[x+(u-.5)*w*.62,.716+v*.36,z-.155-.045*v+.018*Math.sin(u*Math.PI)],leather,false,20,24);

  }
  const cockpit = part('cockpit', 'P7+ 环抱仪表台 / 双辐方向盘 / 悬浮屏', [0, .65, 1.1]);
  box(cockpit, [1.67, .13, .28], [0, .942, 1.05], leatherDark, .06);
  box(cockpit, [1.66, .076, .20], [0, .87, 1.05], leather, .03);
  tube(cockpit, [[-.79, .933, .891], [-.4, .929, .904], [0, .929, .905], [.4, .929, .904], [.79, .933, .891]], .006, ambient);
  box(cockpit, [.366, .238, .022], [0, 1.016, .859], gloss, .013);
  box(cockpit, [.343, .211, .004], [0, 1.016, .845], display, .009);
  for (let i = 0; i < 3; i++) box(cockpit, [.052, .008, .003], [-.11 + i * .08, .953, .841], ivory, .002);
  box(cockpit, [.237, .074, .021], [.458, .981, .863], display, .008);
  const steeringPoints = Array.from({ length: 41 }, (_, i): V => { const a = i / 40 * Math.PI * 2; return [.46 + .165 * Math.cos(a), .876 + .139 * Math.sin(a), .664 - .025 * Math.sin(a)]; });
  tube(cockpit, steeringPoints, .016, leatherDark, false, true);
  box(cockpit, [.255, .046, .031], [.46, .869, .66], leather, .018); box(cockpit, [.075, .068, .037], [.46, .875, .66], leatherDark, .021);
  box(cockpit, [.325, .20, .68], [0, .635, .44], leatherDark, .06);
  const charger = box(cockpit, [.292, .018, .265], [0, .751, .61], gloss, .024); charger.rotation.x = -.13;
  for (const x of [-.076, .076]) box(cockpit, [.119, .006, .213], [x, .768, .61], rubber, .01);
  box(cockpit, [.31, .09, .26], [0, .745, .22], leather, .04);
  // Engineering topology follows the publicly specified BEV architecture. Packaging is estimated.
  const orange = material('#d66624', .52), coolant = material('#365f70', .56), copper = material('#ab7447', .33, .7);
  const battery = part('battery', 'P7+ 液冷动力电池 / 铝合金密封托盘', [0, .08, 3.25]);
  box(battery, [1.43,.095,2.35], [0,.238,-.04], gunmetal, .022);
  for (const side of [-1,1]) {
    box(battery,[.045,.105,2.37],[side*.72,.257,-.04],metal,.009);
    for (let i=0;i<10;i++) box(battery,[.075,.019,.05],[side*.735,.248,-1.07+i*.23],gunmetal,.006);
  }
  for (const z of [-1.225,1.145]) box(battery,[1.46,.105,.045],[0,.257,z],metal,.009);
  for (let i=0;i<8;i++) box(battery,[1.36,.018,.022],[0,.188,-1.08+i*.3],metal,.005);
  const coldplate = part('battery-cooling','电池冷板 / 冷却液进回路 · 走向重建',[0,.26,3.3]);
  box(coldplate,[1.34,.012,2.22],[0,.294,-.04],cellMat,.008);
  for (let i=0;i<7;i++) tube(coldplate,[[-.60,.306,-1.02+i*.30],[.59,.306,-1.02+i*.30],[.61,.306,-.89+i*.30],[-.60,.306,-.89+i*.30]],.006,coolant);
  const modules = part('battery-modules','磷酸铁锂电池分区 / 汇流排 · 非原厂模组数量',[0,.65,3.3]);
  for (let i=0;i<6;i++) for (let j=0;j<3;j++) {
    const x=(j-1)*.44,z=-.975+i*.37;
    box(modules,[.423,.040,.343],[x,.334,z],cellMat,.008);
    for (let k=0;k<7;k++) box(modules,[.414,.0015,.002],[x,.355,z-.14+k*.045],metal,.0005);
    box(modules,[.13,.008,.032],[x,.362,z+.1],copper,.003);
  }
  const batteryLid=part('battery-cover','电池上盖 / 密封边框',[0,.9,3.3]);
  box(batteryLid,[1.41,.009,2.30],[0,.373,-.04],gunmetal,.015);
  for (const side of [-1,1]) for (let i=0;i<10;i++) {
    const bolt=mesh(batteryLid,new THREE.CylinderGeometry(.006,.006,.005,8),metal,[side*.69,.38,-1.09+i*.23]); bolt.name='battery-cover-fastener';
  }
  for (const axle of [-1,1]) {
    const frame=part(`suspension-${axle}`,`P7+ ${axle===1?'前双叉臂':'后五连杆'}悬架 / 副车架`,[0,.25,axle*1.9]);
    const z=axle*axleZ;
    tube(frame,[[-.55,.33,z-.25],[-.6,.33,z+.20],[.6,.33,z+.20],[.55,.33,z-.25],[-.55,.33,z-.25]],.045,gunmetal);
    for (const side of [-1,1]) {
      // Knuckle, separate upper/lower links, damper and spring share physical end points.
      const hub:V=[side*.75,.369,z];
      tube(frame,[[side*.76,.27,z],[side*.76,.55,z]],.033,gunmetal);
      if (axle===1) {
        for (const y of [.30,.56]) tube(frame,[[side*.39,y,z-.20],[side*.75,y+.02,z],[side*.39,y,z+.20]],y<.4?.024:.018,metal);
      } else {
        const links:V[][]=[[[side*.34,.30,z-.26],[side*.75,.28,z-.08]],[[side*.34,.34,z+.24],[side*.75,.32,z+.08]],[[side*.42,.51,z-.17],[side*.75,.52,z]],[[side*.40,.52,z+.23],[side*.74,.50,z+.07]],[[side*.62,.37,z+.41],[side*.76,.40,z]]];
        links.forEach(points=>tube(frame,points,.018,metal));
      }
      tube(frame,[hub,[side*.64,.76,z-.06]],.022,metal);
      tube(frame,[[side*.71,.48,z-.02],[side*.64,.77,z-.06]],.032,gunmetal);
      const spring:V[]=Array.from({length:121},(_,i)=>{const t=i/120,a=t*Math.PI*14;return [side*(.70-.055*t)+.061*Math.cos(a),.49+t*.23,z-.025-.025*t+.061*Math.sin(a)];});
      tube(frame,spring,.0065,lining);
      for (const p of [[side*.39,.30,z-.20],[side*.39,.30,z+.20]] as V[]) mesh(frame,new THREE.SphereGeometry(.035,16,10),rubber,p);
    }
    tube(frame,[[-.69,.37,z+.14],[-.49,.39,z+.28],[.49,.39,z+.28],[.69,.37,z+.14]],.011,gunmetal);
  }
  const motor=part('motor--1','P7+ 后三合一电驱 / 减速器 / 半轴',[0,.8,-1.9]);
  const motorBody=mesh(motor,new THREE.CylinderGeometry(.132,.132,.40,64),metal,[-.12,.48,-1.5]);motorBody.rotation.z=Math.PI/2;
  for(let i=0;i<11;i++){const fin=mesh(motor,new THREE.CylinderGeometry(.139,.139,.008,48),gunmetal,[-.30+i*.035,.48,-1.5]);fin.rotation.z=Math.PI/2;}
  box(motor,[.28,.21,.24],[.20,.455,-1.5],metal,.055);
  box(motor,[.43,.076,.25],[-.02,.64,-1.5],gunmetal,.019);
  for(const side of [-1,1]) {
    tube(motor,[[side*.29,.43,-1.5],[side*.73,.369,-1.5]],.018,metal);
    for(let i=0;i<5;i++){const boot=mesh(motor,new THREE.CylinderGeometry(.038-i*.002,.038-i*.002,.009,20),rubber,[side*(.65+i*.013),.38,-1.5]);boot.rotation.z=Math.PI/2;}
  }
  const thermal=part('thermal-front','前舱热管理 / 散热器 / 电动压缩机',[0,.85,1.6]);
  box(thermal,[1.18,.27,.055],[0,.57,2.03],gunmetal,.012);
  for(let i=0;i<26;i++) box(thermal,[.008,.242,.064],[-.55+i*.044,.57,2.03],metal,.002);
  for(const x of [-.31,.31]){
    const fan=mesh(thermal,new THREE.TorusGeometry(.115,.012,8,48),gloss,[x,.58,1.978]);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const blade=box(thermal,[.12,.028,.01],[x+.057*Math.cos(a),.58+.057*Math.sin(a),1.97],gloss,.012);blade.rotation.z=a+.5;}
    fan.name='radiator-fan';
  }
  const compressor=mesh(thermal,new THREE.CylinderGeometry(.073,.073,.19,32),metal,[-.36,.54,1.62]);compressor.rotation.z=Math.PI/2;
  box(thermal,[.21,.16,.20],[.37,.66,1.64],ivory,.026);
  tube(thermal,[[-.36,.55,1.65],[-.57,.57,1.75],[-.54,.55,2.0]],.012,coolant);
  tube(thermal,[[.37,.64,1.64],[.53,.55,1.9],[.5,.53,2.03]],.014,rubber);
  const hv=part('hv-system','高压配电 / 充电控制 / 橙色高压线束',[.9,.65,.6]);
  box(hv,[.40,.09,.28],[.13,.66,1.57],gunmetal,.016);
  for(let i=0;i<9;i++)box(hv,[.36,.009,.011],[.13,.711,1.46+i*.026],metal,.002);
  tube(hv,[[.48,.33,-1.14],[.55,.40,-1.32],[.20,.61,-1.39]],.012,orange);
  tube(hv,[[-.49,.32,1.08],[-.58,.39,1.32],[-.10,.65,1.57]],.012,orange);
  tube(hv,[[.47,.33,-1.07],[.60,.44,-1.65],[.75,.71,-1.94]],.010,orange);
  // Door speaker diaphragms exactly share the acoustic layout centres.
  for(const side of [-1,1]) for(const [name,z,x] of [['front',.58,.84],['rear',-.65,.85]] as const){
    const door=group.getObjectByName(`${name}-door-${side}`) as THREE.Group;
    const speaker=mesh(door,new THREE.CylinderGeometry(.075,.060,.019,40),lining,[side*x,.72,z]);speaker.rotation.z=Math.PI/2; speaker.name='acoustic-speaker';
    const grille=mesh(door,new THREE.TorusGeometry(.077,.004,8,48),metal,[side*(x-.011),.72,z]);grille.rotation.y=Math.PI/2;
  }
  // Public pack envelope: approximately 109 mm. Do not claim the inferred cell subdivision is OEM CAD.
  for(const packPart of [battery,coldplate,modules,batteryLid]) packPart.traverse(object=>{
    if(object instanceof THREE.Mesh){object.geometry.scale(1,.56,1);object.position.y=object.position.y*.56+.12972;}
  });
  const cage=part('body-cage','P7+ 笼式车身 / A-B-C 柱 / 门槛框架',[0,1.35,0]);
  for(const side of [-1,1]){
    tube(cage,[[side*.81,.43,1.05],[side*.84,1.025,1.27],[side*.72,1.405,.60],[side*.71,1.455,-.2],[side*.72,1.385,-.9],[side*.84,1.06,-1.50],[side*.82,.43,-1.2]],.028,gunmetal);
    tube(cage,[[side*.83,.43,-.08],[side*.86,1.02,-.08],[side*.71,1.458,-.08]],.031,gunmetal);
    tube(cage,[[side*.82,.43,-1.18],[side*.85,.44,0],[side*.82,.43,1.03]],.042,gunmetal);
  }
  for(const z of [-.82,.40])tube(cage,[[-.71, p7Surface.roof(z)-.055,z],[0,p7Surface.roof(z)-.036,z],[.71,p7Surface.roof(z)-.055,z]],.023,gunmetal);
  const rearFloor=part('rear-casting','P7+ 后地板 / 轮罩加强肋 · 压铸架构重建',[0,.5,-2.3]);
  box(rearFloor,[1.34,.035,.64],[0,.47,-1.9],gunmetal,.02);
  for(const x of [-.53,-.26,0,.26,.53])box(rearFloor,[.02,.04,.59],[x,.507,-1.9],metal,.005);
  for(const side of [-1,1])tube(rearFloor,[[side*.6,.48,-2.12],[side*.64,.61,-1.76],[side*.68,.72,-1.52],[side*.64,.6,-1.23]],.034,gunmetal);
  group.updateMatrixWorld(true);
  const inspection = createAssetInspection(group, shell); let disposed = false;
  return {
    assetId: 'xpeng-p7plus', title: '小鹏 P7+', credit: 'P7+ 多视角照片曲面重建', source: 'https://www.xiaopeng.com/p7_plus_2026.html', group,
    parts: parts.map(({ id, name }) => ({ id, name })), inspection,
    partForObject(object) { for (let node: THREE.Object3D | null = object; node && node !== group; node = node.parent) if (typeof node.userData.partId === 'string') return node.userData.partId; return null; },
    selectPart(id) { inspection.select(parts.find(p => p.id === id)?.object ?? null); },
    setPartProgress(id, value) { if (!Number.isFinite(value)) throw new Error('Non-finite disassembly progress'); const row = parts.find(p => p.id === id); if (row) row.object.position.copy(row.offset).multiplyScalar(THREE.MathUtils.clamp(value, 0, 1)); },
    setPaint(color) { paint.color.set(color); for (const object of shell) { const mat = object.material as THREE.MeshPhysicalMaterial; if (mat.clearcoat === 1) mat.color.set(color); } },
    dispose() { if (disposed) return; disposed = true; inspection.dispose(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); group.removeFromParent(); group.clear(); },
  };
}
