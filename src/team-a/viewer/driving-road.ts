import * as THREE from 'three';
import type { RoadSurface } from './scene-stage';
import type { GalleryEnvironment } from './champagne-gallery';
import { roadSegment, travelDistance } from './driving-state';

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
    load(terrainUrl, true, [88, 9.6], t => { terrainPhoto = t; terrain.bumpMap = t; terrain.bumpScale = .055; const rockMap=t.clone();rockMap.repeat.set(1,1);rockMap.needsUpdate=true;textures.add(rockMap);rockPhoto=rockMap;stone.bumpMap=rockMap;stone.bumpScale=.08;setEnvironment(environment,borrowedSky); });
  }
  function updateSky() { const t = environment === 'coast' ? skyPhoto : borrowedSky; if (basic.map !== t) { basic.map = t; basic.color.set(t ? '#ffffff' : '#b6cbd6'); basic.needsUpdate = true; } sky.rotation.y = environment === 'coast' ? .4 : environment === 'mountain' ? .98 : environment === 'snow' ? .47 : .65; }
  const boxG = new THREE.BoxGeometry(1, 1, 1); geometry.add(boxG);
  function box(parent: THREE.Object3D, size: [number, number, number], xyz: [number, number, number], material: THREE.Material) {
    const m = new THREE.Mesh(boxG, material); m.scale.set(...size); m.position.set(...xyz); m.receiveShadow = true; parent.add(m); return m;
  }
  const roadG = new THREE.PlaneGeometry(7.2, 48); geometry.add(roadG);
  const groundG = new THREE.PlaneGeometry(440, 48, 64, 8); groundG.rotateX(-Math.PI / 2);
  const position = groundG.getAttribute('position');
  for (let i = 0; i < position.count; i++) { const x = position.getX(i); const side = Math.max(0, Math.abs(x - 1.8) - 7); position.setY(i, -.065 + Math.min(14, side * .07) * (.8 + .2 * Math.cos(x * .04))); }
  groundG.computeVertexNormals(); geometry.add(groundG);
  const segments: { root: THREE.Group; deck: THREE.Mesh; markings: THREE.Group; index: number }[] = [];
  for (let slot = 0; slot < 12; slot++) {
    const root = new THREE.Group(); floor.add(root);
    const ground = new THREE.Mesh(groundG, terrain); ground.receiveShadow = true; root.add(ground);
    const deck = new THREE.Mesh(roadG, asphalt); deck.rotation.x = -Math.PI / 2; deck.position.set(1.8, -.027, 0); deck.receiveShadow = true; root.add(deck);
    const markings = new THREE.Group(); root.add(markings);
    for (const x of [-1.55, 5.15]) box(markings, [.11, .004, 48], [x, -.018, 0], line);
    for (let z = -21; z < 24; z += 8) box(markings, [.12, .004, 3], [1.8, -.017, z], line);
    for (const x of [-2.7, 6.3]) {
      box(root, [.09, .25, 48], [x, .57, 0], steel);
      for (let z = -22; z < 24; z += 4) box(root, [.09, .77, .12], [x, .32, z], steel);
    }
    segments.push({ root, deck, markings, index: NaN });
  }
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
  const trunks = new THREE.InstancedMesh(trunkG, bark, 144), crowns = new THREE.InstancedMesh(leafG, leaves, 144 * 9), rocks = new THREE.InstancedMesh(rockG, stone, 240);
  for (const o of [trunks, crowns, rocks]) { group.add(o); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  trunks.name = 'roadside-trunks'; crowns.name = 'roadside-foliage'; rocks.name = 'roadside-rocks';
  const dummy = new THREE.Object3D(); let lastDistance = NaN, lastEnvironment = '';
  function seedRandom(index: number) { let seed = (Math.imul(index + 8191, 1597334677) ^ 81571) >>> 0; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
  function instance(mesh: THREE.InstancedMesh, id: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, angle = 0) { dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, angle, 0); dummy.updateMatrix(); mesh.setMatrixAt(id, dummy.matrix); }
  function update(time: number, speed: number) {
    const distance = travelDistance(time, speed);
    if (distance === lastDistance && environment === lastEnvironment) return;
    lastDistance = distance; lastEnvironment = environment;
    for (let slot = 0; slot < 12; slot++) {
      const { index, z } = roadSegment(slot, distance); const row = segments[slot]; row.root.position.z = z; row.index = index;
      const random = seedRandom(index);
      for (let j = 0; j < 12; j++) {
        const side = j % 2 ? 1 : -1, x = 1.8 + side * (9 + random() * 32), tz = z - 24 + random() * 48, h = 3.5 + random() * 4.5, y = Math.min(14, Math.max(0, Math.abs(x - 1.8) - 7) * .07);
        const id = slot * 12 + j; instance(trunks, id, x, y + h / 2, tz, 1, h, 1);
        for (let k = 0; k < 9; k++) {
          const angle = k * 2.399, radius = k ? 1.1 + random() : 0;
          instance(crowns, id * 9 + k, x + Math.cos(angle) * radius, y + h + (k % 3) * .65, tz + Math.sin(angle) * radius, 1.3 + random(), .9 + random(), 1.3 + random(), angle);
        }
      }
      for (let j = 0; j < 20; j++) {
        const side = j % 2 ? 1 : -1, x = 1.8 + side * (4.9 + random() * 28), tz = z - 24 + random() * 48, r = .3 + random() * (environment === 'desert' ? 2.6 : 1.2);
        const y = Math.min(14, Math.max(0, Math.abs(x - 1.8) - 7) * .07);
        instance(rocks, slot * 20 + j, x, y + r * .2, tz, r, r * .6, r * .8, random() * 6);
      }
    }
    for (const o of [trunks, crowns, rocks]) o.instanceMatrix.needsUpdate = true;
    group.userData.distance = distance; group.userData.segment = Math.floor(distance / 48);
  }
  function setSurface(value: RoadSurface) { surface = value; asphalt.normalScale.setScalar(value === 'coarse' ? .85 : .18); asphalt.roughness = value === 'coarse' ? .98 : .82; for (const row of segments) { row.deck.material = value === 'gravel' ? gravel : asphalt; row.markings.visible = value !== 'gravel'; } }
  function setEnvironment(value: GalleryEnvironment, hdr: THREE.Texture | null) {
    environment = value; borrowedSky = hdr; updateSky();
    const terrainMap = value === 'snow' || value === 'desert' ? null : terrainPhoto;
    if (terrain.map !== terrainMap) { terrain.map = terrainMap; terrain.needsUpdate = true; }
    const stoneMap = value === 'snow' ? null : rockPhoto;
    if (stone.map !== stoneMap) { stone.map = stoneMap; stone.needsUpdate = true; }
    stone.color.set(value === 'snow' ? '#e5edf0' : value === 'desert' ? '#c6a67f' : '#898777');
    terrain.color.set(({ coast: '#bfc59a', mountain: '#9cac7c', desert: '#b89d76', snow: '#e8f1f5' })[value]);
    leaves.color.set(value === 'snow' ? '#92a49b' : '#4d633c'); trunks.visible = crowns.visible = value !== 'desert';
  }
  update(0, 0);
  return { group, floor, ensureLoaded, update, setSurface, setEnvironment,
    get ready() { return loading && pending === 0 && !failed; }, get failed() { return failed; }, get surface() { return surface; },
    dispose() { disposed = true; group.removeFromParent(); geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); },
  };
}
