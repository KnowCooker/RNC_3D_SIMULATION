import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export type GalleryEnvironment = 'coast' | 'mountain' | 'desert' | 'snow';
/** Authored geometry and procedural materials. Scenery never changes acoustic config. */
export function createChampagneGallery() {
  let disposed = false, panorama: THREE.DataTexture | null = null;
  const group = new THREE.Group(); group.name = 'champagne-lakeside-gallery';
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const material = (color: string, roughness = .7, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(m); return m;
  };
  const stone = material('#d4c9b7', .32), bronze = material('#9f825b', .3, .65);
  const darkStone = material('#b4a48c'), foliage = material('#6e7452'), trunk = material('#72604a');
  function mesh(g: THREE.BufferGeometry, m: THREE.Material, xyz: [number, number, number], parent = group) {
    geometries.add(g); const o = new THREE.Mesh(g, m); o.position.set(...xyz); parent.add(o); o.receiveShadow = true; return o;
  }
  const box = (size: [number, number, number], xyz: [number, number, number], m: THREE.Material, parent = group) => mesh(new THREE.BoxGeometry(...size), m, xyz, parent);
  const floor = new THREE.Group(); group.add(floor);
  box([38, .16, 32], [0, -.14, 0], stone, floor);
  const mirrorGeometry = new THREE.PlaneGeometry(37.9, 31.9); geometries.add(mirrorGeometry);
  const mirror = new Reflector(mirrorGeometry, { textureWidth: 1536, textureHeight: 1024, color: 0xb6a994, clipBias: .003 });
  mirror.rotation.x = -Math.PI / 2; mirror.position.y = -.052; mirror.name = 'gallery-reflection'; floor.add(mirror);
  // Muted reflection under a translucent stone surface; actual 3D reflection, no baked car.
  const glaze = new THREE.MeshStandardMaterial({ color: '#b4a18a', roughness: .3, transparent: true, opacity: .82, depthWrite: false }); materials.add(glaze);
  glaze.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStonePosition;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvStonePosition=position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vStonePosition;').replace('#include <color_fragment>', `#include <color_fragment>
      float vein=sin(vStonePosition.x*.48+vStonePosition.y*.71+sin(vStonePosition.x*1.7+vStonePosition.y*.42)*.7);
      float fine=sin(vStonePosition.x*21.+vStonePosition.y*13.)*sin(vStonePosition.y*29.);
      diffuseColor.rgb*=.94+.055*vein+.012*fine;`);
  };
  const top = mesh(new THREE.PlaneGeometry(38, 32), glaze, [0, -.048, 0], floor); top.rotation.x = -Math.PI / 2;
  const seam = material('#b4a790', .6);
  for (let i = -18; i <= 18; i += 3) box([.008, .001, 32], [i, -.045, 0], seam, floor);
  for (let i = -15; i <= 15; i += 3) box([38, .001, .008], [0, -.045, i], seam, floor);
  // Open pavilion: columns sit beyond the orbit envelope, with a floating curved roof.
  for (const x of [-13, 13]) for (const z of [-9, 9]) {
    mesh(new THREE.CylinderGeometry(.045, .055, 5.5, 24), bronze, [x, 2.72, z]);
  }
  const roof = mesh(new THREE.CylinderGeometry(22, 22, .22, 96), stone, [0, 5.6, -10]); roof.scale.z = .68;
  const trim = mesh(new THREE.TorusGeometry(21.85, .025, 5, 96), material('#ffe5bb', .4), [0, 5.47, -10]); trim.rotation.x = Math.PI / 2; trim.scale.y = .68;
  for (const x of [-12, 12]) {
    box([2.4, .42, .8], [x, .2, -5], darkStone);
    box([2.25, .12, .76], [x, .46, -5], material('#ede3d2'));
  }
  const waterMat = material('#c5b6a2', .23, .35);
  const water = mesh(new THREE.CylinderGeometry(85, 85, .08, 96), waterMat, [0, -.32, 0]);
  const hills = new THREE.Group(); group.add(hills);
  const terrainMat = material('#8d8981');
  const snowMat = material('#e6e4df');
  let seed = 20931;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let ring = 0; ring < 2; ring++) {
    const positions: number[] = [], indices: number[] = [], segments = 180;
    const heights = Array.from({ length: segments + 1 }, (_, i) => 4 + 3 * Math.sin(i * .22 + ring) ** 2 + random() * 2);
    heights[segments] = heights[0];
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2, radius = 44 + ring * 19;
      positions.push(Math.cos(a) * radius, -.6, Math.sin(a) * radius);
      positions.push(Math.cos(a) * (radius + 7), heights[i] + ring * 2, Math.sin(a) * (radius + 7));
      positions.push(Math.cos(a) * (radius + 18), -.7, Math.sin(a) * (radius + 18));
      if (i < segments) { const n = i * 3; indices.push(n, n + 3, n + 1, n + 1, n + 3, n + 4, n + 1, n + 4, n + 2, n + 2, n + 4, n + 5); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals();
    const ridge = mesh(g, ring ? material('#bab0a3') : terrainMat, [0, 0, 0], hills); ridge.material.side = THREE.DoubleSide;
  }
  const plants = new THREE.Group(); group.add(plants);
  for (const [x, z, scale] of [[-14, 6, 1.2], [8, -13, 1.3], [-18, 10, 1.2], [18, 8, .9]]) {
    const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(scale); plants.add(tree);
    mesh(new THREE.CylinderGeometry(.7, .55, .65, 24), stone, [0, .25, 0], tree);
    mesh(new THREE.CylinderGeometry(.06, .13, 3.4, 9), trunk, [0, 1.9, 0], tree);
    const leafGeometry = new THREE.SphereGeometry(1, 5, 3); geometries.add(leafGeometry);
    const leaves = new THREE.InstancedMesh(leafGeometry, foliage, 950), placement = new THREE.Object3D();
    for (let j = 0; j < leaves.count; j++) {
      const a = random() * Math.PI * 2, radius = Math.sqrt(random()) * 1.4, elevation = random() * Math.PI;
      placement.position.set(Math.cos(a) * radius * Math.sin(elevation), 3.2 + Math.cos(elevation) * .85, Math.sin(a) * radius * Math.sin(elevation));
      placement.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      placement.scale.set(.08 + random() * .06, .018, .035 + random() * .03); placement.updateMatrix(); leaves.setMatrixAt(j,placement.matrix);
    }
    leaves.castShadow = true; leaves.instanceMatrix.needsUpdate = true; tree.add(leaves);
  }
  const skyMaterial = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { zenith: { value: new THREE.Color('#a6b6c3') }, horizon: { value: new THREE.Color('#efd5b1') }, sunset: { value: new THREE.Color('#ffdab0') } },
    vertexShader: 'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vDirection; uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunset;
      void main(){vec3 d=normalize(vDirection);float h=clamp(d.y*1.6,0.,1.);vec3 c=mix(horizon,zenith,pow(h,.65));
      float sun=dot(d,normalize(vec3(-.7,.15,-.65)));c=mix(c,sunset,pow(max(0.,sun),12.)*.65);c+=vec3(1.,.78,.45)*smoothstep(.9991,.99975,sun)*1.8;
      float clouds=sin(d.x*28.+sin(d.z*19.)*2.)*sin(d.z*32.+d.y*26.);c+=smoothstep(.25,.85,clouds)*.05*smoothstep(.03,.15,d.y);gl_FragColor=vec4(c,1.);}` });
  materials.add(skyMaterial); const sky = mesh(new THREE.SphereGeometry(90, 48, 24), skyMaterial, [0, 0, 0]);
  const photoMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false }); materials.add(photoMaterial);
  new RGBELoader().load(new URL('./assets/qwantani_sunset_4k.hdr', import.meta.url).href, texture => {
    if (disposed) { texture.dispose(); return; }
    // Local 4K HDR preserves distant detail without a runtime CDN.
    panorama = texture; panorama.mapping = THREE.EquirectangularReflectionMapping;
    photoMaterial.map = panorama; photoMaterial.needsUpdate = true; setEnvironment(environment);
  }, undefined, () => { group.userData.panoramaFailed = true; });
  let environment: GalleryEnvironment = 'coast';
  function setEnvironment(value: GalleryEnvironment) {
    environment = value; group.userData.environment = value;
    const photo = value === 'coast' && !!panorama;
    water.visible = !photo;
    sky.material = photo ? photoMaterial : skyMaterial; sky.rotation.y = photo ? 1.7 : 0;
    hills.visible = !photo;
    const palette = { coast: ['#c5b6a2', '#8d8981', '#a6b6c3', '#efd5b1'], mountain: ['#8da8a4', '#687c70', '#a9c1c9', '#e8ddc4'], desert: ['#d6b285', '#bd9364', '#b6c1c8', '#f1d2a4'], snow: ['#b9c9cf', '#bbc3c7', '#8faec3', '#e5e6df'] }[value];
    waterMat.color.set(palette[0]); terrainMat.color.set(palette[1]);
    skyMaterial.uniforms.zenith.value.set(palette[2]); skyMaterial.uniforms.horizon.value.set(palette[3]);
    hills.scale.y = value === 'desert' ? .42 : value === 'mountain' || value === 'snow' ? 1.6 : 1;
    foliage.color.set(value === 'snow' ? snowMat.color : value === 'desert' ? '#a89562' : '#6e7452');
    plants.visible = value !== 'desert';
  }
  return { group, floor, get environmentTexture() { return panorama; }, get environment() { return environment; }, setEnvironment,
    dispose() { disposed = true; group.removeFromParent(); mirror.dispose(); panorama?.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
}
