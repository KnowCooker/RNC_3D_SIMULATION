import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Lightweight authored fallback silhouettes; detailed local assets replace these asynchronously.
 * Rigid head/eye animation only. These meshes are not a deformable facial rig. */
export function createCrewPassenger(id: 'chopper' | 'nami' | 'zoro' | 'robin', driver: boolean) {
  const group = new THREE.Group(); group.name = `passenger-${id}`;
  group.userData = { passengerId: id, visualOnly: true, driver, assetStatus: 'basic' };
  const body = new THREE.Group(), head = new THREE.Group(), clothing = new THREE.Group();
  body.name = 'body-rig'; head.name = 'head-rig'; clothing.name = 'separate-clothing';
  group.add(body); body.add(head, clothing); head.position.y = id === 'chopper' ? .37 : .49;
  type V = [number, number, number];
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.MeshStandardMaterial>();
  const mat = (color: string, roughness = .7) => { const m = new THREE.MeshStandardMaterial({ color, roughness }); materials.add(m); return m; };
  const female = id === 'nami' || id === 'robin';
  const skin = mat(id === 'chopper' ? '#cd9c58' : female ? '#f1cdb6' : '#d9ae89');
  const hair = mat(id === 'robin' ? '#242d3b' : id === 'nami' ? '#d87d26' : '#678e48'), dark = mat('#383632'), white = mat('#f8f3e8');
  const blue = mat('#4c83ab'), green = mat('#448a70'), pink = mat('#cb7397'), gold = mat('#bf9341', .4);
  const sphere = new THREE.SphereGeometry(1, 24, 18); geometries.add(sphere);
  function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, p: V = [0,0,0]) {
    geometries.add(geo); const m = new THREE.Mesh(geo, material); m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  function ell(parent: THREE.Object3D, p: V, scale: V, material: THREE.Material) { const m = mesh(parent, sphere, material, p); m.scale.set(...scale); return m; }
  function strand(parent: THREE.Object3D, points: V[], radius: number, material: THREE.Material) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(8, points.length * 3), radius, 6, false), material);
  }
  const deer = id === 'chopper';
  ell(body, [0,.2,0], [deer ? .12 : .126,deer ? .115 : .175,.075], skin);
  ell(body, [0,.03,.02], [.12,.065,.10], id === 'zoro' ? dark : blue);
  if (id === 'nami') {
    ell(clothing, [0,.25,.016], [.13,.085,.075], green);
    strand(clothing, [[-.08,.34,.05],[-.08,.30,.07],[-.11,.24,.068]], .009, green);
    strand(clothing, [[.08,.34,.05],[.08,.30,.07],[.11,.24,.068]], .009, green);
  }
  if (id === 'zoro') {
    ell(clothing, [0,.21,0], [.133,.17,.08], white);
    ell(clothing, [0,.073,.013], [.13,.041,.095], green);
    for (const y of [.05,.067,.084]) strand(clothing, [[-.115,y,.06],[0,y,.107],[.115,y,.06]], .0015, dark);
  }
  if (id === 'robin') {
    for (const s of [-1,1]) ell(clothing,[s*.08,.24,0],[.058,.13,.08],blue);
    ell(clothing,[0,.025,.105],[.145,.048,.18],pink);
    for (const s of [-1,1]) strand(clothing,[[s*.075,.05,.20],[s*.08,-.09,.255],[s*.08,-.15,.28]],.053,pink);
  }
  for (const s of [-1,1]) {
    const y = deer ? .23 : .33, elbow: V = [s * .166,driver ? .19 : .135,.13], wrist: V = [s * .12,driver ? .28 : .07,driver ? .30 : .24];
    strand(body, [[s*.115,y,0],elbow,wrist], deer ? .028 : .031, skin);
    ell(body, wrist, [.026,.018,.035], deer ? dark : skin);
    strand(body, [[s*.075,.018,.03],[s*.09,-.025,.235]], .052, id === 'zoro' ? dark : blue);
    strand(body, [[s*.09,-.025,.235],[s*.09,-.18,.27]], .03, id === 'nami' ? blue : deer ? skin : dark);
    ell(body, [s*.09,-.202,.31], [.039,.022,.073], deer || id === 'zoro' ? dark : gold);
  }
  ell(head, [0,0,0], [deer ? .142 : .106,deer ? .118 : .139,deer ? .10 : .093], skin);
  const eyes: THREE.Group[] = [];
  for (const s of [-1,1]) {
    const eye = new THREE.Group(); head.add(eye); eye.position.set(s*(deer ? .064 : .042),.025,.084); eyes.push(eye);
    ell(eye, [0,0,0], [.026,id === 'zoro' ? .011 : .023,.01], white);
    ell(eye, [0,0,.01], [.011,id === 'zoro' ? .009 : .018,.005], dark);
    ell(eye, [-.004,.007,.015], [.003,.004,.002], white);
    strand(head, [[s*.018,.065,.087],[s*.041,.074,.087],[s*.07,.065,.068]], .0025, dark);
  }
  if (deer) {
    ell(head, [0,-.038,.09], [.09,.05,.033], mat('#e5bb80'));
    ell(head, [0,-.018,.12], [.021,.013,.014], blue);
    strand(head, [[-.025,-.06,.117],[0,-.071,.124],[.025,-.06,.117]], .002, dark);
    const hat = new THREE.Group(); hat.name = 'chopper-hat-and-antlers'; head.add(hat);
    ell(hat, [0,.095,0], [.158,.029,.13], pink);
    ell(hat, [0,.162,-.008], [.146,.096,.122], blue);
    strand(hat, [[-.028,.17,.112],[.028,.115,.126]], .009, white);
    strand(hat, [[.028,.17,.112],[-.028,.115,.126]], .009, white);
    const horn = mat('#886145');
    for (const s of [-1,1]) {
      strand(hat, [[s*.125,.095,-.025],[s*.19,.155,-.02],[s*.205,.245,-.018]], .012, horn);
      strand(hat, [[s*.19,.173,-.02],[s*.222,.193,-.006]], .01, horn);
      ell(head,[s*.143,.028,-.015],[.04,.022,.02],skin);
    }
  } else {
    ell(head,[0,-.018,.091],[.008,.016,.009],skin);
    strand(head,[[-.022,-.062,.084],[0,-.066,.094],[.022,-.060,.084]],.002,mat('#a96758'));
    const cap = mesh(head,new THREE.SphereGeometry(1,28,20,0,Math.PI*2,0,Math.PI*.55),hair,[0,.024,-.008]);cap.scale.set(.115,.143,.102);
    if (female) {
      for (let i=0;i<11;i++) {const a=i/10*Math.PI;strand(head,[[Math.cos(a)*.10,.08,-.01-Math.sin(a)*.06],[Math.cos(a)*.125,-.075,-.03-Math.sin(a)*.07],[Math.cos(a)*.115,-.23,-.02-Math.sin(a)*.07]],.018,hair);}
      for (let i=0;i<5;i++) strand(head,[[.065-i*.022,.13,.04],[-.008-i*.021,.078,.086],[-.035-i*.015,.008,.083]],.014,hair);
      if(id === 'nami'){const tattoo=mat('#465995');strand(body,[[.14,.31,.026],[.155,.275,.036],[.137,.257,.035]],.003,tattoo);}
      else for(const s of [-1,1]){const lens=ell(head,[s*.05,.133,.076],[.04,.018,.008],gold);lens.rotation.z=s*-.2;}
    } else {
      for (let i=0;i<14;i++) {const a=i/14*Math.PI*2; const geo=new THREE.ConeGeometry(.024,.07,5);const o=mesh(head,geo,hair,[Math.cos(a)*.078,.145,Math.sin(a)*.06]);o.rotation.z=-Math.cos(a)*.3;}
      for (let i=0;i<3;i++) {const ring=mesh(head,new THREE.TorusGeometry(.009,.0025,5,12),gold,[.111+i*.006,-.035-i*.006,.008]);ring.rotation.y=.4;}
    }
  }
  const belt=mat('#514c46'); strand(clothing,[[-.10,.32,.066],[0,.17,.09],[.11,.04,.08]],.011,belt);
  strand(clothing,[[-.12,.04,.07],[0,.052,.12],[.12,.04,.07]],.008,belt);
  // Consolidate static pieces per parent/material while preserving the rigid eye/head hierarchy.
  const nodes: THREE.Object3D[]=[];group.traverse(o=>{if(o instanceof THREE.Group)nodes.push(o);});
  for(const node of nodes) {
    const buckets=new Map<THREE.Material,THREE.Mesh[]>();
    for(const o of node.children)if(o instanceof THREE.Mesh&&!Array.isArray(o.material)){const a=buckets.get(o.material)??[];a.push(o);buckets.set(o.material,a);}
    for(const [material,parts] of buckets)if(parts.length>1){const copies=parts.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);});const merged=mergeGeometries(copies);copies.forEach(g=>g.dispose());if(merged){parts.forEach(o=>o.removeFromParent());mesh(node,merged,material);}}
  }
  const used=new Set<THREE.BufferGeometry>();group.traverse(o=>{if(o instanceof THREE.Mesh)used.add(o.geometry);});
  for(const g of geometries)if(!used.has(g)){g.dispose();geometries.delete(g);}
  const clip=new THREE.Plane();let disposed=false,section='';
  return {group,animate(time:number,reduced:boolean){if(disposed||!Number.isFinite(time))return;const t=reduced?0:time;body.position.y=Math.sin(t*1.35)*.001;head.rotation.y=Math.sin(t*.4)*.014;const phase=t%5.3;eyes.forEach(e=>e.scale.y=!reduced&&phase>4.9?Math.max(.08,1-Math.sin((phase-4.9)/.4*Math.PI)**2):1);},
    setSection(axis:'none'|'x'|'y'|'z',coordinate:number){const next=`${axis}/${coordinate}`;if(next===section)return;section=next;clip.normal.set(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0);clip.constant=-coordinate;materials.forEach(m=>{m.clippingPlanes=axis==='none'?null:[clip];m.clipShadows=true;m.needsUpdate=true;});},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
