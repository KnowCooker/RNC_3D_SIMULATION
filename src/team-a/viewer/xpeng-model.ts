import { coachworkSurface, roundedTrim } from './coachwork-surface';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createAssetInspection } from './asset-inspection';
import type { ShowroomModel } from './showroom-model';
import { getXPengSpec, type XPengId } from './xpeng-catalog';
import { createP7PlusModel } from './p7plus-model';
import { xpengProfiles, sampleXPeng } from './xpeng-profiles';

type V = [number, number, number];
const mix = THREE.MathUtils.lerp;

/** Semantic, independently movable original geometry, reconstructed from public photography.
 * Exterior surfaces approximate silhouette; all hidden mechanical assemblies are schematic.
 * +Z front, +Y up. Every exploded transform is evaluated from its immutable origin. */
export function createXPengModel(id: XPengId): ShowroomModel {
  return id === 'p7plus' ? createP7PlusModel() : createDetailedXPengModel(id);
}
function createDetailedXPengModel(id: Exclude<XPengId,'p7plus'>): ShowroomModel {
  const profile = xpengProfiles[id], spec = getXPengSpec(id);
  const s = { ...spec, roofFront:profile.roofFront, roofRear:profile.roofRear, screenFront:profile.screenFront, screenRear:profile.screenRear, roofWidth: profile.roofHalf, belt: sampleXPeng(profile.shoulder,0) };
  const group = new THREE.Group(); group.name = `xpeng-${id}`; group.userData.revision = `${id}-photo-v4`;
  const shell: THREE.Mesh[] = [], geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const parts: { id: string; name: string; object: THREE.Group; offset: THREE.Vector3 }[] = [];
  function mat(color: string, roughness = .4, metalness = 0) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, side: THREE.DoubleSide }); materials.add(m); return m;
  }
  const paint = mat(s.color, .28, .40); paint.clearcoat = 1; paint.clearcoatRoughness = .21;
  const black = mat('#11161b', .28, .12), glass = mat('#0b1620', .13, .02);
  glass.name='xpeng-window-glass'; glass.transparent = true; glass.opacity = .95; glass.envMapIntensity = .38; glass.roughness=.18; glass.depthWrite = false;
  const rubber = mat('#17191b', .92), alloy = mat('#a7afb3', .23, .9), darkAlloy = mat('#414a50', .52, .7);
  const leather = mat(id === 'gx' || id === 'x9' ? '#b8946f' : '#c8beb1', .83);
  const seam = mat('#827361', .85), screen = mat('#142c35', .22, .2), batteryMat = mat('#486574', .63, .5);
  black.envMapIntensity=.45;
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
    return mesh(parent, new RoundedBoxGeometry(...size, 5, Math.min(radius, ...size.map(n => n / 2))), material, pos, exterior);
  }
  function tube(parent: THREE.Group, points: V[], radius: number, material: THREE.Material, exterior = false) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(8, points.length * 5), radius, 8, false), material, [0, 0, 0], exterior);
  }
  function surface(parent: THREE.Group, fn: (u: number, v: number) => V, material: THREE.Material, exterior = false, nu = 64, nv = 18) {
    return mesh(parent, coachworkSurface(fn, nu, nv), material, [0, 0, 0], exterior);
  }
  const front = s.length / 2, rear = -front, wheelZ = s.wheelbase / 2, tireR = profile.tire;
  const half = s.width / 2;
  const width = (z:number) => sampleXPeng(profile.width,z);
  const belt = (z:number) => sampleXPeng(profile.shoulder,z);
  // Cross-section is a function of world height. Wheel cutouts must not reshape the door skin.
  const sideX=(z:number,y:number)=>{const t=THREE.MathUtils.clamp((y-.23)/(belt(z)-.23),0,1);return width(z)+sampleXPeng(id==='x9'?[[0,-.058],[.13,-.012],[.36,-.040],[.65,-.006],[.84,0],[1,-.026]]:id==='gx'?[[0,-.045],[.13,-.008],[.38,-.046],[.66,-.012],[.84,0],[1,-.032]]:id==='l03'?[[0,-.062],[.15,-.015],[.38,-.050],[.70,-.006],[.86,0],[1,-.036]]:[[0,-.062],[.13,-.020],[.38,-.035],[.69,0],[.84,-.003],[1,-.032]],t);};
  const windowRear=({x9:-2.20,l03:-1.69,m03:-1.74,gx:-2.11})[id];
  const low = (z:number) => { let y=.23; for(const axle of [-wheelZ,wheelZ]){const d=z-axle,r=tireR+.043;if(Math.abs(d)<r)y=Math.max(y,tireR+Math.sqrt(r*r-d*d));}return y; };
  const roofY = (z:number) => sampleXPeng(profile.roof,z)-.023;
  const topT = (z:number) => THREE.MathUtils.clamp((roofY(z)-belt(z))/(s.height-.025-belt(z)),0,1);
  const cabinX = (z:number,t:number) => mix(sideX(z,belt(z)),s.roofWidth,t);
  const cabinTop = (z:number) => roofY(z);
  const endStation=front-.26;
  const faceWidth=(end:number,y:number)=>sideX(end*endStation,y);
  const endZ=(end:number,x:number,y:number)=>{const t=Math.min(1,Math.abs(x)/faceWidth(end,y));return end*(endStation+.267*Math.sqrt(Math.max(0,1-t**4))-.036*((y-(id==='x9'||id==='gx'?.68:.53))/.55)**2*(1-t*t)-.065*Math.pow(Math.max(0,(.43-y)/.20),2)*(1-t)**2-(end===1&&(id==='x9'||id==='gx')?.020*THREE.MathUtils.smoothstep(Math.abs(x),.50,.61)*(1-THREE.MathUtils.smoothstep(Math.abs(x),.85,.92))*THREE.MathUtils.smoothstep(y,id==='gx'?.47:sampleXPeng(profile.hood,front)-.26,id==='gx'?.52:sampleXPeng(profile.hood,front)-.20)*(1-THREE.MathUtils.smoothstep(y,id==='gx'?.64:sampleXPeng(profile.hood,front)-.12,id==='gx'?.69:sampleXPeng(profile.hood,front)-.075)):0));};
  const faceTop=(end:number,t:number)=>end===1?sampleXPeng(profile.hood,front)+(belt(endStation)-sampleXPeng(profile.hood,front))*Math.abs(t)**2:belt(-endStation)+.025;
  const bonnet = part('hood', '前舱盖 · 独立曲面重建', [0, .95, .65]);
  const hoodEdge = (z: number) => sampleXPeng(profile.hood,z);
  const hoodPoint=(u:number,v:number):V=>{const t=v*2-1,ty=faceTop(1,t),tx=t*faceWidth(1,ty),z=mix(s.screenFront,endZ(1,tx,ty),u),x=mix(t*width(s.screenFront),tx,u),y=hoodEdge(z)+u**4*(ty-hoodEdge(endZ(1,tx,ty)));return [x,y+.034*(1-t*t)*(1-u)+.015*Math.sin(u*Math.PI)**2*Math.exp(-Math.pow((Math.abs(t)-.73)/.11,2)),z];};
  surface(bonnet,hoodPoint,paint,true,80,32);
  for(const side of [-1,1])tube(bonnet,Array.from({length:48},(_,i)=>hoodPoint(i/47,(side+1)/2)),.0025,black,true);
  const hatch = part('tailgate', '掀背尾门 / 后风挡 / 尾灯', [0, .45, -1.1]);
  surface(hatch,(u,v)=>{const t=v*2-1,backY=faceTop(-1,t),backX=t*faceWidth(-1,backY),backZ=endZ(-1,backX,backY);return [mix(backX,t*cabinX(s.screenRear,topT(s.screenRear)),u),mix(backY,roofY(s.screenRear)+.023*(1-t*t),u)+.009*Math.sin(u*Math.PI),mix(backZ,s.screenRear,u)];},paint,true,64,32);
  const roof = part('roof', '全景天幕 / 前风挡 / 顶梁', [0, 1.6, 0]);
  surface(roof, (u, v) => { const z = mix(s.roofRear, s.roofFront, u), x = mix(-s.roofWidth, s.roofWidth, v); return [x, roofY(z) + .023 * Math.sin(v * Math.PI), z]; }, black, true);
  surface(roof, (u, v) => { const z = mix(s.roofRear + .1, s.roofFront - .1, u), x = mix(-s.roofWidth + .09, s.roofWidth - .09, v); return [x, roofY(z) + .023 * Math.sin((x / s.roofWidth + 1) * Math.PI / 2) + .006, z]; }, glass, true);
  for (const [baseZ, topZ] of [[s.screenFront,s.roofFront],[s.screenRear,s.roofRear]]) {
    surface(baseZ<0?hatch:roof,(u,v)=>{const z=mix(baseZ,topZ,u),x=(v*2-1)*cabinX(z,topT(z));return [x,roofY(z)+.023*(1-(v*2-1)**2),z];},glass,true,64,32);
  }
  const doorSplit = profile.split;
  for (const side of [-1, 1]) {
    const label = side === 1 ? '左' : '右';
    const panels: [string, string, number, number][] = [
      ['quarter', '后翼子板', -endStation, profile.rearDoor],
      ['rear-door', id === 'x9' ? '后滑门' : '后车门', profile.rearDoor, doorSplit],
      ['front-door', '前车门', doorSplit, s.screenFront - .22],
      ['fender', '前翼子板', s.screenFront - .22, endStation],
    ];
    for (const [key, name, za, zb] of panels) {
      const panel = part(`${key}-${side}`, `${label}${name}`, [side * (key.includes('door') ? 1.3 : .8), .14, key === 'quarter' ? -.35 : key === 'fender' ? .35 : 0]);
      surface(panel, (u, v) => { const z = mix(za + .0025, zb - .0025, u), y = mix(low(z), belt(z), v); return [side * sideX(z,y), y, z]; }, paint, true, 128, 32);
      surface(panel, (u, v) => { const z = mix(za + .0025, zb - .0025, u); const top = z >= s.screenFront ? hoodEdge(z) : z <= s.screenRear ? belt(z) + .035 : belt(z) + .016; return [side * sideX(z,mix(belt(z),top,v)), mix(belt(z), top, v), z]; }, paint, true, 32, 2);
      surface(panel,(u,v)=>{const z=mix(za+.003,zb-.003,u),y=low(z),x=sideX(z,y);return [side*(x-v*.06),y-.012*v,z];},paint,true,72,4);
      for(const axle of [-wheelZ,wheelZ]){const radius=tireR+.043,a=Math.max(za+.005,axle-radius+.002),b=Math.min(zb-.005,axle+radius-.002);if(b>a)surface(panel,(u,v)=>{const z=mix(a,b,u),y=tireR+Math.sqrt(Math.max(0,radius*radius-(z-axle)**2));return [side*(sideX(z,y)-v*.014),y-v*.008,z];},paint,true,64,4);}

      // Sill/shoulder creases follow each physical panel; seams remain visible between assemblies.
      tube(panel, Array.from({ length: 20 }, (_, i): V => { const z = mix(za + .014, zb - .014, i / 19); return [side * (sideX(z,belt(z)-.085) + .001), belt(z) - .085, z]; }), .003, paint, true);
      if (zb > s.screenRear && za < s.screenFront) {
        const a = Math.max(za + .004, windowRear), b = Math.min(zb - .015, s.screenFront - .025);
        if (b > a) {
          surface(panel, (u, v) => { const z = mix(a, b, u); const top = cabinTop(z); const t = topT(z); return [side * mix(sideX(z,belt(z)),cabinX(z,t),v), mix(belt(z) + .012, Math.max(belt(z)+.013,top-.007), v), z]; }, glass, true);
          tube(panel, Array.from({ length: 16 }, (_, i): V => { const z = mix(a, b, i / 15); return [side * sideX(z,belt(z)), belt(z) + .013, z]; }), .006, black, true);
          if (key.includes('door')) {
            tube(panel, [[side * width(a), belt(a), a], [side * cabinX(a, topT(a)*.6), mix(belt(a), cabinTop(a), .6), a], [side * cabinX(a, topT(a)), cabinTop(a), a]], .025, black, true);
            box(panel, [.025, .035, .19], [side * (width(a + .2) + .016), belt(a + .2) - .12, a + .2], darkAlloy, .012, true);
            surface(panel, (u, v) => { const z = mix(a + .035, b - .035, u), top = belt(z) - .045; return [side * (width(z) - .075), mix(Math.min(top, Math.max(s.belt - .32, low(z) + .035)), top, v), z]; }, leather, false, 32, 4);
          }
        }
      }
      if(key==='quarter')surface(panel,(u,v)=>{const z=mix(za+.003,windowRear-.003,u),top=Math.max(belt(z)+.014,cabinTop(z));return [side*mix(sideX(z,belt(z)),cabinX(z,topT(z)),v),mix(belt(z)+.01,top,v),z];},paint,true,64,24);
      if(id==='x9'&&key==='quarter')tube(panel,[[side*(width(-2.15)+.005),1.15,-2.15],[side*(width(-1.65)+.005),1.17,-1.65],[side*(width(-1.31)+.005),1.18,-1.31]],.010,black,true);
      if(key.includes('door')){
        const doorZ=(za+zb)/2;
        box(panel,[.056,.051,.40],[side*(half-.18),s.belt-.20,doorZ],leather,.018);
        const speaker=mesh(panel,new THREE.CylinderGeometry(.078,.07,.018,40),black,[side*(half-.15),.65,doorZ]);speaker.rotation.z=Math.PI/2;
        const grille=mesh(panel,new THREE.TorusGeometry(.079,.003,8,48),alloy,[side*(half-.163),.65,doorZ]);grille.rotation.y=Math.PI/2;
      }
      if (key === 'front-door') {
        box(panel, [.2, .035, .075], [side * (half + .05), s.belt + .09, zb - .13], black, .018, true);
        const mirror=mesh(panel,new THREE.SphereGeometry(1,32,18),paint,[side*(half+.14),s.belt+.15,zb-.1],true);mirror.scale.set(.14,.062,.114);
        box(panel, [.19, .07, .012], [side * (half + .15), s.belt + .15, zb - .213], glass, .026, true);
      }
    }
    // Curved A/C pillars and roof rails bind to the removable roof, not arbitrary triangle buckets.
    tube(roof, Array.from({ length: 49 }, (_, i): V => { const z = mix(s.screenRear, s.screenFront, i / 48), y = cabinTop(z); const t = topT(z); return [side * cabinX(z, t), y, z]; }), .026, id === 'gx' ? black : paint, true);
    const rocker = part(`sill-${side}`, `${label}门槛`, [side * .65, .05, 0]);
    box(rocker, [.11, .08, s.wheelbase - tireR * 2], [side * (half - .065), .235, 0], black, .025, true);
  }
  // Fascias are individually authored for each model; every trim follows the curved skin.
  function patch(parent:THREE.Group,end:number,points:number[][],m:THREE.Material,depth=.012){
    points=roundedTrim(points);
    const contour=points.map(([x,y])=>new THREE.Vector2(x,y));
    const triangles=THREE.ShapeUtils.triangulateShape(contour,[]),positions:number[]=[],indices:number[]=[];
    // Subdivide before projection so wide grille/lamps follow the bumper, never a chord through it.
    for(const [ia,ib,ic] of triangles){
      const a=points[ia],b=points[ib],c=points[ic],n=12;
      const at=(u:number,v:number)=>{const x=a[0]+(b[0]-a[0])*u+(c[0]-a[0])*v,y=a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v;return [x,y,endZ(end,x,y)+end*depth];};
      const tri=(p:number[],q:number[],r:number[])=>{const k=positions.length/3;positions.push(...p,...q,...r);indices.push(k,k+1,k+2);};
      for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
        tri(at(i/n,j/n),at((i+1)/n,j/n),at(i/n,(j+1)/n));
        if(i+j<n-1)tri(at((i+1)/n,j/n),at((i+1)/n,(j+1)/n),at(i/n,(j+1)/n));
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);
    const normals:number[]=[];
    for(let k=0;k<positions.length;k+=3){const x=positions[k],y=positions[k+1],dx=(endZ(end,x+.0001,y)-endZ(end,x-.0001,y))/.0002,dy=(endZ(end,x,y+.0001)-endZ(end,x,y-.0001))/.0002;const n=new THREE.Vector3(-dx*end,-dy*end,end).normalize();normals.push(...n.toArray());}
    g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    return mesh(parent,g,m,[0,0,0],true);
  }
  function ribbon(parent:THREE.Group,end:number,points:number[][],radius:number,m:THREE.Material,depth=.023){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)),false,'centripetal');
    return surface(parent,(u,v)=>{const p=curve.getPoint(u),t=curve.getTangent(u),x=p.x-t.y*(v*2-1)*radius,y=p.y+t.x*(v*2-1)*radius;return [x,y,endZ(end,x,y)+end*(Math.min(depth,.026)+.002*Math.sin(v*Math.PI))];},m,true,Math.max(20,points.length*2),6);
  }
  const glyph:Record<string,number[][][]>={X:[[[0,0],[.8,1]],[[0,1],[.8,0]]],P:[[[0,0],[0,1],[.7,1],[.8,.8],[.6,.5],[0,.5]]],E:[[[.8,1],[0,1],[0,0],[.8,0]],[[0,.5],[.65,.5]]],N:[[[0,0],[0,1],[.8,0],[.8,1]]],G:[[[.8,.9],[.6,1],[0,1],[0,0],[.8,0],[.8,.5],[.45,.5]]],L:[[[0,1],[0,0],[.8,0]]],M:[[[0,0],[0,1],[.4,.5],[.8,1],[.8,0]]],'0':[[[0,0],[0,1],[.8,1],[.8,0],[0,0]]],'3':[[[0,1],[.8,1],[.8,0],[0,0]],[[.8,.5],[.1,.5]]],'9':[[[.8,0],[.8,1],[0,1],[0,.5],[.8,.5]]]};
  function textBadge(parent:THREE.Group,end:number,text:string,y:number,height:number,spread=1.3,plate=false){
    const total=(text.length-1)*spread+.8;
    [...text].forEach((ch,i)=>{for(const path of glyph[ch]??[]){const pts=path.map(([x,yy]):V=>[end*(x+i*spread-total/2)*height,y+yy*height,end*(front+.038)]);if(plate)tube(parent,pts,height*.035,alloy,true);else ribbon(parent,end,pts.map(([x,yy])=>[x,yy]),height*.035,alloy,.027);}});
  }
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const z=front-.29;const points:V[]=[[sx*.006,hoodEdge(z)+.03,z],[sx*.067,hoodEdge(z+sz*.026)+.03,z+sz*.026],[sx*.044,hoodEdge(z)+.03,z+sz*.004]];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.computeVertexNormals();mesh(bonnet,g,darkAlloy,[0,0,0],true);
  }
  const bumperRear=part('bumper-rear','后保险杠 / 下护板 / 牌照框',[0,.1,-1.65]);
  for(const end of [-1,1]){
    const face=end===1?part('bumper-front',id==='gx'?'贯穿星环前灯 / 分体灯腔':id==='x9'?'星舰前脸 / 分体灯 / 进气格栅':'T形灯组 / 主动进气前杠',[0,.15,1.25]):hatch;
    const top=end===1?hoodEdge(front):belt(-endStation)+.025;
    for(const [lo,hi,parent] of (end===1?[[.235,top,face]]:[[.235,.65,bumperRear],[.654,top,face]]) as [number,number,THREE.Group][]){
      surface(parent,(u,v)=>{const t=u*2-1,y=mix(lo,hi===top?faceTop(end,t):hi,v),x=t*faceWidth(end,y);return [x,y,endZ(end,x,y)];},paint,true,96,24);
    }
    if(end===1){
      if(id==='x9'||id==='gx'){
        const lightY=top-.018;
        const path=Array.from({length:64},(_,i)=>{const x=mix(-half*.88,half*.88,i/63);return [x,lightY+.018*(x/half)**2];});
        ribbon(face,end,path,.023,black,.012);ribbon(face,end,path,.010,white,.029);
        for(const side of [-1,1]){
          if(id==='x9'){
            patch(face,end,[[side*.49,top-.105],[side*.90,top-.080],[side*.88,top-.177],[side*.63,top-.207]],black);
            for(let k=0;k<3;k++){
              const x=side*(.64+k*.085),y=top-.150;
              const optic=mesh(face,new THREE.SphereGeometry(1,24,12),alloy,[x,y,endZ(end,x,y)+.018],true);optic.scale.set(.034,.017,.008);
              ribbon(face,end,[[x-.027,y-.013],[x+.027,y-.013]],.004,white,.03);
            }
            patch(face,end,[[side*.90,.295],[side*.90,.795],[side*.72,.80],[side*.56,.71],[side*.43,.30]],black);
            patch(face,end,[[side*.88,.31],[side*.878,.778],[side*.731,.779],[side*.585,.699],[side*.46,.31]],paint,.018);
          }else{
            patch(face,end,[[side*.57,.49],[side*.87,.49],[side*.87,.67],[side*.58,.67]],black);
            for(let k=0;k<2;k++){const x=side*(.67+k*.11);box(face,[.075,.048,.022],[x,.578,endZ(end,x,.578)+.023],alloy,.018,true);}
            ribbon(face,end,[[side*.28,.675],[side*.85,.675]],.007,black);
            ribbon(face,end,[[side*.77,lightY-.02],[side*.77,lightY+.02]],.004,alloy,.04);
          }
        }
      }else{
        for(const side of [-1,1]){
          const y=top-.008;
          patch(face,end,[[side*.38,y],[side*.76,y+.085],[side*.885,y+.085],[side*.90,y-.16],[side*.79,y-.18],[side*.73,y-.045],[side*.40,y-.028]],black);
          ribbon(face,end,[[side*.405,y-.005],[side*.60,y+.009],[side*.78,y+.03],[side*.878,y+.077]],.011,white);
          ribbon(face,end,[[side*.775,y+.025],[side*.788,y-.062],[side*.83,y-.162]],.009,white);
          for(let k=0;k<3;k++)ribbon(face,end,[[side*.80,y-.022-k*.033],[side*.862,y-.016-k*.033]],.006,alloy,.031);
        }
      }
      const openingTop=id==='x9'?.54:id==='gx'?.43:.385;
      patch(face,end,[[-.64,.255],[.64,.255],[.72,openingTop],[-.72,openingTop]],black);
      for(let i=0;i<4;i++)ribbon(face,end,[[-.60,.28+i*(openingTop-.28)/4],[.60,.28+i*(openingTop-.28)/4]],.006,darkAlloy);
      ribbon(face,end,[[-.85,.25],[-.50,.238],[.50,.238],[.85,.25]],.012,alloy);
    }else{
      surface(bumperRear,(u,v)=>{const y=mix(.64,.658,v),x=(u*2-1)*faceWidth(end,y);return [x,y,endZ(end,x,y)+.006];},black,true,96,4);
      if(id==='m03'){
        for(const side of [-1,1]){
          const y=top-.06;
          patch(face,end,[[side*.38,y+.025],[side*.87,y+.10],[side*.89,y-.17],[side*.79,y-.16],[side*.74,y-.035],[side*.38,y-.018]],black);
          ribbon(face,end,[[side*.4,y],[side*.65,y+.015],[side*.85,y+.065]],.012,red);
          ribbon(face,end,[[side*.77,y+.033],[side*.80,y-.06],[side*.84,y-.14]],.009,red);
        }
      }else{
        const y=id==='gx'?1.10:top-.08;
        const path=Array.from({length:70},(_,i)=>{const x=mix(-half*.90,half*.90,i/69);return [x,y+.022*(x/half)**2];});
        ribbon(face,end,path,id==='gx'?.065:.036,black,.014);
        ribbon(face,end,path,id==='gx'?.017:.010,red,.057);
        if(id==='l03')ribbon(face,end,path.map(([x,yy])=>[x,yy+.035]),.007,red,.051);
        if(id==='gx')for(const side of [-1,1])ribbon(face,end,[[side*.65,y-.056],[side*.65,y+.051]],.006,alloy,.079);
      }
      textBadge(face,end,'XPENG',id==='gx'?top-.053:id==='x9'?top-.075:top-.215,.034,3.4);
      patch(bumperRear,end,[[-.82,.25],[.82,.25],[.82,.38],[-.82,.38]],black);
      for(const side of [-1,1])ribbon(bumperRear,end,[[side*.61,.385],[side*.84,.40]],.007,red);
      for(const side of [-1,1])ribbon(face,end,[[side*.66,.657],[side*.77,.72],[side*.80,top-.015]],.0025,black,.004);
    }
    const plateY=end===1?(id==='x9'?.64:.49):.52,parent=end===1?face:bumperRear;
    box(parent,[.41,.128,.02],[0,plateY,end*(front+.025)],black,.012,true);
    textBadge(parent,end,id.toUpperCase(),plateY-.022,.043,1.3,true);
    for(const x of [-.67,-.36,.36,.67]){
      const y=end===1?.59:.48;const sensor=mesh(end===1?face:bumperRear,new THREE.CylinderGeometry(.010,.010,.004,16),darkAlloy,[x,y,endZ(end,x,y)+end*.005],true);sensor.rotation.x=Math.PI/2;
    }
  }
  const spoiler=part('spoiler',id==='m03'?'掀背鸭尾 / 后沿扰流板':'后顶翼 / 高位制动灯',[0,.75,-.50]);
  const wingZ=id==='m03'?rear+.13:s.roofRear-.09,wingY=id==='m03'?belt(rear)+.09:roofY(s.roofRear)+.012;
  surface(spoiler,(u,v)=>{const x=(u*2-1)*(id==='m03'?half*.89:s.roofWidth),z=mix(wingZ-.10,wingZ+.12,v);return [x,wingY+.025*Math.sin(v*Math.PI)-.015*(u*2-1)**2,z];},id==='m03'?paint:black,true,64,12);
  tube(spoiler,[[-.35,wingY-.005,wingZ-.103],[.35,wingY-.005,wingZ-.103]],.006,red,true);
  // Wheels: rounded tire profile, shoulder rings, brake rotor and machined radial spokes.
  for (const axle of [-1, 1]) for (const side of [-1, 1]) {
    const z = axle * wheelZ, x = side * (half - .115);
    const wheel = part(`wheel-${axle}-${side}`, `${axle === 1 ? '前' : '后'}${side === 1 ? '左' : '右'}轮 / 制动`, [side * 1.45, 0, axle * .22]);
    wheel.userData.axleZ = z; wheel.userData.rollingCenter=[x,tireR,z];wheel.userData.rollingRadius=tireR;
    const rimR=profile.rim;
    const tireProfile=[[rimR,-.123],[tireR-.031,-.123],[tireR-.004,-.095],[tireR,-.060],[tireR,.060],[tireR-.004,.095],[tireR-.031,.123],[rimR,.123],[rimR,-.123]].map(([r,y])=>new THREE.Vector2(r,y));
    const tire=mesh(wheel,new THREE.LatheGeometry(tireProfile,80),rubber,[x,tireR,z]);tire.rotation.z=Math.PI/2;
    for(const d of [-.06,-.02,.02,.06]){const ring=mesh(wheel,new THREE.TorusGeometry(tireR-.002,.0016,4,80),black,[x+d,tireR,z]);ring.rotation.y=Math.PI/2;}
    const rotor=mesh(wheel,new THREE.CylinderGeometry(rimR*.81,rimR*.81,.018,64),darkAlloy,[x+side*.065,tireR,z]);rotor.rotation.z=Math.PI/2;
    const barrel=mesh(wheel,new THREE.CylinderGeometry(rimR,rimR,.20,64,1,true),black,[x,tireR,z]);barrel.rotation.z=Math.PI/2;
    const rim=mesh(wheel,new THREE.TorusGeometry(rimR,.009,8,80),alloy,[x+side*.126,tireR,z]);rim.rotation.y=Math.PI/2;
    const spokeCount=id==='x9'?24:id==='gx'?20:5;
    for(let i=0;i<spokeCount;i++){
      const a=i/spokeCount*Math.PI*2;
      if(spokeCount===5){
        const shape=id==='m03'
          ? [[.055,-.035],[rimR*.70,-.074],[rimR*.99,-.069],[rimR*.99,.017],[rimR*.67,.038],[.076,.024]]
          : [[.058,-.028],[rimR*.74,-.089],[rimR*.99,-.066],[rimR*.81,-.013],[rimR*.97,.039],[rimR*.90,.078],[.080,.032]];
        const outline=new THREE.Shape(shape.map(([r,t])=>new THREE.Vector2(r,t)));
        const g=new THREE.ExtrudeGeometry(outline,{depth:.012,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:2,steps:1});
        const pos=g.getAttribute('position');
        for(let k=0;k<pos.count;k++){const r=pos.getX(k),t=pos.getY(k),depth=pos.getZ(k);pos.setXYZ(k,x+side*(.125+depth),tireR+r*Math.cos(a)-t*Math.sin(a),z+r*Math.sin(a)+t*Math.cos(a));}
        g.computeVertexNormals();mesh(wheel,g,alloy);
      }else{
        const outline=new THREE.Shape([[.064,-.011],[rimR*.80,-.014],[rimR*.98,-.022],[rimR*.98,.011],[.080,.008]].map(([r,t])=>new THREE.Vector2(r,t)));
        const g=new THREE.ExtrudeGeometry(outline,{depth:.010,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:2,steps:1});const p=g.getAttribute('position');
        for(let j=0;j<p.count;j++){const r=p.getX(j),t=p.getY(j),d=p.getZ(j);p.setXYZ(j,x+side*(.125+d),tireR+r*Math.cos(a)-t*Math.sin(a),z+r*Math.sin(a)+t*Math.cos(a));}g.computeVertexNormals();mesh(wheel,g,alloy);
        const insert=box(wheel,[.012,.038,.022],[x+side*.137,tireR+Math.cos(a)*rimR*.83,z+Math.sin(a)*rimR*.83],darkAlloy,.002);insert.rotation.x=a;
      }
    }
    const hub=mesh(wheel,new THREE.CylinderGeometry(.065,.065,.029,40),darkAlloy,[x+side*.137,tireR,z]);hub.rotation.z=Math.PI/2;
    for(const d of [-1,1])tube(wheel,[[x+side*.154,tireR-.018,z+d*.022],[x+side*.154,tireR,z],[x+side*.154,tireR+.018,z-d*.022]],.003,alloy);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5,b=mesh(wheel,new THREE.CylinderGeometry(.008,.008,.007,10),alloy,[x+side*.155,tireR+.045*Math.cos(a),z+.045*Math.sin(a)]);b.rotation.z=Math.PI/2;}
    box(wheel,[.050,.15,.063],[x+side*.072,tireR+.01,z+.19],id==='l03'?mat('#c8ce48',.43,.4):darkAlloy,.018).name='brake-caliper';
  }
  // Authored interior topology reflects visible row counts; packaging remains schematic.
  const floor = part('platform', '地板 / 纵梁 · 结构示意', [0, .04, -1.3]);
  box(floor, [s.width - .26, .05, s.length - .72], [0, .405, -.12], black, .02).name='cabin-floor';
  for (const side of [-1, 1]) box(floor, [.09, .1, s.wheelbase + .25], [side * .765, .30, 0], darkAlloy);
  const rowZ = id==='x9'?[.83,-.43,-1.52]:id==='gx'?[.66,-.48,-1.50]:[.45,-.72];
  s.rows.forEach((count, row) => {
    for (let seat = 0; seat < count; seat++) {
      const x = count === 2 ? (seat ? -.48 : .48) : (1 - seat) * .48;
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
      box(chair, [w * .65, .16, .29], [x, .46, z], darkAlloy);
      for(const side of [-1,1]){
        box(chair,[.035,.024,.61],[x+side*.17,.415,z],alloy,.007);
        tube(chair,[[x+side*.095,1.12,z-.29],[x+side*.095,1.22,z-.29]],.007,alloy);
        const bolster=box(chair,[.06,.37,.086],[x+side*(w/2-.039),.91,z-.14],leather,.028);bolster.rotation.x=-.12;
        tube(chair,[[x+side*(w/2-.012),.69,z+.17],[x+side*(w/2-.012),.71,z-.16],[x+side*(w/2-.013),.92,z-.11],[x+side*(w/2-.025),1.12,z-.17]],.003,seam);
      }
      box(chair,[w*.68,.018,.31],[x,.671,z],leather,.015);
      for(let j=0;j<5;j++)tube(chair,[[x-w*.32,.92+j*.036,z-.157],[x+w*.32,.92+j*.036,z-.157]],.002,seam);
      box(chair,[.035,.07,.024],[x-w*.55,.68,z-.14],black,.007);
      if(s.rows.length===3&&row===1){const leg=box(chair,[w*.87,.075,.29],[x,.555,z+.29],leather,.027);leg.rotation.x=-.16;}

    }
  });
  const cockpit = part('cockpit', '仪表台 / 方向盘 / 中控屏', [0, .65, 1.1]);
  const dashZ = s.screenFront - .2, dashY = s.belt - .08;
  box(cockpit, [s.width - .2, .15, .34], [0, dashY, dashZ], black, .065);
  box(cockpit, [s.width - .25, .1, .22], [0, dashY - .11, dashZ], leather, .035);
  box(cockpit, [.38, .25, .035], [0, dashY + .085, dashZ - .2], black, .013);
  box(cockpit, [.35, .22, .006], [0, dashY + .085, dashZ - .221], screen, .006);
  for (let j = 0; j < 3; j++) box(cockpit, [.065, .012, .008], [-.105 + j * .105, dashY + .15, dashZ - .227], white, .003);
  if (id !== 'm03') box(cockpit, [.25, .095, .035], [.46, dashY + .065, dashZ - .17], screen, .012);
  const steering = mesh(cockpit, new THREE.TorusGeometry(.155, .017, 10, 40), black, [.46, dashY - .01, dashZ - .38]); steering.rotation.x = -.25;
  box(cockpit, [.22, .032, .028], [.46, dashY - .01, dashZ - .38], alloy, .01);
  box(cockpit, [.065, .09, .04], [.46, dashY - .02, dashZ - .385], black, .02);
  box(cockpit, [.28, .16, .64], [0, .65, .55], leather, .045);
  box(cockpit, [.23, .02, .29], [0, .743, .70], black, .015);
  for(const side of [-1,1]){
    tube(cockpit,[[side*.1,dashY+.04,dashZ-.18],[side*.5,dashY+.04,dashZ-.17],[side*.78,dashY+.03,dashZ-.13]],.005,alloy);
    box(cockpit,[.29,.018,.012],[side*.58,dashY-.045,dashZ-.186],black,.006);
  }
  for(const x of [-.064,.064]){const cup=mesh(cockpit,new THREE.TorusGeometry(.045,.006,8,32),darkAlloy,[x,.754,.32]);cup.rotation.x=Math.PI/2;}
  box(cockpit,[.32,.055,.31],[0,.78,.17],leather,.022);
  if(s.rows.length===3){
    const rearComfort=part('rear-comfort','二排顶屏 / 顶置出风口 / 后排控制屏',[0,1.2,-.35]);
    box(rearComfort,[.49,.024,.28],[0,s.height-.10,-.28],black,.012);
    box(rearComfort,[.45,.006,.245],[0,s.height-.115,-.28],screen,.009);
    box(rearComfort,[.18,.12,.017],[0,.77,.10],screen,.008);
    for(const side of [-1,1])box(rearComfort,[.035,.024,1.0],[side*.60,s.height-.09,-.42],black,.008);
  }
  const coolant=mat('#458088',.58,.3),orange=mat('#dd681e',.64),copper=mat('#b68d5c',.35,.75);
  const packLength=s.wheelbase-(s.generator?1.03:.72),packZ=s.generator?.22:-.04,packWidth=1.37;
  const battery=part('battery','动力电池托盘 / 密封边框 · 包装位置重建',[0,.10,3.3]);
  box(battery,[packWidth,.025,packLength],[0,.216,packZ],darkAlloy,.016);
  for(const side of [-1,1])box(battery,[.033,.115,packLength],[side*(packWidth/2-.012),.271,packZ],alloy,.008);
  for(const z of [packZ-packLength/2,packZ+packLength/2])box(battery,[packWidth,.11,.033],[0,.271,z],alloy,.008);
  const coldplate=part('battery-cooling','电池冷板 / 进回水路 · 走线估计',[0,.30,3.3]);
  box(coldplate,[1.29,.013,packLength-.10],[0,.251,packZ],coolant,.009);
  for(let i=0;i<7;i++){const z=packZ-packLength/2+.13+i*(packLength-.26)/7;tube(coldplate,[[-.57,.264,z],[.57,.264,z],[.59,.264,z+.10],[-.57,.264,z+.10]],.005,coolant);}
  const modules=part('battery-modules','电池分区 / 汇流排 · 非原厂电芯数量',[0,.67,3.3]);
  for(let i=0;i<6;i++)for(let j=0;j<3;j++){
    const x=(j-1)*.432,z=packZ+(i-2.5)*(packLength-.13)/6;
    box(modules,[.414,.051,(packLength-.18)/6],[x,.30,z],batteryMat,.008);
    for(let k=0;k<6;k++)box(modules,[.40,.002,.002],[x,.327,z+(k-2.5)*(packLength-.25)/40],alloy,.0005);
    box(modules,[.10,.01,.025],[x,.334,z+.09],copper,.003);
  }
  const lid=part('battery-cover','电池上盖 / 安装螺栓',[0,.95,3.3]);
  box(lid,[1.40,.012,packLength+.025],[0,.353,packZ],darkAlloy,.015);
  for(const side of [-1,1])for(let i=0;i<10;i++)mesh(lid,new THREE.CylinderGeometry(.006,.006,.005,8),alloy,[side*.681,.363,packZ-packLength/2+.055+i*(packLength-.11)/9]);
  const driveAxles=s.drive==='awd'?[-1,1]:s.drive==='front'?[1]:[-1];
  for(const axle of [-1,1]){
    const z=axle*wheelZ,frontMac=axle===1&&(id==='l03'||id==='m03'),torsion=axle===-1&&id==='m03',hArm=axle===-1&&(id==='x9'||id==='gx');
    const type=torsion?'扭力梁':frontMac?'麦弗逊':axle===1?'双叉臂':hArm?'H臂多连杆':'五连杆';
    const frame=part(`suspension-${axle}`,`${axle===1?'前':'后'}${type} / 副车架 · 关节点估计`,[0,.25,axle*1.95]);frame.userData.topology=type;
    if(torsion){box(frame,[1.37,.10,.095],[0,.32,z+.16],darkAlloy,.015);}else tube(frame,[[-.55,.34,z-.24],[-.58,.34,z+.23],[.58,.34,z+.23],[.55,.34,z-.24],[-.55,.34,z-.24]],.039,darkAlloy);
    for(const side of [-1,1]){
      const hubX=side*(half-.19);
      tube(frame,[[hubX,.26,z],[hubX,.56,z]],.029,darkAlloy);
      if(torsion){tube(frame,[[side*.60,.33,z+.45],[hubX,.32,z+.15],[hubX,tireR,z]],.032,alloy);}
      else if(frontMac||axle===1){
        const levels=frontMac?[.30]:[.30,.57];for(const y of levels)tube(frame,[[side*.38,y,z-.21],[hubX,y+.02,z],[side*.38,y,z+.21]],.022,alloy);
      }else if(hArm){
        for(const dz of [-.16,.16])tube(frame,[[side*.31,.30,z+dz],[hubX,.30,z+dz]],.029,alloy);
        tube(frame,[[side*.59,.30,z-.16],[side*.59,.30,z+.16]],.027,alloy);
        for(const dz of [-.16,.16])tube(frame,[[side*.36,.52,z+dz],[hubX,.54,z]],.018,alloy);
      }else{
        for(const [y,dz] of [[.30,-.21],[.31,.23],[.52,-.18],[.53,.21],[.40,.38]])tube(frame,[[side*.38,y,z+dz],[hubX,y+.013,z]],.019,alloy);
      }
      tube(frame,[[hubX,tireR,z],[side*.68,.82,z-.05]],.022,alloy);
      tube(frame,[[side*.72,.48,z-.015],[side*.68,.82,z-.05]],.032,darkAlloy);
      if(id==='x9'||id==='gx'){
        for(let i=0;i<5;i++)mesh(frame,new THREE.CylinderGeometry(.067+(i%2)*.004,.067,.027,32),rubber,[side*.64,.51+i*.032,z+.01]);
        mesh(frame,new THREE.CylinderGeometry(.081,.081,.017,32),alloy,[side*.64,.687,z+.01]);
      }else{
        const spring:V[]=Array.from({length:101},(_,i)=>{const t=i/100,a=t*Math.PI*12;return [side*.67+.055*Math.cos(a),.46+t*.23,z+.055*Math.sin(a)];});tube(frame,spring,.006,rubber);
      }
      for(const dz of [-.2,.2])mesh(frame,new THREE.SphereGeometry(.03,16,10),rubber,[side*.38,.32,z+dz]);
    }
    if(!torsion)tube(frame,[[-.73,.38,z+.14],[-.46,.40,z+.28],[.46,.40,z+.28],[.73,.38,z+.14]],.012,darkAlloy);
    if(hArm){box(frame,[.67,.065,.07],[0,.43,z-.08],darkAlloy,.02);for(const side of [-1,1])tube(frame,[[side*.30,.43,z-.08],[side*.76,.40,z-.06]],.012,alloy);}
    if(driveAxles.includes(axle)){
      const motor=part(`motor-${axle}`,`${axle===1?'前':'后'}三合一电驱 / 减速器 / 半轴`,[0,.85,axle*1.95]);
      const body=mesh(motor,new THREE.CylinderGeometry(.135,.135,.38,48),alloy,[-.10,.49,z]);body.rotation.z=Math.PI/2;
      for(let i=0;i<10;i++){const fin=mesh(motor,new THREE.CylinderGeometry(.14,.14,.008,40),darkAlloy,[-.27+i*.033,.49,z]);fin.rotation.z=Math.PI/2;}
      box(motor,[.27,.20,.24],[.20,.46,z],alloy,.055);box(motor,[.43,.078,.24],[0,.65,z],darkAlloy,.016);
      for(const side of [-1,1]){tube(motor,[[side*.29,.45,z],[side*(half-.19),tireR,z]],.018,alloy);for(let i=0;i<5;i++){const boot=mesh(motor,new THREE.CylinderGeometry(.037,.036,.009,20),rubber,[side*(half-.32+i*.012),tireR+.012,z]);boot.rotation.z=Math.PI/2;}}
    }
  }
  const thermal=part('thermal-front','前舱散热器 / 风扇 / 压缩机 / 储液罐',[0,1.1,1.85]);
  const radiatorZ=front-.38;
  box(thermal,[1.14,.28,.055],[0,.57,radiatorZ],darkAlloy,.012);
  for(let i=0;i<25;i++)box(thermal,[.009,.255,.06],[-.53+i*.044,.57,radiatorZ],alloy,.002);
  for(const x of [-.30,.30]){
    mesh(thermal,new THREE.TorusGeometry(.113,.01,8,40),black,[x,.57,radiatorZ-.039]);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7,blade=box(thermal,[.105,.033,.014],[x+.053*Math.cos(a),.57+.053*Math.sin(a),radiatorZ-.043],black,.01);blade.rotation.z=a+.5;}
  }
  const compressor=mesh(thermal,new THREE.CylinderGeometry(.075,.075,.21,32),alloy,[-.40,.59,wheelZ-.04]);compressor.rotation.z=Math.PI/2;
  box(thermal,[.18,.18,.18],[.49,.69,wheelZ-.09],leather,.025);
  tube(thermal,[[-.4,.60,wheelZ],[-.59,.56,radiatorZ-.12],[-.48,.52,radiatorZ]],.012,coolant);
  const hv=part('hv-system','高压配电 / 充电控制 / 橙色高压线束',[1.0,.7,.6]);
  box(hv,[.39,.085,.26],[-.28,.66,wheelZ-.25],darkAlloy,.016);
  for(let i=0;i<9;i++)box(hv,[.35,.007,.01],[-.28,.707,wheelZ-.35+i*.024],alloy,.002);
  for(const axle of driveAxles)tube(hv,[[.52,.33,packZ+axle*packLength*.4],[.57,.41,axle*wheelZ*.87],[.20,.63,axle*wheelZ]],.012,orange);
  tube(hv,[[-.52,.32,packZ+packLength*.42],[-.60,.47,wheelZ-.39],[-.28,.67,wheelZ-.25]],.012,orange);
  const cage=part('body-cage','白车身 / A-B-C柱 / 车顶横梁 · 路径重建',[0,1.38,0]);
  for(const side of [-1,1]){
    tube(cage,[[side*(half-.15),.44,s.screenFront-.25],...Array.from({length:24},(_,i):V=>{const z=mix(s.screenFront-.05,s.screenRear+.05,i/23);return [side*(cabinX(z,topT(z))-.035),roofY(z)-.026,z];}),[side*(half-.15),.44,profile.rearDoor]],.027,darkAlloy);
    for(const z of [profile.split,profile.rearDoor])tube(cage,[[side*(half-.15),.44,z],[side*(width(z)-.06),belt(z),z],[side*(cabinX(z,topT(z))-.035),roofY(z)-.03,z]],.029,darkAlloy);
    box(cage,[.076,.077,s.wheelbase+.18],[side*(half-.15),.425,0],darkAlloy,.019);
  }
  for(const z of [s.roofFront-.25,s.roofRear+.24])tube(cage,[[-s.roofWidth+.035,roofY(z)-.04,z],[0,roofY(z)-.024,z],[s.roofWidth-.035,roofY(z)-.04,z]],.022,alloy);
  const luggage=part('rear-floor','后地板 / 轮罩加强肋 / 行李舱衬板',[0,.48,-2.2]);
  const rearDeckY=s.rows.length===3?.46:.53;
  box(luggage,[1.33,.035,.63],[0,rearDeckY,rear+.52],darkAlloy,.019);
  for(const x of [-.54,-.27,0,.27,.54])box(luggage,[.018,.035,.58],[x,rearDeckY+.025,rear+.52],alloy,.005);
  for(const side of [-1,1])tube(luggage,[[side*.60,.45,rear+.18],[side*.64,.62,-wheelZ-.18],[side*.64,.69,-wheelZ],[side*.62,.52,-wheelZ+.24]],.031,darkAlloy);
  if(s.generator){
    const generator=part('generator','前舱增程发电机 / 进气 / 排气热屏蔽 · 包装重建',[0,1.6,1.65]);
    box(generator,[.44,.27,.39],[.03,.65,wheelZ+.14],darkAlloy,.036);
    for(let i=0;i<4;i++)box(generator,[.06,.04,.33],[-.12+i*.10,.805,wheelZ+.14],alloy,.01);
    const gen=mesh(generator,new THREE.CylinderGeometry(.13,.13,.20,40),alloy,[.34,.62,wheelZ+.14]);gen.rotation.z=Math.PI/2;
    box(generator,[.37,.05,.31],[.015,.84,wheelZ+.14],black,.02);
    tube(generator,[[-.1,.80,wheelZ+.12],[-.26,.83,wheelZ+.35],[-.4,.80,wheelZ+.28]],.043,black);
    const fuel=part('fuel-system','增程油箱 / 加注管 / 隔热排气 · 走向估计',[-1.1,.45,-1.4]);
    box(fuel,[.86,.16,.49],[0,.29,packZ-packLength/2-.33],black,.045);
    tube(fuel,[[.42,.30,packZ-packLength/2-.35],[.58,.45,-wheelZ],[.83,.8,rear+.38]],.019,darkAlloy);
    tube(fuel,[[-.34,.42,wheelZ+.14],[-.72,.29,.8],[-.72,.27,-1.20],[-.59,.25,rear+.24]],.017,alloy);
    box(fuel,[.32,.11,.27],[-.48,.28,rear+.36],alloy,.028);
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
