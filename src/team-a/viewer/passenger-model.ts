import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PASSENGERS = [
  { id: 'niulai', name: '牛来', detail: '黄色小牛 · 短角与浅色口鼻', color: '#c79d32' },
  { id: 'ayaka', name: '神里绫华', detail: '蓝白织物 · 银蓝马尾', color: '#7e91bc' },
  { id: 'luffy', name: '路飞', detail: '红色背心 · 膝上草帽', color: '#b75b49' },
] as const;
export type PassengerId = typeof PASSENGERS[number]['id'];
export const isPassenger = (id: unknown): id is PassengerId => PASSENGERS.some(c => c.id === id);
type V = [number, number, number];

/** Authored, real geometry. +Z faces the windscreen; origin is the seated hip.
 * Small rigid rig, not an imported/official character or a physical human model. */
export function createPassengerModel(id: PassengerId, driver = false) {
  if (!isPassenger(id)) throw new Error('Unknown passenger');
  const group = new THREE.Group(); group.name = `passenger-${id}`;
  group.userData.passengerId = id; group.userData.visualOnly = true;
  group.userData.driver = driver; group.userData.assetStatus = 'basic';
  const body = new THREE.Group(), head = new THREE.Group(); group.add(body); body.add(head);
  head.position.set(0, .49, -.012); head.name = 'head-rig';
  const eyeRigs: THREE.Group[] = [], geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.MeshStandardMaterial>();
  const mat = (color: string, roughness = .65, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(m); return m;
  };
  const skin = mat(id === 'niulai' ? '#d5a527' : id === 'luffy' ? '#e8ae82' : '#f6dacd', .62);
  const dark = mat('#30272b'), white = mat('#fff7ed', .38), gold = mat('#c69c50', .35, .65);
  const navy = mat('#273653'), cloth = mat(id === 'ayaka' ? '#e5e8f7' : id === 'luffy' ? '#b92832' : '#d5a527');
  const hair = mat(id === 'ayaka' ? '#a9b5e0' : '#242529', .52);
  const mesh = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, p: V = [0, 0, 0]) => {
    if (!g.getAttribute('uv')) { const a = g.getAttribute('position'), uv = new Float32Array(a.count * 2); for (let i = 0; i < a.count; i++) { uv[i * 2] = a.getX(i) * 3; uv[i * 2 + 1] = a.getY(i) * 3; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    geometries.add(g); const o = new THREE.Mesh(g, m); o.position.set(...p);
    o.castShadow = o.receiveShadow = true; parent.add(o); return o;
  };
  const sphere = new THREE.SphereGeometry(1, 28, 20); geometries.add(sphere);
  const ell = (parent: THREE.Object3D, p: V, scale: V, m: THREE.Material) => {
    const o = mesh(parent, sphere, m, p); o.scale.set(...scale); return o;
  };
  // A smooth, tapered strand/limb; end rings shrink instead of producing blunt cylinders.
  function sweep(parent: THREE.Object3D, points: V[], radius: number, m: THREE.Material, end = .55, sides = 8) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const n = Math.max(12, points.length * 6), frames = curve.computeFrenetFrames(n, false);
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPointAt(t), r = radius * (.82 + .18 * Math.sin(Math.PI * t)) * (1 - t + end * t);
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2, v = p.clone().addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r);
        positions.push(v.x, v.y, v.z);
        if (i < n && j < sides) { const k = i * (sides + 1) + j; indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2); }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return mesh(parent, g, m);
  }
  const limb = (a: V, b: V, r: number, m: THREE.Material, end = .8) => {
    sweep(body, [a, [a[0] * .5 + b[0] * .5, a[1] * .5 + b[1] * .5, a[2] * .5 + b[2] * .5], b], r, m, end, 12);
    ell(body, a, [r * .8, r * .8, r * .8], m); ell(body, b, [r * end * .8, r * end * .8, r * end * .8], m);
  };
  function eye(x: number, cow = false) {
    const e = new THREE.Group(); e.position.set(x, cow ? .05 : .026, cow ? .104 : .102); head.add(e); eyeRigs.push(e);
    ell(e, [0, 0, 0], [cow ? .042 : id === 'ayaka' ? .035 : .030, cow ? .023 : id === 'ayaka' ? .024 : .034, .011], white);
    const iris = mat(id === 'ayaka' ? '#536fbe' : id === 'niulai' ? '#6b4730' : '#322a27', .28);
    ell(e, [0, -.001, .011], [id === 'luffy' ? .012 : .016, cow ? .016 : id === 'ayaka' ? .020 : .023, .004], iris);
    ell(e, [0, -.001, .015], [.007, cow ? .012 : .016, .002], dark);
    ell(e, [-.005, .008, .018], [.004, .005, .002], white);
    ell(e, [.005, -.011, .021], [.0025, .003, .002], white);
    sweep(e, [[-.033, .012, .004], [0, id === 'ayaka' ? .022 : .034, .006], [.034, .010, .004]], cow ? .004 : id === 'ayaka' ? .003 : .0018, dark, .65);
    if (cow) ell(e, [0, .024, .008], [.045, .013, .016], skin);
  }
  function hand(side: number, hoof = false) {
    const hands = new THREE.Group(); body.add(hands); if (driver) hands.position.set(0,.215,.10);
    const p: V = [side * .105, .075, .235];
    ell(hands, p, [hoof ? .03 : .025, .016, .039], hoof ? white : skin);
    if (hoof) {
      sweep(hands, [[p[0], .09, .263], [p[0], .075, .273]], .0018, dark, .9); return;
    }
    for (let i = 0; i < 4; i++) {
      const x = p[0] + (i - 1.5) * .011;
      sweep(hands, [[x, .079, .252], [x, .072, .272], [x, .061, .279 - Math.abs(i - 1.3) * .006]], .0054, skin, .66);
    }
    sweep(hands, [[p[0] - side * .022, .080, .231], [p[0] - side * .031, .075, .25], [p[0] - side * .024, .068, .263]], .007, skin, .75);
  }
  const torso = ell(body, [0, .215, -.005], [id === 'niulai' ? .153 : .133, .181, .084], id === 'ayaka' ? navy : skin);
  torso.name = 'seated-torso';
  ell(body, [0, .032, .016], [.133, .066, .11], id === 'luffy' ? mat('#32658e') : id === 'ayaka' ? navy : skin);
  limb([0, .355, -.01], [0, .405, -.01], .042, skin);
  for (const side of [-1, 1]) {
    const leg = id === 'ayaka' ? mat('#f2f0e7', .8) : skin;
    const thigh = id === 'luffy' ? mat('#477a9b') : id === 'ayaka' ? leg : skin;
    limb([side * .075, .018, .035], [side * .101, -.015, .25], id === 'niulai' ? .064 : .054, thigh, .82);
    limb([side * .101, -.023, .25], [side * .102, -.192, .285], id === 'niulai' ? .041 : .031, leg, .7);
    ell(body, [side * .102, -.205, .317], [id === 'niulai' ? .045 : .035, .023, .075], id === 'ayaka' ? navy : id === 'niulai' ? white : skin);
    if (id === 'luffy') {
      ell(body, [side * .102, -.222, .317], [.04, .008, .08], mat('#816345'));
      sweep(body, [[side * .075, -.188, .296], [side * .102, -.176, .325], [side * .129, -.188, .296]], .008, dark, .9);
      for (let i = 0; i < 5; i++) ell(body, [side * .102 + (i - 2) * .012, -.2, .378 - Math.abs(i - 1.5) * .004], [.006, .009, .013], skin);
      const cuff = mesh(body, new THREE.TorusGeometry(.045, .009, 6, 24), white, [side * .101, -.006, .235]); cuff.scale.y = .8;
    }
    if (id === 'niulai') sweep(body, [[side * .102, -.182, .375], [side * .102, -.22, .384]], .002, dark, .9);
    if (id === 'ayaka') {
      sweep(body, [[side * .073, -.175, .298], [side * .102, -.167, .318], [side * .132, -.176, .299]], .007, navy);
      ell(body, [side * .102, -.174, .322], [.012, .007, .01], gold);
    }
    const shoulder: V = [side * .13, .33, .0], elbow: V = [side * .175, driver ? .19 : .155, driver ? .16 : .085], wrist: V = [side * .115, driver ? .298 : .083, driver ? .313 : .213];
    limb(shoulder, elbow, id === 'ayaka' ? .051 : .038, id === 'ayaka' ? cloth : skin, id === 'ayaka' ? 1.2 : .84);
    limb(elbow, wrist, id === 'ayaka' ? .035 : .031, id === 'ayaka' ? cloth : skin, .72);
    if (id === 'ayaka') {
      sweep(body, [[side * .192, .14, .081], [side * .177, .125, .115], [side * .141, .085, .202]], .006, gold, .7);
      ell(body, [side * .126, .097, .193], [.036, .025, .025], navy);
    }
    hand(side, id === 'niulai');
  }
  if (id === 'niulai') {
    ell(head, [0, 0, 0], [.149, .165, .12], skin);
    const muzzle = mat('#dbc1b4', .78), horn = mat('#777567', .89);
    ell(head, [0, -.064, .117], [.113, .076, .076], muzzle);
    ell(head, [0, -.09, .159], [.091, .031, .034], muzzle);
    for (const side of [-1, 1]) {
      eye(side * .07, true);
      const ear = ell(head, [side * .153, .059, -.005], [.073, .032, .023], skin); ear.rotation.z = side * .35;
      const inner = ell(head, [side * .168, .059, .015], [.042, .015, .01], mat('#b97e37')); inner.rotation.z = side * .35;
      sweep(head, [[side * .098, .12, -.018], [side * .15, .171, -.026], [side * .158, .222, .002], [side * .143, .255, .023]], .027, horn, .06, 12);
      sweep(head, [[side * .029, .105, .117], [side * .069, .119, .113], [side * .114, .103, .087]], .006, dark, .7);
      ell(head, [side * .035, -.049, .184], [.02, .009, .006], mat('#87756f'));
      sweep(head, [[side * .022, -.056, .19], [side * .045, -.06, .184]], .002, dark);
    }
    sweep(head, [[-.075, -.092, .174], [0, -.105, .19], [.075, -.092, .174]], .0026, mat('#97716b'), .8);
    ell(body, [0, .195, .077], [.10, .133, .018], mat('#e3bb50'));
    // Fine, deterministic short-fur grain; no external texture dependency.
    const pixels = new Uint8Array(128 * 128 * 4); let seed = 17;
    for (let i = 0; i < 128 * 128; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const v = 100 + (seed >>> 25); pixels.set([v, v, v, 255], i * 4); }
    const fur = new THREE.DataTexture(pixels, 128, 128); fur.wrapS = fur.wrapT = THREE.RepeatWrapping; fur.repeat.set(5, 5); fur.generateMipmaps = true; fur.minFilter = THREE.LinearMipmapLinearFilter; fur.magFilter = THREE.LinearFilter; fur.needsUpdate = true;
    skin.bumpMap = fur; skin.bumpScale = .0008;
  } else {
    // Sculpt the cheek/chin profile instead of using a faceless capsule.
    const faceGeometry = new THREE.SphereGeometry(1, 40, 32), p = faceGeometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), chin = y < -.15 ? 1 + (y + .15) * .29 : 1; p.setXYZ(i, p.getX(i) * .112 * chin, y * .14, p.getZ(i) * .103 + Math.max(0, -y) * .006); }
    faceGeometry.computeVertexNormals(); mesh(head, faceGeometry, skin);
    for (const side of [-1, 1]) {
      ell(head, [side * .11, -.012, -.004], [.017, .03, .012], skin); eye(side * .045);
      sweep(head, [[side * .020, .082, .089], [side * .048, .088, .088], [side * .076, .073, .075]], .0023, hair, .7);
    }
    ell(head, [0, -.021, .104], [.009, .018, .011], skin);
    const cap = mesh(head, new THREE.SphereGeometry(1, 36, 24, 0, Math.PI * 2, 0, Math.PI * .53), hair, [0, .027, -.012]); cap.scale.set(.122, .14, .12);
    if (id === 'luffy') {
      ell(head, [0, -.059, .099], [.054, .018, .016], dark);
      ell(head, [0, -.054, .112], [.049, .013, .004], white);
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
        sweep(head, [[x * .085, .10, z * .073], [x * .12, .134 + .008 * Math.sin(i * 3), z * .102], [x * .144, .085 + .03 * Math.sin(i * 2), z * .13]], .028, hair, .05);
      }
      for (let i = 0; i < 7; i++) { const x = (i - 3) * .033; sweep(head, [[x, .106, .075], [x - .008, .07, .107], [x + .014, .045 - .009 * Math.cos(i), .11]], .024, hair, .04); }
      sweep(head, [[.039, -.008, .11], [.084, -.016, .083]], .0018, dark);
      for (const x of [.051, .07]) sweep(head, [[x, -.004, .104], [x + .003, -.021, .104]], .0018, dark);
      for (const side of [-1, 1]) {
        const vest = ell(body, [side * .101, .232, .039], [.049, .171, .064], cloth); vest.rotation.z = side * -.1;
        sweep(body, [[side * .079, .372, .07], [side * .048, .22, .089], [side * .064, .065, .085]], .004, mat('#d95148'));
        for (const y of [.14, .22, .30]) ell(body, [side * .071, y, .102], [.007, .007, .003], gold);
      }
      ell(body, [0, .058, .022], [.139, .034, .10], gold);
      sweep(body, [[.13, .07, .035], [.16, .0, .05], [.145, -.07, .09]], .018, gold, .7);
      const straw = mat('#cba260', .9), hat = new THREE.Group(); hat.name = 'lap-straw-hat'; body.add(hat); hat.position.set(0, .103, .253); hat.rotation.x = .15;
      if (driver) { hat.position.set(0,.30,-.12); hat.rotation.x=Math.PI/2; }
      ell(hat, [0, 0, 0], [.165, .009, .135], straw); ell(hat, [0, .035, -.002], [.1, .046, .089], straw);
      const ribbon = mesh(hat, new THREE.CylinderGeometry(.097, .104, .019, 40, 1, true), cloth, [0, .026, -.002]); ribbon.scale.z = .9;
      for (let i = 0; i < 6; i++) { const ring = mesh(hat, new THREE.TorusGeometry(.108 + i * .01, .0012, 4, 40), gold); ring.rotation.x = Math.PI / 2; ring.scale.y = .82; ring.position.y = .007; }
    } else {
      const blush = mat('#db9c9a', .8); for (const side of [-1, 1]) ell(head, [side * .073, -.024, .078], [.023, .008, .005], blush);
      sweep(head, [[-.021, -.061, .099], [0, -.066, .104], [.021, -.059, .099]], .0017, blush);
      for (let i = 0; i < 9; i++) { const x = (i - 4) * .024; sweep(head, [[x * .8, .133, .047], [x, .11, .092], [x * 1.05, .076 + .004 * Math.cos(i), .10]], .022, hair, .22, 10); }
      for (const side of [-1, 1]) {
        sweep(head, [[side * .11, .10, .01], [side * .119, -.045, .038], [side * .11, -.17, .05]], .024, hair, .35, 10);
        for (let i = 0; i < 3; i++) sweep(head, [[side * (.084 + i * .009), .09, -.06], [side * (.10 + i * .012), -.07, -.092], [side * (.1 + i * .01), -.15, -.065]], .021, hair, .3);
      }
      sweep(head, [[0, .135, -.065], [.014, .095, -.13], [.036, -.105, -.136], [.065, -.24, -.10]], .047, hair, .26, 12);
      for (const side of [-1, 1]) { const bow = ell(head, [side * .038, .157, -.04], [.044, .025, .015], navy); bow.rotation.z = side * .4; }
      ell(head, [0, .158, -.024], [.018, .019, .01], gold);
      const pink = mat('#d6a5c3');
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ell(head, [-.109 + .015 * Math.cos(a), .026 + .015 * Math.sin(a), .055], [.009, .009, .004], pink); }
      ell(head, [-.109, .026, .061], [.006, .006, .003], gold);
      // Wrapped collar, gold edge, obi and a pleated skirt draped across the thighs.
      for (const side of [-1, 1]) {
        sweep(body, [[side * .06, .365, .043], [0, .28, .095], [-side * .085, .21, .076]], .017, cloth, .55, 8);
        sweep(body, [[side * .064, .372, .055], [side * .007, .29, .108], [-side * .08, .217, .085]], .003, gold);
      }
      ell(body, [0, .123, .0], [.141, .043, .093], mat('#7d8cba'));
      const positions: number[] = [], indices: number[] = [], nu = 28, nv = 18;
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = i / nu, v = j / nv * 2 - 1; positions.push(v * (.135 + u * .048), .058 - .055 * u + .01 * Math.cos(v * Math.PI * 9) * u, -.05 + .37 * u); if (i < nu && j < nv) { const k = i * (nv + 1) + j; indices.push(k, k + 1, k + nv + 1, k + 1, k + nv + 2, k + nv + 1); } }
      const skirt = new THREE.BufferGeometry(); skirt.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); skirt.setIndex(indices); skirt.computeVertexNormals(); cloth.side = THREE.DoubleSide; mesh(body, skirt, cloth);
      sweep(body, Array.from({ length: 25 }, (_, i): V => { const v = i / 24 * 2 - 1; return [v * .183, .003 + .01 * Math.cos(v * Math.PI * 9), .322]; }), .005, navy);
      for (const side of [-1, 1]) {
        sweep(body, [[side * .12, .065, -.01], [side * .15, .048, .14], [side * .178, .014, .32]], .003, gold);
        for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ell(body, [side * .122 + .013 * Math.cos(a), .037, .25 + .013 * Math.sin(a)], [.008, .003, .008], gold); }
      }
      ell(body, [0, .126, .097], [.02, .019, .006], gold);
    }
  }
  // Seat belt is a shallow ribbon across the torso, never a painted-on image.
  const belt = mat('#4b4a49', .94);
  sweep(body, [[-.12, .35, .08], [-.065, .26, .098], [.02, .155, .107], [.105, .037, .09]], .012, belt, 1, 4);
  sweep(body, [[-.132, .047, .066], [0, .057, .12], [.133, .044, .063]], .01, belt, 1, 4);
  ell(body, [.11, .043, .103], [.014, .016, .007], dark);

  // Batch only direct static children of each rig node. Eyes/head stay independently animated.
  const nodes: THREE.Object3D[] = []; group.traverse(o => { if (o instanceof THREE.Group) nodes.push(o); });
  for (const node of nodes) {
    const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of node.children) if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
      const list = byMaterial.get(child.material) ?? []; list.push(child); byMaterial.set(child.material, list);
    }
    for (const [m, list] of byMaterial) {
      if (list.length < 2) continue;
      const copies = list.map(o => { o.updateMatrix(); return o.geometry.clone().applyMatrix4(o.matrix); });
      const merged = mergeGeometries(copies); copies.forEach(g => g.dispose());
      if (merged) { list.forEach(o => o.removeFromParent()); mesh(node, merged, m).name = 'batched-character-detail'; }
    }
  }
  // Dispose source geometries no longer used after batching.
  const used = new Set<THREE.BufferGeometry>(); group.traverse(o => { if (o instanceof THREE.Mesh) used.add(o.geometry); });
  for (const g of geometries) if (!used.has(g)) { g.dispose(); geometries.delete(g); }
  let disposed = false, lastSection = '';
  const clipping = new THREE.Plane();
  return {
    group,
    animate(time: number, reduced: boolean) {
      if (disposed || !Number.isFinite(time)) return;
      const t = reduced ? 0 : time;
      body.position.y = Math.sin(t * 1.45) * .0014;
      head.rotation.y = Math.sin(t * .42) * .018;
      const phase = (t + (id === 'niulai' ? 1.4 : id === 'luffy' ? .7 : 0)) % 5.3;
      const blink = !reduced && phase > 4.9 ? Math.max(.08, 1 - Math.sin((phase - 4.9) / .4 * Math.PI) ** 2) : 1;
      eyeRigs.forEach(e => e.scale.y = blink);
    },
    setSection(axis: 'none' | 'x' | 'y' | 'z', coordinate: number) {
      const key = `${axis}/${coordinate}`; if (key === lastSection) return; lastSection = key;
      clipping.normal.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0); clipping.constant = -coordinate;
      for (const m of materials) { m.clippingPlanes = axis === 'none' ? null : [clipping]; m.clipShadows = true; m.needsUpdate = true; }
    },
    dispose() {
      if (disposed) return; disposed = true; group.removeFromParent(); group.clear();
      geometries.forEach(g => g.dispose()); materials.forEach(m => { m.bumpMap?.dispose(); m.dispose(); });
    },
  };
}
