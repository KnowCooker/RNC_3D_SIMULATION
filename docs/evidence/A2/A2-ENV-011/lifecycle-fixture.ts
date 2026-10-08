import * as THREE from 'three';
import { createChampagneGallery } from '../../../../src/team-a/viewer/champagne-gallery';

const textureRows = new Map<string, { uuid: string; type: string; label: string; count: number; width: number; height: number; firstSeen: number; disposedAt: number[] }>();
const textureDisposer = THREE.Texture.prototype.dispose;
function track(texture: THREE.Texture, label = '') {
  let row = textureRows.get(texture.uuid);
  if (!row) { row = { uuid: texture.uuid, type: texture.constructor.name, label, count: 0, width: 0, height: 0, firstSeen: performance.now(), disposedAt: [] }; textureRows.set(texture.uuid, row); }
  if (label) row.label = label;
  const image = texture.image; if (image) { row.width = image.width ?? 0; row.height = image.height ?? 0; }
  return row;
}
THREE.Texture.prototype.dispose = function () { const row = track(this); row.count++; row.disposedAt.push(performance.now()); return textureDisposer.call(this); };
const originalLoad = THREE.TextureLoader.prototype.load;
let pendingImages = 0, totalLoadedImages = 0, lateStart = Infinity;
const imageLoads: { uuid: string; url: string; returnedAt: number; loadedAt: number }[] = [];
THREE.TextureLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  pendingImages++;
  const loaded = (texture: THREE.Texture) => {
    totalLoadedImages++; const row = imageLoads.find(row => row.uuid === texture.uuid)!; row.loadedAt = performance.now(); track(texture, url);
    try { onLoad?.(texture); } finally { pendingImages--; }
  };
  const texture = originalLoad.call(this, url, loaded, onProgress, error => { pendingImages--; onError?.(error); });
  track(texture, url); imageLoads.push({ uuid: texture.uuid, url, returnedAt: performance.now(), loadedAt: 0 }); return texture;
};

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(960, 600); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#d7e0dc');
scene.add(new THREE.HemisphereLight('#fff6e5', '#70807a', 2.2));
const sun = new THREE.DirectionalLight('#fff3df', 3); sun.position.set(-15, 20, 10); scene.add(sun);
const camera = new THREE.PerspectiveCamera(58, 960 / 600, .1, 1400); camera.position.set(16, 7, 17); camera.lookAt(0, 1, -25);
const checks: { name: string; pass: boolean; detail?: unknown }[] = [], samples: unknown[] = [];
function check(name: string, pass: boolean, detail?: unknown) { checks.push({ name, pass, detail }); if (!pass) throw new Error(`${name}: ${JSON.stringify(detail)}`); }
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean, label: string, timeout = 60000) { const deadline = performance.now() + timeout; while (!predicate()) { if (performance.now() > deadline) throw new Error(`Timeout: ${label}`); await wait(40); } }
function watchInstances(gallery: ReturnType<typeof createChampagneGallery>) {
  const records: { uuid: string; name: string; parent: string; count: number }[] = [];
  gallery.group.traverse(object => { if (object instanceof THREE.InstancedMesh) { const row = { uuid: object.uuid, name: object.name, parent: object.parent?.name ?? '', count: 0 }; records.push(row); object.addEventListener('dispose', () => row.count++); } }); return records;
}
function programState() { return (renderer.info.programs ?? []).map(program => ({ name: program.name, runnable: program.diagnostics?.runnable ?? null })); }
function textureLive(gallery: ReturnType<typeof createChampagneGallery>) {
  const sky = gallery.group.getObjectByName('landscape-panorama-360') as THREE.Mesh;
  const uniforms = (sky.material as THREE.ShaderMaterial).uniforms;
  for (const key of ['previous', 'next']) { const value = uniforms[key].value; if (value instanceof THREE.Texture) { const row = track(value, `sky-${key}`); if (row.count) throw new Error(`Disposed sky texture sampled: ${key}/${row.uuid}`); } }
  if (gallery.environmentTexture) { const row = track(gallery.environmentTexture, 'active-HDR'); if (row.count) throw new Error('Active HDR disposed'); }
}
async function frames(gallery: ReturnType<typeof createChampagneGallery>, count: number) {
  for (let i = 0; i < count; i++) { gallery.update(1 / 60); textureLive(gallery); scene.environment = gallery.environmentTexture; renderer.render(scene, camera); await new Promise(requestAnimationFrame); }
}

(window as any).runLifecycle = async () => {
  const gallery = createChampagneGallery(16); scene.add(gallery.group); const instances = watchInstances(gallery);
  check('14 real instanced meshes are present (4 scenery + 8 pavilion crowns + 2 platform)', instances.length === 14, instances);
  const names = ['gallery-shore-rocks', 'gallery-distant-crowns', 'gallery-distant-trunks', 'gallery-shore-grasses'];
  check('all four scenery instanced meshes present', names.every(name => instances.some(row => row.name === name)));
  let protectedTexture: THREE.Texture | null = null;
  gallery.protectBackground(texture => texture === protectedTexture);
  for (let round = 0; round < 2; round++) for (const environment of ['coast', 'mountain', 'desert', 'snow'] as const) {
    gallery.setEnvironment(environment);
    await until(() => gallery.group.userData.environmentReady === environment, `${round}/${environment} actual photo and HDR`);
    await frames(gallery, 90);
    check(`round ${round + 1} ${environment}: sky and HDR stayed alive through real frames`, true);
    check(`round ${round + 1} ${environment}: real programs compiled`, programState().every(program => program.runnable !== false), programState());
    if (!protectedTexture) protectedTexture = gallery.backgroundTexture;
    if (protectedTexture) check(`round ${round + 1} ${environment}: external background guard retains first photo`, track(protectedTexture).count === 0);
    samples.push({ round, environment, resolution: gallery.group.userData.panoramaResolution, memory: { ...renderer.info.memory }, programs: programState().length });
  }
  (window as any).lifecyclePreviewReady = true;
  await until(() => (window as any).lifecycleContinue === true, 'capture final real WebGL frame');
  const beforeDispose = performance.now(); gallery.dispose(); gallery.dispose(); scene.environment = null; renderer.render(scene, camera);
  check('all 14 instanced mesh dispose events fire exactly once after double dispose', instances.every(row => row.count === 1), instances);
  check('gallery detached from scene', gallery.group.parent === null);
  check('retained background photo released once on final disposal', protectedTexture !== null && track(protectedTexture).count === 1);
  check('all tracked textures are disposed no more than once', [...textureRows.values()].every(row => row.count <= 1));
  (window as any).lifecycleBaseline = { beforeDispose, instances, textureRows: [...textureRows.values()] };
  return { checks, samples, instances, textureRows: [...textureRows.values()], renderer: renderer.capabilities, programs: programState(), totalLoadedImages };
};

(window as any).runLateDispose = async () => {
  lateStart = performance.now(); const oldIds = new Set(textureRows.keys()), oldImageCount = totalLoadedImages;
  const lateGallery = createChampagneGallery(16), instances = watchInstances(lateGallery); scene.add(lateGallery.group);
  lateGallery.dispose(); lateGallery.dispose();
  await until(() => pendingImages === 0 && totalLoadedImages >= oldImageCount + 2, 'both delayed image callbacks after disposal');
  await until(() => [...textureRows.values()].some(row => !oldIds.has(row.uuid) && row.type === 'DataTexture' && row.width >= 1024 && row.count === 1), 'delayed HDR decode is disposed after gallery removal');
  const lateRows = [...textureRows.values()].filter(row => !oldIds.has(row.uuid));
  const lateImages = imageLoads.filter(row => row.returnedAt >= lateStart);
  check('both real delayed image responses finish after gallery disposal', lateImages.length === 2 && lateImages.every(row => row.loadedAt > lateStart + 500), lateImages);
  check('late image textures dispose exactly once', lateImages.every(image => textureRows.get(image.uuid)?.count === 1));
  check('late HDR DataTexture dispose exactly once', lateRows.some(row => row.type === 'DataTexture' && row.width >= 1024 && row.count === 1));
  check('second gallery instances also dispose exactly once', instances.length === 14 && instances.every(row => row.count === 1), instances);
  check('all late-created tracked textures dispose exactly once', lateRows.every(row => row.count === 1), lateRows);
  renderer.render(scene, camera);
  return { checks, lateRows, lateImages, instances, pendingImages, programs: programState() };
};
(window as any).fixtureReady = true;

let inspectionGallery: ReturnType<typeof createChampagneGallery> | null = null;
(window as any).preparePlatformCapture = async () => {
  inspectionGallery = createChampagneGallery(16); scene.add(inspectionGallery.group);
  await until(() => inspectionGallery?.group.userData.environmentReady === 'coast', 'platform photo/HDR');
  await frames(inspectionGallery, 90);
  // Deliberate isolated-platform evidence: retain real platform/shore/sky; hide
  // the pavilion roof, columns, benches and potted plants that occlude the rim.
  for (const child of inspectionGallery.group.children) child.visible = child === inspectionGallery.floor || child.name === 'scenic-terrain-360' || child.name === 'landscape-panorama-360';
  return { hiddenArchitectureForInspection: true, panorama: inspectionGallery.group.userData.panoramaResolution };
};
(window as any).setPlatformCaptureView = (view: 'whole' | 'stairs-east' | 'stairs-west') => {
  if (!inspectionGallery) throw new Error('preparePlatformCapture first');
  if (view === 'whole') { camera.position.set(0, 60, 4); camera.lookAt(0, -.1, 0); }
  else { const side = view === 'stairs-east' ? 1 : -1; camera.position.set(side * 36, 4.2, 7); camera.lookAt(side * 28.2, -.25, 0); }
  // The 60 m evidence camera lies beyond the product's 20 m orbit. Give its
  // isolated-platform shot appropriate depth precision for millimetre layers.
  camera.near = view === 'whole' ? 1 : .1; camera.updateProjectionMatrix();
  renderer.render(scene, camera); return { view, eye: camera.position.toArray() };
};
(window as any).finishPlatformCapture = () => { inspectionGallery?.dispose(); inspectionGallery = null; };
