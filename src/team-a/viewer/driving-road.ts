import * as THREE from 'three';
import type { RoadSurface } from './scene-stage';
import type { GalleryEnvironment } from './champagne-gallery';
import { roadSegment, travelDistance } from './driving-state';
import { routePoint, sampleDrivingRoute } from './driving-route';
import { createPanoramaSky } from './panorama-sky';
import { drivingGroundHeight, ROAD_WATER_LEVEL } from './landscape-height';

const ROAD_CHUNKS=20;
const asphaltUrl = new URL('./assets/asphalt_02_diff_4k.jpg', import.meta.url).href;
const asphaltNormalUrl = new URL('./assets/asphalt_02_nor_gl_2k.jpg', import.meta.url).href;
const gravelUrl = new URL('./assets/gravel_floor_diff_4k.jpg', import.meta.url).href;
const gravelNormalUrl = new URL('./assets/gravel_floor_nor_gl_2k.jpg', import.meta.url).href;
const terrainUrl = new URL('./assets/aerial_grass_rock_diff_2k.jpg', import.meta.url).href;

/** World-indexed roadside scenery. Vehicle/acoustic coordinates remain fixed; world moves by v*t. */
export function createDrivingRoad(anisotropy = 8) {
  const group = new THREE.Group(); group.name = 'procedural-driving-road';
  const floor = new THREE.Group(); group.add(floor);
  const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const mat = (color: string, roughness = .9, metalness = 0) => { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(m); return m; };
  const asphalt = mat('#515453'), gravel = mat('#988e77'), terrain = mat('#78825d'), bark = mat('#635443');
  const leaves = mat('#536344'), stone = mat('#898777'), line = mat('#f6f1d8'), steel = mat('#a4abad', .45, .65);
  const sky = createPanoramaSky('driving-photo-panorama'); sky.setHaze(.88); group.add(sky.mesh);
  const visualClock = { value: 0 };
  for (const material of [terrain, bark, leaves, stone]) {
    material.onBeforeCompile = shader => {
      shader.uniforms.sceneryClock = visualClock;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float sceneryBorn; varying float vSceneryBorn;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSceneryBorn=sceneryBorn;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float sceneryClock; varying float vSceneryBorn;').replace('#include <fog_fragment>', '#include <fog_fragment>\n#ifdef USE_FOG\ngl_FragColor.rgb=mix(fogColor,gl_FragColor.rgb,smoothstep(0.,.9,sceneryClock-vSceneryBorn));\n#endif');
    };
    material.customProgramCacheKey = () => 'scenery-age-fade-v1';
  }
  let disposed = false, loading = false, pending = 0, failed = false, surface: RoadSurface = 'smooth', environment: GalleryEnvironment = 'coast';
  let borrowedSky: THREE.Texture | null = null;
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
    load(terrainUrl, true, [1, 1], t => { terrainPhoto = t; terrain.bumpMap = t; terrain.bumpScale = .055; const rockMap=t.clone();rockMap.repeat.set(1,1);rockMap.needsUpdate=true;textures.add(rockMap);rockPhoto=rockMap;stone.bumpMap=rockMap;stone.bumpScale=.08;setEnvironment(environment,borrowedSky,true); });
  }
  function updateSky() { sky.set(borrowedSky, environment === 'coast' ? 1.7 : environment === 'mountain' ? .98 : environment === 'snow' ? .47 : .65); }
  const boxG = new THREE.BoxGeometry(1, 1, 1); geometry.add(boxG);
  function box(parent: THREE.Object3D, size: [number, number, number], xyz: [number, number, number], material: THREE.Material) {
    const m = new THREE.Mesh(boxG, material); m.scale.set(...size); m.position.set(...xyz); m.receiveShadow = true; parent.add(m); return m;
  }
  const terrainHeight = (x: number, d: number) => {
    const p = routePoint(d, x); return drivingGroundHeight(p.x, p.z, environment) - p.y;
  };
  const groundTiles: { mesh: THREE.Mesh; index: number }[] = [];
  function groundTile(index: number, retain = false) {
    const vertices: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = [], colors: number[] = [];
    const soil = new THREE.Color(environment==='desert'?'#c2a17c':environment==='snow'?'#ecf0ef':'#96a47d');
    const rock = new THREE.Color(environment==='snow'?'#99a5a6':'#929180');
    for(let r=0;r<=12;r++)for(let c=0;c<=160;c++){
      const x=-400+c*5,z=index*48-24+r*4,y=drivingGroundHeight(x,z,environment);
      const dx=(drivingGroundHeight(x+.5,z,environment)-drivingGroundHeight(x-.5,z,environment)), dz=(drivingGroundHeight(x,z+.5,environment)-drivingGroundHeight(x,z-.5,environment));
      const n=new THREE.Vector3(-dx,1,-dz).normalize();vertices.push(x,y,z);normals.push(...n.toArray());uv.push(x/12,z/12);
      const color=soil.clone().lerp(rock,THREE.MathUtils.smoothstep(Math.hypot(dx,dz),.25,.85));colors.push(color.r,color.g,color.b);
    }
    for(let r=0;r<12;r++)for(let c=0;c<160;c++){const a=r*161+c,b=a+161;indices.push(a,b,a+1,a+1,b,b+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('sceneryBorn',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3).fill(visualClock.value- (Number.isNaN(lastDistance)||retain?1:0)),1));g.setIndex(indices);return g;
  }
  terrain.vertexColors=true;
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
  const water=mat('#3b6467',.38,.25);
  const lakeGeometry=new THREE.PlaneGeometry(800,1100);lakeGeometry.rotateX(-Math.PI/2);geometry.add(lakeGeometry);
  const lake=new THREE.Mesh(lakeGeometry,water);lake.name='level-roadside-lake';floor.add(lake);
  for(let i=0;i<ROAD_CHUNKS;i++){const mesh=new THREE.Mesh(new THREE.BufferGeometry(),terrain);mesh.name='cartesian-ground-tile';mesh.receiveShadow=true;floor.add(mesh);groundTiles.push({mesh,index:NaN});}
  const timber=mat('#78604a'), roofMaterial=mat('#46535c',.7), signMaterial=mat('#234f49',.55), reflector=mat('#f6c86a',.5);
  function along(parent:THREE.Object3D,size:[number,number,number],x:number,y:number,d:number,material:THREE.Material) {
    const o=box(parent,size,[0,0,0],material), frame=sampleDrivingRoute(d);o.position.copy(routePoint(d,x,y));o.quaternion.copy(frame.rotation);return o;
  }
  function rebuild(slot:number,index:number) {
    const row=segments[slot];row.geometries.forEach(g=>g.dispose());row.geometries=[];row.root.clear();row.markings.clear();row.root.add(row.markings);
    const mesh=(left:number,right:number,height:(x:number,d:number)=>number,material:THREE.Material,columns=1,parent:THREE.Object3D=row.root)=>{
      const g=ribbon(index,left,right,height,columns);row.geometries.push(g);const m=new THREE.Mesh(g,material);m.receiveShadow=true;parent.add(m);return m;
    };

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
    if(index%7===0){const x=side*23,y=terrainHeight(x,d);if(routePoint(d,x,y).y>ROAD_WATER_LEVEL+.5){along(row.root,[5,3.6,4],x,y+1.8,d,timber);along(row.root,[5.6,.25,4.7],x,y+3.7,d,roofMaterial);for(const off of [-1.4,1.4])along(row.root,[.85,1.1,.05],x+off,y+2,d+2.03,signMaterial);}}
    if(index%11===0){const x=45,y=terrainHeight(x,d);along(row.root,[.45,19,.45],x,y+9.5,d,steel);const hub=along(row.root,[.65,.65,1.3],x,y+19,d,steel);for(let k=0;k<3;k++){const blade=box(hub,[.3,6.5,.12],[0,0,0],line);blade.position.set(Math.sin(k*2.094)*3.3,Math.cos(k*2.094)*3.3,.6);blade.rotation.z=-k*2.094;}}
    row.markings.visible=surface!=='gravel';row.index=index;
  }
  for(let slot=0;slot<ROAD_CHUNKS;slot++){const root=new THREE.Group();floor.add(root);segments.push({root,deck:new THREE.Mesh(),markings:new THREE.Group(),index:NaN,geometries:[]});}
  // Instancing keeps a long, varied roadside within a bounded GPU budget.
  const trunkG = new THREE.CylinderGeometry(.12, .23, 1, 7); geometry.add(trunkG);
  // Individual angled leaf cards create a porous canopy rather than smooth plastic blobs.
  const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=128;
  const leafContext=leafCanvas.getContext('2d')!;leafContext.fillStyle='#e2edbf';leafContext.beginPath();leafContext.moveTo(64,3);leafContext.bezierCurveTo(119,43,107,103,64,125);leafContext.bezierCurveTo(15,104,10,38,64,3);leafContext.fill();leafContext.strokeStyle='#9cb36b';leafContext.lineWidth=3;leafContext.beginPath();leafContext.moveTo(64,10);leafContext.lineTo(64,120);leafContext.stroke();
  const leafTexture=new THREE.CanvasTexture(leafCanvas);leafTexture.colorSpace=THREE.SRGBColorSpace;textures.add(leafTexture);leaves.map=leafTexture;leaves.alphaTest=.45;leaves.alphaToCoverage=true;leaves.side=THREE.DoubleSide;leaves.roughness=1;
  const leafVertices:number[]=[],leafNormals:number[]=[],leafUvs:number[]=[],leafIndices:number[]=[];
  let leafSeed=681;const leafRandom=()=>{leafSeed=(Math.imul(leafSeed,1664525)+1013904223)>>>0;return leafSeed/4294967296;};
  for(let i=0;i<110;i++){
    const a=leafRandom()*Math.PI*2,h=leafRandom()*2-1,r=Math.cbrt(leafRandom()),center=new THREE.Vector3(Math.cos(a)*Math.sqrt(1-h*h),h,Math.sin(a)*Math.sqrt(1-h*h)).multiplyScalar(r);
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(leafRandom()*6,leafRandom()*6,leafRandom()*6)),size=.075+leafRandom()*.095,n=new THREE.Vector3(0,0,1).applyQuaternion(q);
    for(const [x,y,u,v] of [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]]){const p=new THREE.Vector3(x*size*.6,y*size,0).applyQuaternion(q).add(center);leafVertices.push(...p.toArray());leafNormals.push(...n.toArray());leafUvs.push(u,v);}
    const k=i*4;leafIndices.push(k,k+1,k+2,k,k+2,k+3);
  }
  const leafG=new THREE.BufferGeometry();leafG.setAttribute('position',new THREE.Float32BufferAttribute(leafVertices,3));leafG.setAttribute('normal',new THREE.Float32BufferAttribute(leafNormals,3));leafG.setAttribute('uv',new THREE.Float32BufferAttribute(leafUvs,2));leafG.setIndex(leafIndices);geometry.add(leafG);
  for(const g of [trunkG,leafG])g.setAttribute('sceneryBorn',new THREE.InstancedBufferAttribute(new Float32Array(ROAD_CHUNKS*12*9).fill(-1),1));
  const rockG = new THREE.IcosahedronGeometry(1, 1); geometry.add(rockG);rockG.setAttribute('sceneryBorn',new THREE.InstancedBufferAttribute(new Float32Array(ROAD_CHUNKS*20).fill(-1),1));
  const trunks = new THREE.InstancedMesh(trunkG, bark, ROAD_CHUNKS * 12), crowns = new THREE.InstancedMesh(leafG, leaves, ROAD_CHUNKS * 12 * 9), rocks = new THREE.InstancedMesh(rockG, stone, ROAD_CHUNKS * 20), branches=new THREE.InstancedMesh(trunkG,bark,ROAD_CHUNKS*12*9);
  for (const o of [trunks, crowns, rocks,branches]) { floor.add(o); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  branches.geometry=trunkG.clone();geometry.add(branches.geometry);branches.name='roadside-branches';trunks.name = 'roadside-trunks'; crowns.name = 'roadside-foliage'; rocks.name = 'roadside-rocks';
  const dummy = new THREE.Object3D(); let lastDistance = NaN, lastEnvironment = '';
  function seedRandom(index: number) { let seed = (Math.imul(index + 8191, 1597334677) ^ 81571) >>> 0; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
  function instance(mesh: THREE.InstancedMesh, id: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, angle = 0) { dummy.position.copy(routePoint(z,x,y)); dummy.scale.set(sx, sy, sz); dummy.quaternion.copy(sampleDrivingRoute(z).rotation); dummy.rotateY(angle); dummy.updateMatrix(); mesh.setMatrixAt(id, dummy.matrix); }
  function update(time: number, speed: number, dt = 1 / 60) {
    visualClock.value += Math.min(.05,Math.max(0,dt));
    const distance = travelDistance(time, speed);
    const frame=sampleDrivingRoute(distance), inverse=frame.rotation.clone().invert();
    sky.update(dt,inverse);
    if (distance === lastDistance && environment === lastEnvironment) return;
    floor.quaternion.copy(inverse);floor.position.copy(frame.position).negate().applyQuaternion(inverse);
    lake.position.set(0,ROAD_WATER_LEVEL,frame.position.z);lake.visible=environment==='coast'||environment==='mountain';
    group.userData.distance=distance;group.userData.grade=frame.grade;group.userData.heading=Math.atan2(frame.tangent.x,frame.tangent.z);
    const regenerate=environment!==lastEnvironment, initial=Number.isNaN(lastDistance);
    for(let slot=0;slot<ROAD_CHUNKS;slot++){const tile=groundTiles[slot],{index}=roadSegment(slot,frame.position.z,ROAD_CHUNKS,48,ROAD_CHUNKS/2);if(tile.index!==index||regenerate){tile.mesh.geometry.dispose();tile.mesh.geometry=groundTile(index,regenerate);tile.index=index;}}
    lastDistance = distance; lastEnvironment = environment;
    let instancesChanged = false;
    for (let slot = 0; slot < ROAD_CHUNKS; slot++) {
      const { index } = roadSegment(slot, distance,ROAD_CHUNKS,48,ROAD_CHUNKS/2); const row = segments[slot]; if(row.index===index&&!regenerate)continue;rebuild(slot,index);const z=index*48;
      for(const mesh of [trunks,crowns,rocks,branches]){const attr=mesh.geometry.getAttribute('sceneryBorn') as THREE.InstancedBufferAttribute;const per=mesh===rocks?20:mesh===trunks?12:108;for(let n=slot*per;n<(slot+1)*per;n++)attr.setX(n,initial||regenerate?visualClock.value-1:visualClock.value);attr.needsUpdate=true;}
      instancesChanged = true;
      const random = seedRandom(index);
      for (let j = 0; j < 12; j++) {
        // Keep the entire crown outside the exterior camera's 19 m orbit envelope.
        const side = j % 2 ? 1 : -1, x = 1.8 + side * (28 + random() * (side<0&&(environment==='coast'||environment==='mountain')?5:36)), tz = z - 24 + random() * 48, h = 3.5 + random() * 4.5, y = terrainHeight(x,tz);
        const id = slot * 12 + j, dry=routePoint(tz,x,y).y>ROAD_WATER_LEVEL+.7; instance(trunks, id, x, y + h / 2, tz, dry?1:0, dry?h:0, dry?1:0);
        for (let k = 0; k < 9; k++) {
          const angle = k * 2.399, radius = k ? 1.1 + random() : 0;
          const conifer=(environment==='mountain'||environment==='snow')&&j%3!==0;
          const cx=x+Math.cos(angle)*radius*(conifer?.3:1),cy=y+h*(conifer?.55+k*.075:.8)+(conifer?0:(k%3)*.65),cz=tz+Math.sin(angle)*radius*(conifer?.3:1);
          const size=dry?(conifer?(2.7-k*.23):1.3+random()):0;instance(crowns,id*9+k,cx,cy,cz,size,conifer?.9:.9+random(),size,angle);
          const from=routePoint(tz,x,y+h*.45),to=routePoint(cz,cx,cy),direction=to.clone().sub(from);
          dummy.position.copy(from).add(to).multiplyScalar(.5);dummy.scale.set(dry?.25:0,dry?direction.length():0,dry?.25:0);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());dummy.updateMatrix();branches.setMatrixAt(id*9+k,dummy.matrix);
        }
      }
      for (let j = 0; j < 20; j++) {
        const side = j % 2 ? 1 : -1, x = 1.8 + side * (4.9 + random() * 28), tz = z - 24 + random() * 48, r = .3 + random() * (environment === 'desert' ? 2.6 : 1.2);
        const y = terrainHeight(x,tz);
        instance(rocks, slot * 20 + j, x, y + r * .2, tz, r, r * .6, r * .8, random() * 6);
      }
    }
    if (instancesChanged) for (const o of [trunks, crowns, rocks,branches]) o.instanceMatrix.needsUpdate = true;
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
    terrain.color.set('#ffffff');
    leaves.color.set(value === 'snow' ? '#92a49b' : '#4d633c'); trunks.visible = crowns.visible = branches.visible = value !== 'desert';
  }
  // Radial fog matches the recycling guard at every camera azimuth, including image edges.
  for (const material of materials) {
    const prior = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prior.call(material, shader, renderer);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSceneryDistance;').replace('#include <project_vertex>', '#include <project_vertex>\nvSceneryDistance=length(mvPosition.xyz);');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSceneryDistance;').replace('#include <fog_fragment>', '#ifdef USE_FOG\ngl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,smoothstep(fogNear,fogFar,vSceneryDistance));\n#endif');
    };
    material.customProgramCacheKey = () => `radial-scenery-fog-${[terrain,bark,leaves,stone].includes(material as THREE.MeshStandardMaterial)?'age':'plain'}-v1`;
  }
  update(0, 0);
  return { group, floor, ensureLoaded, update, setSurface, setEnvironment,
    usesBackground: sky.uses,
    get ready() { return loading && pending === 0 && !failed; }, get failed() { return failed; }, get surface() { return surface; },
    dispose() { disposed = true; sky.dispose(); groundTiles.forEach(t=>t.mesh.geometry.dispose()); group.removeFromParent(); segments.forEach(row=>row.geometries.forEach(g=>g.dispose())); geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); },
  };
}
