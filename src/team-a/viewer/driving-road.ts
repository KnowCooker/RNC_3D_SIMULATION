import * as THREE from 'three';
import type { RoadSurface } from './scene-stage';
import type { GalleryEnvironment } from './champagne-gallery';
import { roadSegment, travelDistance } from './driving-state';
import { routePoint, sampleDrivingRoute } from './driving-route';

const ROAD_CHUNKS=20;
const asphaltUrl = new URL('./assets/asphalt_02_diff_4k.jpg', import.meta.url).href;
const asphaltNormalUrl = new URL('./assets/asphalt_02_nor_gl_2k.jpg', import.meta.url).href;
const gravelUrl = new URL('./assets/gravel_floor_diff_4k.jpg', import.meta.url).href;
const gravelNormalUrl = new URL('./assets/gravel_floor_nor_gl_2k.jpg', import.meta.url).href;
const skyUrl = new URL('./assets/small_rural_road_8k.jpg', import.meta.url).href;
const terrainUrl = new URL('./assets/aerial_grass_rock_diff_2k.jpg', import.meta.url).href;

/** World-indexed roadside scenery. Vehicle/acoustic coordinates remain fixed; world moves by v*t. */
export function createDrivingRoad(anisotropy = 8) {
  const group = new THREE.Group(); group.name = 'procedural-driving-road';
  const floor = new THREE.Group(); group.add(floor);
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const mat = (color: string, roughness = .9, metalness = 0) => { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(m); return m; };
  const asphalt = mat('#515453'), gravel = mat('#988e77'), terrain = mat('#78825d'), bark = mat('#635443');
  const leaves = mat('#536344'), stone = mat('#898777'), line = mat('#f6f1d8'), steel = mat('#a4abad', .45, .65);
  const basic = new THREE.MeshBasicMaterial({ color: '#b6cbd6', side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }); materials.add(basic);
  const skyG = new THREE.SphereGeometry(850, 96, 48); geometry.add(skyG);
  const sky = new THREE.Mesh(skyG, basic); sky.name = 'driving-photo-panorama'; sky.renderOrder = -20; group.add(sky);
  let disposed = false, loading = false, pending = 0, failed = false, surface: RoadSurface = 'smooth', environment: GalleryEnvironment = 'coast';
  let skyPhoto: THREE.Texture | null = null, borrowedSky: THREE.Texture | null = null;
  let terrainPhoto: THREE.Texture | null = null, rockPhoto: THREE.Texture | null = null;
  function load(url: string, color: boolean, repeat: [number, number], done: (t: THREE.Texture) => void) {
    pending++;
    new THREE.TextureLoader().load(url, t => {
      pending--; if (disposed) { t.dispose(); return; }
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(...repeat); t.anisotropy = Math.min(16, anisotropy); textures.add(t); done(t);
    }, undefined, () => { pending--; failed = true; });
  }
  function ensureLoaded() {
    if (loading || disposed) return; loading = true;
    load(asphaltUrl, true, [7.2 / 3, 48 / 3], t => { asphalt.map = t; asphalt.color.set('#c4c6c3'); asphalt.needsUpdate = true; });
    load(asphaltNormalUrl, false, [7.2 / 3, 48 / 3], t => { asphalt.normalMap = t; asphalt.needsUpdate = true; });
    load(gravelUrl, true, [7.2 / 2.3, 48 / 2.3], t => { gravel.map = t; gravel.color.set('#cac4b7'); gravel.needsUpdate = true; });
    load(gravelNormalUrl, false, [7.2 / 2.3, 48 / 2.3], t => { gravel.normalMap = t; gravel.normalScale.set(.65, .65); gravel.needsUpdate = true; });
    load(skyUrl, true, [1, 1], t => { skyPhoto = t; updateSky(); });
    load(terrainUrl, true, [88, 9.6], t => { terrainPhoto = t; terrain.bumpMap = t; terrain.bumpScale = .055; const rockMap=t.clone();rockMap.repeat.set(1,1);rockMap.needsUpdate=true;textures.add(rockMap);rockPhoto=rockMap;stone.bumpMap=rockMap;stone.bumpScale=.08;setEnvironment(environment,borrowedSky,true); });
  }
  function updateSky() { lastDistance=NaN; const t = environment === 'coast' ? skyPhoto : borrowedSky; if (basic.map !== t) { basic.map = t; basic.color.set(t ? '#ffffff' : '#b6cbd6'); basic.needsUpdate = true; } sky.rotation.y = environment === 'coast' ? .4 : environment === 'mountain' ? .98 : environment === 'snow' ? .47 : .65; }
  const boxG = new THREE.BoxGeometry(1, 1, 1); geometry.add(boxG);
  function box(parent: THREE.Object3D, size: [number, number, number], xyz: [number, number, number], material: THREE.Material) {
    const m = new THREE.Mesh(boxG, material); m.scale.set(...size); m.position.set(...xyz); m.receiveShadow = true; parent.add(m); return m;
  }
  const terrainHeight = (x: number, d: number) => {
    const side = Math.max(0, Math.abs(x - 1.8) - 7);
    const ridge = .5 + .25 * Math.sin(d * .016 + x * .028) + .25 * Math.sin(d * .041 - x * .047);
    const start=environment==='coast'?30:environment==='desert'?8:18;
    const rise=Math.max(0,side-start);
    if((environment==='coast'||environment==='mountain')&&x < -16 && x > -185) return -2.3+Math.max(0,16-side)*.18;
    return -.065 + Math.min(environment==='coast'?28:70, rise*(environment==='coast'?.16:.32)) * (.25 + ridge * ridge) + Math.min(1.2,side*.025);
  };
  function ribbon(index: number, left: number, right: number, height: (x:number,d:number)=>number, columns = 1) {
    const vertices: number[] = [], uv: number[] = [], indices: number[] = [], rows = 24;
    for (let r=0;r<=rows;r++) for(let c=0;c<=columns;c++) {
      const d=index*48-24+r*2,x=left+(right-left)*c/columns;
      vertices.push(...routePoint(d,x,height(x,d)).toArray());uv.push(c/columns,r/rows);
    }
    for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){const a=r*(columns+1)+c,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const segments: { root: THREE.Group; deck: THREE.Mesh; markings: THREE.Group; index: number; geometries: THREE.BufferGeometry[] }[] = [];
  const water=mat('#3d8996',.24,.32);
  const timber=mat('#78604a'), roofMaterial=mat('#46535c',.7), signMaterial=mat('#234f49',.55), reflector=mat('#f6c86a',.5);
  function along(parent:THREE.Object3D,size:[number,number,number],x:number,y:number,d:number,material:THREE.Material) {
    const o=box(parent,size,[0,0,0],material), frame=sampleDrivingRoute(d);o.position.copy(routePoint(d,x,y));o.quaternion.copy(frame.rotation);return o;
  }
  function rebuild(slot:number,index:number) {
    const row=segments[slot];row.geometries.forEach(g=>g.dispose());row.geometries=[];row.root.clear();row.markings.clear();row.root.add(row.markings);
    const mesh=(left:number,right:number,height:(x:number,d:number)=>number,material:THREE.Material,columns=1,parent:THREE.Object3D=row.root)=>{
      const g=ribbon(index,left,right,height,columns);row.geometries.push(g);const m=new THREE.Mesh(g,material);m.receiveShadow=true;parent.add(m);return m;
    };
    mesh(-220,220,terrainHeight,terrain,110);
    if(environment==='coast'||environment==='mountain')mesh(-177,-20,()=>-1.15,water,24);
    row.deck=mesh(-1.8,5.4,()=>-.027,surface==='gravel'?gravel:asphalt);
    for(const x of [-1.55,5.15])mesh(x-.055,x+.055,()=>-.018,line,1,row.markings);
    for(let z=-21;z<24;z+=8)along(row.markings,[.12,.004,3],1.8,-.017,index*48+z,line);
    for(const x of [-2.7,6.3]) {
      for(let z=-23;z<24;z+=2)along(row.root,[.09,.25,2.02],x,.57,index*48+z,steel);
      for(let z=-22;z<24;z+=4){along(row.root,[.09,.77,.12],x,.32,index*48+z,steel);along(row.root,[.13,.12,.055],x,.71,index*48+z,reflector);}
    }
    const d=index*48, side=index%2?1:-1;
    // Deterministic roadside landmarks, placed on this same curved and graded route.
    if(index%3===0){along(row.root,[.09,2.5,.09],side*7,1.2,d,steel);along(row.root,[1.4,.66,.09],side*7,2.2,d,signMaterial);for(const x of [-.35,0,.35])along(row.root,[.11,.38,.10],side*7+x,2.2,d,reflector);}
    if(index%7===0){const x=side*23,y=terrainHeight(x,d);along(row.root,[5,3.6,4],x,y+1.8,d,timber);along(row.root,[5.6,.25,4.7],x,y+3.7,d,roofMaterial);for(const off of [-1.4,1.4])along(row.root,[.85,1.1,.05],x+off,y+2,d+2.03,signMaterial);}
    if(index%11===0){const x=-45,y=terrainHeight(x,d);along(row.root,[.45,19,.45],x,y+9.5,d,steel);const hub=along(row.root,[.65,.65,1.3],x,y+19,d,steel);for(let k=0;k<3;k++){const blade=box(hub,[.3,6.5,.12],[0,0,0],line);blade.position.set(Math.sin(k*2.094)*3.3,Math.cos(k*2.094)*3.3,.6);blade.rotation.z=-k*2.094;}}
    row.markings.visible=surface!=='gravel';row.index=index;
  }
  for(let slot=0;slot<ROAD_CHUNKS;slot++){const root=new THREE.Group();floor.add(root);segments.push({root,deck:new THREE.Mesh(),markings:new THREE.Group(),index:NaN,geometries:[]});}
  // Instancing keeps a long, varied roadside within a bounded GPU budget.
  const trunkG = new THREE.CylinderGeometry(.12, .23, 1, 7); geometry.add(trunkG);
  // Individual angled leaf cards create a porous canopy rather than smooth plastic blobs.
  const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=128;
  const leafContext=leafCanvas.getContext('2d')!;leafContext.fillStyle='#e2edbf';leafContext.beginPath();leafContext.moveTo(64,3);leafContext.bezierCurveTo(119,43,107,103,64,125);leafContext.bezierCurveTo(15,104,10,38,64,3);leafContext.fill();leafContext.strokeStyle='#9cb36b';leafContext.lineWidth=3;leafContext.beginPath();leafContext.moveTo(64,10);leafContext.lineTo(64,120);leafContext.stroke();
  const leafTexture=new THREE.CanvasTexture(leafCanvas);leafTexture.colorSpace=THREE.SRGBColorSpace;textures.add(leafTexture);leaves.map=leafTexture;leaves.alphaTest=.45;leaves.side=THREE.DoubleSide;leaves.roughness=1;
  const leafVertices:number[]=[],leafNormals:number[]=[],leafUvs:number[]=[],leafIndices:number[]=[];
  let leafSeed=681;const leafRandom=()=>{leafSeed=(Math.imul(leafSeed,1664525)+1013904223)>>>0;return leafSeed/4294967296;};
  for(let i=0;i<110;i++){
    const a=leafRandom()*Math.PI*2,h=leafRandom()*2-1,r=Math.cbrt(leafRandom()),center=new THREE.Vector3(Math.cos(a)*Math.sqrt(1-h*h),h,Math.sin(a)*Math.sqrt(1-h*h)).multiplyScalar(r);
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(leafRandom()*6,leafRandom()*6,leafRandom()*6)),size=.13+leafRandom()*.12,n=new THREE.Vector3(0,0,1).applyQuaternion(q);
    for(const [x,y,u,v] of [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]]){const p=new THREE.Vector3(x*size*.6,y*size,0).applyQuaternion(q).add(center);leafVertices.push(...p.toArray());leafNormals.push(...n.toArray());leafUvs.push(u,v);}
    const k=i*4;leafIndices.push(k,k+1,k+2,k,k+2,k+3);
  }
  const leafG=new THREE.BufferGeometry();leafG.setAttribute('position',new THREE.Float32BufferAttribute(leafVertices,3));leafG.setAttribute('normal',new THREE.Float32BufferAttribute(leafNormals,3));leafG.setAttribute('uv',new THREE.Float32BufferAttribute(leafUvs,2));leafG.setIndex(leafIndices);geometry.add(leafG);
  const rockG = new THREE.IcosahedronGeometry(1, 1); geometry.add(rockG);
  const trunks = new THREE.InstancedMesh(trunkG, bark, ROAD_CHUNKS * 12), crowns = new THREE.InstancedMesh(leafG, leaves, ROAD_CHUNKS * 12 * 9), rocks = new THREE.InstancedMesh(rockG, stone, ROAD_CHUNKS * 20), branches=new THREE.InstancedMesh(trunkG,bark,ROAD_CHUNKS*12*9);
  for (const o of [trunks, crowns, rocks,branches]) { floor.add(o); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  branches.name='roadside-branches';trunks.name = 'roadside-trunks'; crowns.name = 'roadside-foliage'; rocks.name = 'roadside-rocks';
  const dummy = new THREE.Object3D(); let lastDistance = NaN, lastEnvironment = '';
  function seedRandom(index: number) { let seed = (Math.imul(index + 8191, 1597334677) ^ 81571) >>> 0; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
  function instance(mesh: THREE.InstancedMesh, id: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, angle = 0) { dummy.position.copy(routePoint(z,x,y)); dummy.scale.set(sx, sy, sz); dummy.quaternion.copy(sampleDrivingRoute(z).rotation); dummy.rotateY(angle); dummy.updateMatrix(); mesh.setMatrixAt(id, dummy.matrix); }
  function update(time: number, speed: number) {
    const distance = travelDistance(time, speed);
    if (distance === lastDistance && environment === lastEnvironment) return;
    const frame=sampleDrivingRoute(distance), inverse=frame.rotation.clone().invert();
    floor.quaternion.copy(inverse);floor.position.copy(frame.position).negate().applyQuaternion(inverse);
    sky.quaternion.copy(inverse);sky.rotateY(environment==='coast'?.4:environment==='mountain'?.98:environment==='snow'?.47:.65);
    group.userData.distance=distance;group.userData.grade=frame.grade;group.userData.heading=Math.atan2(frame.tangent.x,frame.tangent.z);
    const regenerate=environment!==lastEnvironment;lastDistance = distance; lastEnvironment = environment;
    for (let slot = 0; slot < ROAD_CHUNKS; slot++) {
      const { index } = roadSegment(slot, distance,ROAD_CHUNKS,48,ROAD_CHUNKS/2); const row = segments[slot]; if(row.index===index&&!regenerate)continue;rebuild(slot,index);const z=index*48;
      const random = seedRandom(index);
      for (let j = 0; j < 12; j++) {
        const side = j % 2 ? 1 : -1, x = 1.8 + side * (9 + random() * (side<0&&(environment==='coast'||environment==='mountain')?5:48)), tz = z - 24 + random() * 48, h = 3.5 + random() * 4.5, y = terrainHeight(x,tz);
        const id = slot * 12 + j; instance(trunks, id, x, y + h / 2, tz, 1, h, 1);
        for (let k = 0; k < 9; k++) {
          const angle = k * 2.399, radius = k ? 1.1 + random() : 0;
          const conifer=(environment==='mountain'||environment==='snow')&&j%3!==0;
          const cx=x+Math.cos(angle)*radius*(conifer?.3:1),cy=y+h*(conifer?.55+k*.075:.8)+(conifer?0:(k%3)*.65),cz=tz+Math.sin(angle)*radius*(conifer?.3:1);
          const size=conifer?(2.7-k*.23):1.3+random();instance(crowns,id*9+k,cx,cy,cz,size,conifer?.9:.9+random(),size,angle);
          const from=routePoint(tz,x,y+h*.45),to=routePoint(cz,cx,cy),direction=to.clone().sub(from);
          dummy.position.copy(from).add(to).multiplyScalar(.5);dummy.scale.set(.25,direction.length(),.25);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());dummy.updateMatrix();branches.setMatrixAt(id*9+k,dummy.matrix);
        }
      }
      for (let j = 0; j < 20; j++) {
        const side = j % 2 ? 1 : -1, x = 1.8 + side * (4.9 + random() * 28), tz = z - 24 + random() * 48, r = .3 + random() * (environment === 'desert' ? 2.6 : 1.2);
        const y = terrainHeight(x,tz);
        instance(rocks, slot * 20 + j, x, y + r * .2, tz, r, r * .6, r * .8, random() * 6);
      }
    }
    for (const o of [trunks, crowns, rocks,branches]) o.instanceMatrix.needsUpdate = true;
    group.userData.distance = distance; group.userData.segment = Math.floor(distance / 48);
  }
  function setSurface(value: RoadSurface) { surface = value; asphalt.normalScale.setScalar(value === 'coarse' ? .85 : .18); asphalt.roughness = value === 'coarse' ? .98 : .82; for (const row of segments) { row.deck.material = value === 'gravel' ? gravel : asphalt; row.markings.visible = value !== 'gravel'; } }
  function setEnvironment(value: GalleryEnvironment, hdr: THREE.Texture | null, force=false) {
    if(!force&&environment===value&&borrowedSky===hdr)return;
    environment = value; borrowedSky = hdr; updateSky();
    const terrainMap = value === 'snow' || value === 'desert' ? null : terrainPhoto;
    if (terrain.map !== terrainMap) { terrain.map = terrainMap; terrain.needsUpdate = true; }
    const stoneMap = value === 'snow' ? null : rockPhoto;
    if (stone.map !== stoneMap) { stone.map = stoneMap; stone.needsUpdate = true; }
    stone.color.set(value === 'snow' ? '#e5edf0' : value === 'desert' ? '#c6a67f' : '#898777');
    terrain.color.set(({ coast: '#bfc59a', mountain: '#9cac7c', desert: '#b89d76', snow: '#e8f1f5' })[value]);
    leaves.color.set(value === 'snow' ? '#92a49b' : '#4d633c'); trunks.visible = crowns.visible = branches.visible = value !== 'desert';
  }
  update(0, 0);
  return { group, floor, ensureLoaded, update, setSurface, setEnvironment,
    get ready() { return loading && pending === 0 && !failed; }, get failed() { return failed; }, get surface() { return surface; },
    dispose() { disposed = true; group.removeFromParent(); segments.forEach(row=>row.geometries.forEach(g=>g.dispose())); geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); },
  };
}
