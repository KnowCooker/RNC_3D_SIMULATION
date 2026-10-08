import * as THREE from 'three';
import { createRenderMeter } from './render-meter';
import { createPassengerCabin, type PassengerAssignments } from './passenger-cabin';
import { createPassengerAssetLibrary } from './passenger-assets';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createVehicleModel, type VehiclePart } from './vehicle-model';
import type { ShowroomModel } from './showroom-model';
import { xpengCatalog, getXPengSpec, type XPengId } from './xpeng-catalog';
import type { AssetBodyMode, AssetSectionAxis } from './asset-inspection';
import { createSectionDisplay } from './section-display';
import { createSceneStage, type RoadSurface, type StageMode } from './scene-stage';
import type { GalleryEnvironment } from './champagne-gallery';
import { labLayout, P7_LAYOUT_ID, registeredVehicleLayout, type FieldFrame, type LabConfig, type LabSelection, type Vec3 } from '../../shared/lab-contracts';
import { placeLabLabels, type LabelObstacle } from './labels';
import { describeVehiclePart, featuredVehicleParts } from './part-guide';
import { createFieldPoints, createFieldPointsForSlice, fieldFrameMatchesPoints, type SliceAxis } from './field-slices';
import { DENSE_FIELD_GRID } from './field-grid';
import { createFieldDisplay } from './field-display';
import { createFieldOcclusion } from './field-occlusion';
import { fieldValues, improvementFieldRange, pairedFieldRange, pressureColors, reductionColors, type FieldQuantity } from './field-display-data';
import { createCameraMotion } from './camera-motion';
import { createDrivingView } from './driving-view';
import { createWheelMotion } from './wheel-motion';
import { sampleDrivingRoute } from './driving-route';
import { travelDistance } from './driving-state';
import { constrainEnvironmentCamera } from './environment-camera';
import './viewer.css';

export function createLabViewer(host: HTMLElement, callbacks: {
  select(selection: LabSelection): void;
  add(position: Vec3, mountPart?: string): void;
  context(selection: LabSelection, x: number, y: number): void;
  /** A1 may connect visual road presets to the lab configuration and invalidate the previous run. */
  roadPreset?(surface: RoadSurface, roughness: number): void;
}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#101a25');
  const passengerAssets = createPassengerAssetLibrary();
  const passengers = createPassengerCabin({ loadDetailed: (id, driver) => passengerAssets.load(id, driver), onChange: () => host.dispatchEvent(new CustomEvent('passenger-quality-change')) }); let passengerFocus = false;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.08, 1200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.info.autoReset=false;
  const recordRender=createRenderMeter(host);
  renderer.setPixelRatio(1); renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; host.append(renderer.domElement);
  const leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leaders.classList.add('lab-marker-leaders'); leaders.setAttribute('aria-hidden', 'true'); host.append(leaders);
  let labelObstacles: LabelObstacle[] = [], obstaclesAt = -Infinity, obstaclePage = '';
  function readLabelObstacles(now: number) {
    const page = `${host.dataset.presentationPage}/${host.clientWidth}/${host.clientHeight}`;
    if (page === obstaclePage && now - obstaclesAt < 200) return labelObstacles;
    obstaclesAt = now; obstaclePage = page;
    const root = host.closest('.cp-app') ?? host;
    const box = host.getBoundingClientRect();
    labelObstacles = [...root.querySelectorAll<HTMLElement>('.cp-structure-tools,.cp-field-panel,.cp-bottom-bar,.cp-mode-rail,.cp-asset,.cp-work-title,.lab-assembly-panel,.lab-showroom-panel,.lab-part-card,.lab-part-picker,.lab-path-focus-note')]
      .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
      .map(element => { const r = element.getBoundingClientRect(); return { x: r.left-box.left, y: r.top-box.top, width: r.width, height: r.height }; })
      .filter(r => r.width > 0 && r.height > 0 && r.x < box.width && r.y < box.height && r.x+r.width > 0 && r.y+r.height > 0);
    return labelObstacles;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  const environmentRoom = new RoomEnvironment(), environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environment = environmentGenerator.fromScene(environmentRoom, 0.04);
  scene.environment = environment.texture; scene.environmentIntensity = 0.7;
  environmentRoom.dispose(); environmentGenerator.dispose();
  renderer.domElement.setAttribute('aria-label', '可旋转、剖切、改制的车辆三维视图');
  const controls = new OrbitControls(camera, renderer.domElement);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const cameraMotion=createCameraMotion(camera,controls.target);let renderedOnce=false;
  controls.addEventListener('start',()=>cameraMotion.cancel());
  controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 24;
  // Allow a real user orbit under the vehicle to inspect the battery, exhaust and axles.
  controls.maxPolarAngle = Math.PI * 0.84;
  const hemisphere=new THREE.HemisphereLight('#e3f2ff', '#66564a', .65);scene.add(hemisphere);
  const key = new THREE.DirectionalLight('#fff0d7', 2.7); key.position.set(4, 7, 5); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6; key.shadow.normalBias = .025;
  const fill = new THREE.DirectionalLight('#7cb6ff', 1.1); fill.position.set(-5, 4, -5); scene.add(fill);
  // Broad pavilion light sources make clearcoat curvature readable without a point-light hotspot.
  RectAreaLightUniformsLib.init();
  const softKey=new THREE.RectAreaLight('#fff2de',4.2,5.8,1.5);softKey.position.set(-3.5,3.9,2.0);softKey.lookAt(0,.8,0);scene.add(softKey);
  const softRim=new THREE.RectAreaLight('#e6efff',2.5,4.5,1.2);softRim.position.set(3.4,3.2,-1.5);softRim.lookAt(0,.9,0);scene.add(softRim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 100), new THREE.MeshStandardMaterial({ color: '#1b2832', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.035; scene.add(ground);
  const shadowPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const radius = ((x - 31.5) / 29) ** 2 + ((y - 31.5) / 29) ** 2;
    shadowPixels[(y * 64 + x) * 4 + 3] = Math.round(140 * Math.exp(-radius * 3));
  }
  const shadowTexture = new THREE.DataTexture(shadowPixels, 64, 64); shadowTexture.needsUpdate = true;
  const contactShade = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 6.3), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  contactShade.rotation.x = -Math.PI / 2; contactShade.position.y = -0.032; scene.add(contactShade);
  const stripes = new THREE.Group(); scene.add(stripes);
  for (let i = 0; i < 32; i++) for (const x of [-2.5, 2.5]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 1.1), new THREE.MeshBasicMaterial({ color: '#688391' }));
    line.position.set(x, -0.025, i * 3 - 48); stripes.add(line);
  }
  const stage = createSceneStage(scene,renderer.capabilities.getMaxAnisotropy());
  let driving:ReturnType<typeof createDrivingView>|null=null;
  const rollingWheels=new WeakMap<THREE.Group,ReturnType<typeof createWheelMotion>>();
  const wheelGroups=new WeakMap<THREE.Group,THREE.Group[]>();
  stage.road.traverse(o => { if (o instanceof THREE.Mesh) o.receiveShadow = true; });
  stage.workshop.traverse(o => { if (o instanceof THREE.Mesh) o.receiveShadow = true; });
  const underfloorNote = document.createElement('div'); underfloorNote.className = 'lab-underfloor-note';
  underfloorNote.textContent = '底部检视 · 场景地板暂隐'; underfloorNote.hidden = true; host.append(underfloorNote);
  const stageBar = document.createElement('div'); stageBar.className = 'lab-stage-switch';
  stageBar.setAttribute('role', 'group'); stageBar.setAttribute('aria-label', '三维场景');
  for (const [label, mode] of [['道路', 'road'], ['车间', 'workshop'], ['展厅', 'gallery']] as [string, StageMode][]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.setAttribute('aria-label', `${label}三维场景`);
    button.onclick = () => {
      stage.setMode(mode);
      if (mode === 'workshop') {
        assemblyPanel.open = host.clientWidth >= 600;
        showroomAssemblyPanel.open = host.clientWidth >= 600;
      }
      applyStage(); const axis = showroomActive ? showroomClipAxis : clipAxis;
      if (axis === 'none') focusStageCamera(); else focusSection(axis);
    };
    stageBar.append(button);
  }
  host.append(stageBar);
  const roadSurfaceBar = document.createElement('div'); roadSurfaceBar.className = 'lab-road-surface';
  roadSurfaceBar.setAttribute('role', 'group'); roadSurfaceBar.setAttribute('aria-label', '三维路面类型');
  const roadSurfaceTitle = document.createElement('span'); roadSurfaceTitle.textContent = '路面 / SURFACE';
  const roadSurfaceButtons = document.createElement('div');
  const roadSurfaceInfo = document.createElement('small');
  const surfaces: { id: RoadSurface; name: string; roughness: number }[] = [
    { id: 'smooth', name: '平整沥青', roughness: 0.6 },
    { id: 'coarse', name: '粗糙沥青', roughness: 1.2 },
    { id: 'gravel', name: '碎石路', roughness: 2.2 },
  ];
  for (const surface of surfaces) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = surface.name;
    button.dataset.surface = surface.id; button.setAttribute('aria-label', `切换三维路面为${surface.name}`);
    button.onclick = () => {
      stage.setRoadSurface(surface.id); refreshRoadSurface();
      callbacks.roadPreset?.(surface.id, surface.roughness);
    };
    roadSurfaceButtons.append(button);
  }
  roadSurfaceBar.append(roadSurfaceTitle, roadSurfaceButtons, roadSurfaceInfo); host.append(roadSurfaceBar);
  function refreshRoadSurface() {
    host.dataset.roadSurface=stage.roadSurface;
    roadSurfaceButtons.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String((button as HTMLButtonElement).dataset.surface === stage.roadSurface)));
    roadSurfaceInfo.textContent = callbacks.roadPreset
      ? `选中路面将设粗糙度 ${surfaces.find(row => row.id === stage.roadSurface)!.roughness.toFixed(2)} 并要求重算`
      : `路面材质预览 · 声学计算仍按左侧粗糙度 ${config?.roadRoughness.toFixed(2) ?? '—'}`;
  }
  function focusStageCamera() {
    if(stage.mode==='road'&&driving&&showroomModel?.assetId.startsWith('xpeng-')){driving.focus();return;}
    if (stage.mode === 'gallery') { if(host.dataset.presentationPage)focusPresentationCamera();else focusCamera([6.7, 2.6, 7.6], [0, .8, 0]); return; }
    if (showroomActive && showroomModel?.assetId === 'xpeng-p7plus') {
      const compact = host.clientWidth < 900;
      if (compact) showroomAssemblyPanel.open = false;
      focusCamera(compact ? [6.4, 3.1, 6.6] : [5.2, 2.65, 5.4], [0, .82, 0]); return;
    }
    if (showroomActive && showroomModel?.assetId.startsWith('xpeng-')) { focusCamera([6.4, 3.2, 6.4], [0, .85, 0]); return; }
    if (stage.mode === 'road') focusCamera([0, 2.45, -7.5], [0, 1.1, 2]);
    else focusCamera([6.8, 4.6, 7.8], [0, 0.8, -0.4]);
  }
  function applyStage() {
    host.dataset.stage=stage.mode;
    camera.clearViewOffset();
    if(stage.mode==='gallery'&&host.dataset.presentationPage==='field'&&host.clientWidth>=1000)camera.setViewOffset(host.clientWidth,host.clientHeight,host.clientWidth*.16,0,host.clientWidth,host.clientHeight);
    updateDrawingResolution();
    contactShade.position.y=stage.mode==='gallery'?-.020:-.032;
    contactShade.renderOrder=stage.mode==='gallery'?2:0;
    driving?.enable(stage.mode==='road'&&!!showroomModel?.assetId.startsWith('xpeng-'));
    scene.fog=stage.mode==='road'?new THREE.Fog('#c6d1cf',230,360):null;
    stage.setClearBay(showroomActive && !!showroomModel?.assetId.startsWith('xpeng-'));
    stage.road.visible = stage.mode === 'road'; stage.workshop.visible = stage.mode === 'workshop';
    ground.visible = false; stripes.visible = false;
    scene.background = new THREE.Color(stage.mode === 'gallery' ? '#ead8bf' : stage.mode === 'road' ? '#bbd3dc' : '#263744');
    key.position.set(4,7,5);fill.position.set(-5,4,-5);
    const gallery=stage.mode==='gallery',light=stage.gallery.lighting;
    softKey.visible=softRim.visible=gallery;
    scene.environmentIntensity = gallery ? light.intensity : stage.mode === 'road' ? 1 : 0.8;
    scene.environmentRotation.set(0,gallery?light.rotation:0,0);
    renderer.toneMappingExposure = gallery ? light.exposure : stage.mode === 'road' ? .93 : 1.0;
    key.color.set(gallery?light.sun:'#fff0d7');key.intensity=gallery?light.strength:2.7;
    key.position.set(...(gallery?[-10,8,-9]:[4,7,5]) as [number,number,number]);
    fill.color.set(gallery?'#f5f2ed':'#d6e8f1');fill.intensity=gallery?1.65:1.1;
    fill.position.set(...(gallery?[6,6,8]:[-5,4,-5]) as [number,number,number]);
    hemisphere.intensity=gallery?.8:.65;
    stageBar.hidden = false;
    roadSurfaceBar.hidden = stage.mode !== 'road' || fieldMode !== 'off';
    refreshRoadSurface();
    assemblyPanel.hidden = showroomActive || stage.mode === 'road';
    showroomAssemblyPanel.hidden = !showroomActive || stage.mode === 'road' || !showroomModel?.parts.length || (config?.vehicle !== 'ice' && !showroomModel?.assetId.startsWith('xpeng-'));
    stageBar.querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-pressed', String(index === (stage.mode === 'road' ? 0 : stage.mode === 'workshop' ? 1 : 2))));
  }
  let model: ReturnType<typeof createVehicleModel> | null = null;
  let sections: ReturnType<typeof createSectionDisplay> | null = null;
  let mountIssues: { sensorId: string; mountPart: string }[] = [];
  let config: LabConfig | null = null, signature = '';
  let exploded = false, amount = 0, lastTime = performance.now();
  const detached = new Set<string>(), partProgress = new Map<string, number>();
  let assemblyOrder: VehiclePart[] = [], autoAssembly: 'detach' | 'attach' | null = null, autoSeconds = 0;
  let body = 'transparent', editMode = false, waveVisible = false, pathMode = 'none';
  let fieldMode = 'off', fieldSlice: 'volume' | 'x' | 'y' | 'z' = 'volume';
  let fieldFocus = false;
  let clipAxis = 'none', clipValue = 0;
  const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  const markers = new THREE.Group(), paths = new THREE.Group(), waves = new THREE.Group(), field = new THREE.Group();
  scene.add(markers, paths, waves, field);
  type Anchor = { origin: Vec3; mountPart?: string };
  const corners = ['fl', 'fr', 'rl', 'rr'];
  const partByName = new Map<string, VehiclePart>();
  const assemblyPanel = document.createElement('details'); assemblyPanel.className = 'lab-assembly-panel'; assemblyPanel.hidden = true;
  const assemblySummary = document.createElement('summary'); assemblySummary.textContent = '逐件拆装';
  const assemblyStatus = document.createElement('p'); assemblyStatus.setAttribute('aria-live', 'polite');
  const assemblyActions = document.createElement('div'); assemblyActions.className = 'lab-assembly-actions';
  const detachButton = document.createElement('button'); detachButton.type = 'button'; detachButton.textContent = '拆下一件';
  const attachButton = document.createElement('button'); attachButton.type = 'button'; attachButton.textContent = '逆序回装';
  const autoButton = document.createElement('button'); autoButton.type = 'button'; autoButton.textContent = '自动拆解';
  const restoreButton = document.createElement('button'); restoreButton.type = 'button'; restoreButton.textContent = '自动回装';
  assemblyActions.append(detachButton, attachButton, autoButton, restoreButton);
  const assemblyList = document.createElement('div'); assemblyList.className = 'lab-assembly-list';
  assemblyPanel.append(assemblySummary, assemblyStatus, assemblyActions, assemblyList); host.append(assemblyPanel);
  function refreshAssembly() {
    assemblyStatus.textContent = `已拆 ${detached.size} / ${assemblyOrder.length} 个可动部件组`;
    detachButton.disabled = detached.size === assemblyOrder.length;
    attachButton.disabled = restoreButton.disabled = detached.size === 0;
    autoButton.textContent = autoAssembly === 'detach' ? '暂停自动拆解' : '自动拆解';
    restoreButton.textContent = autoAssembly === 'attach' ? '暂停自动回装' : '自动回装';
    assemblyList.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(detached.has((button as HTMLButtonElement).dataset.part ?? ''))));
  }
  function detachNext() {
    const part = assemblyOrder.find(item => !detached.has(item.object.name));
    if (!part) { autoAssembly = null; refreshAssembly(); return; }
    detached.add(part.object.name);
    if (detached.size === assemblyOrder.length) autoAssembly = null;
    refreshAssembly();
  }
  function attachLast(manual = true) {
    const part = [...assemblyOrder].reverse().find(item => detached.has(item.object.name));
    if (part) detached.delete(part.object.name);
    if (manual || !part || detached.size === 0) autoAssembly = null;
    refreshAssembly();
  }
  detachButton.onclick = () => { autoAssembly = null; detachNext(); };
  attachButton.onclick = () => attachLast();
  autoButton.onclick = () => { autoAssembly = autoAssembly === 'detach' ? null : 'detach'; autoSeconds = 0; refreshAssembly(); };
  restoreButton.onclick = () => { autoAssembly = autoAssembly === 'attach' ? null : 'attach'; autoSeconds = 0; refreshAssembly(); };
  const guidePicker = document.createElement('label'); guidePicker.className = 'lab-part-picker';
  guidePicker.textContent = '查看车辆结构';
  const guideSelect = document.createElement('select'); guideSelect.setAttribute('aria-label', '选择车辆结构');
  guidePicker.append(guideSelect); host.append(guidePicker);
  const guideCard = document.createElement('aside'); guideCard.className = 'lab-part-card'; guideCard.hidden = true;
  guideCard.setAttribute('aria-live', 'polite');
  const guideClose = document.createElement('button'); guideClose.type = 'button'; guideClose.textContent = '关闭'; guideClose.setAttribute('aria-label', '关闭车辆结构说明');
  const guideTitle = document.createElement('h3'), guideRole = document.createElement('p'), guidePath = document.createElement('p');
  const guideNote = document.createElement('small'); guideNote.textContent = '原创教学几何；外形、尺寸和管线不代表量产车或实车标定。';
  const guideSource = document.createElement('a'); guideSource.target = '_blank'; guideSource.rel = 'noopener noreferrer';
  guideCard.append(guideClose, guideTitle, guideRole, guidePath, guideNote, guideSource); host.append(guideCard);
  function clearGuide() { guideSelect.value = ''; guideCard.hidden = true; }
  guideClose.onclick = clearGuide;
  function focusCamera(position: Vec3, target: Vec3, fov=40) {
    if (passengerFocus) { passengerFocus = false; controls.minDistance = 3; }
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
    cameraMotion.start(position,target,fov,performance.now(),renderedOnce&&!reducedMotion.matches?420:0);
    if(!cameraMotion.active)controls.update();
  }
  function focusCockpit() { focusCamera([0.05, 1.85, -0.25], [0.1, 1.25, 1.15]); }
  let showroomModel: ShowroomModel | null = null;
  const vehicleLayout = () => registeredVehicleLayout(config?.layoutId);
  const p7Layout = () => !!vehicleLayout();
  const acousticAsset = () => !showroomActive || (!!vehicleLayout() && showroomModel?.assetId === vehicleLayout()?.assetId);
  let hardwareOverlay = false;
  const hardwareVisible = () => acousticAsset() && (!host.dataset.presentationPage || host.dataset.presentationPage === 'field' || host.dataset.presentationPage === 'structure' && (hardwareOverlay || editMode));
  let showroomActive = false, showroomRequest = 0, disposed = false;
  let showroomClipAxis: AssetSectionAxis = 'none';
  let showroomSelected: string | null = null;
  const showroomToggle = document.createElement('button');
  showroomToggle.type = 'button'; showroomToggle.className = 'lab-showroom-toggle';
  showroomToggle.textContent = '写实外观'; showroomToggle.setAttribute('aria-label', '打开写实 SUV 外观范例');
  const showroomPanel = document.createElement('aside');
  showroomPanel.className = 'lab-showroom-panel'; showroomPanel.hidden = true;
  showroomPanel.innerHTML = '<strong>写实 SUV 外观范例</strong><p></p><div class="lab-showroom-views" aria-label="外观视角"></div><div class="lab-showroom-colors" aria-label="车漆颜色"></div><a target="_blank" rel="noopener noreferrer"></a>';
  const showroomTitle = showroomPanel.querySelector('strong')!;
  const showroomDescription = showroomPanel.querySelector('p')!;
  const showroomCredit = showroomPanel.querySelector('a')!;
  const p7Reference = document.createElement('a'); p7Reference.className = 'lab-p7-reference'; p7Reference.href = 'https://www.dongchedi.com/auto/series/9761/images-wg'; p7Reference.target = '_blank'; p7Reference.rel = 'noopener noreferrer'; p7Reference.textContent = '懂车帝 P7+ 多角度外观参考 ↗'; p7Reference.hidden = true; showroomPanel.append(p7Reference);
  const p7Views = document.createElement('div'); p7Views.className = 'lab-xpeng-actions'; p7Views.hidden = true;
  for (const [label, position] of [['正前', [0, 1.10, 9.5]], ['正侧', [9.5, 1.10, 0]], ['正后', [0, 1.10, -9.5]]] as [string, Vec3][]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = () => { focusCamera([position[0]*1.12,position[1],position[2]*1.12], [0, -.12, 0],28); }; p7Views.append(button);
  }
  showroomPanel.append(p7Views);
  const inspectionPanel = document.createElement('details'); inspectionPanel.className = 'lab-asset-inspection';
  inspectionPanel.innerHTML = '<summary>同车结构检视</summary><label>外壳<select aria-label="写实车外壳"><option value="solid">实体</option><option value="transparent">透明</option><option value="hidden">隐藏外壳</option></select></label><label>剖面<select aria-label="写实车剖面"><option value="none">关闭</option><option value="x">纵向 X</option><option value="y">水平 Y</option><option value="z">横向 Z</option></select></label><input type="range" aria-label="写实车剖面位置" step="0.01" value="0"><output></output><small>保留侧为坐标 ≥ 剖面位置。资产仅显示真实截线；未核验实体内部，不填充封口。</small><label>几何总成<select aria-label="选择写实车部件"></select></label><button type="button" class="lab-asset-part-action" disabled>先选择部件</button><button type="button" class="lab-asset-reset">恢复同车视图与回装</button>';
  const xpengPicker = document.createElement('label'); xpengPicker.className = 'lab-xpeng-picker'; xpengPicker.hidden = true;
  xpengPicker.textContent = '小鹏车型';
  const xpengSelect = document.createElement('select'); xpengSelect.setAttribute('aria-label', '选择小鹏车型');
  for (const spec of xpengCatalog) xpengSelect.add(new Option(spec.name, spec.id));
  xpengSelect.onchange = () => { host.dispatchEvent(new CustomEvent('xpeng-vehicle-change',{bubbles:true,detail:xpengSelect.value})); };
  xpengPicker.append(xpengSelect); showroomPanel.prepend(xpengPicker);
  const xpengLaunch = document.createElement('button'); xpengLaunch.type = 'button'; xpengLaunch.className = 'lab-xpeng-launch';
  xpengLaunch.textContent = '小鹏 · 五车重建'; xpengLaunch.onclick = () => { host.dispatchEvent(new CustomEvent('xpeng-vehicle-change',{bubbles:true,detail:xpengSelect.value})); }; host.append(xpengLaunch);
  const xpengActions = document.createElement('div'); xpengActions.className = 'lab-xpeng-actions'; xpengActions.hidden = true;
  const xpengExplode = document.createElement('button'); xpengExplode.type = 'button'; xpengExplode.textContent = '展开全部';
  xpengExplode.onclick = () => { showroomDetached.clear(); showroomModel?.parts.forEach(p => showroomDetached.add(p.id)); showroomAuto = null; refreshShowroomAssembly(); focusCamera([10.5,5.1,12.4],[0,-.4,0]); };
  const xpengRestore = document.createElement('button'); xpengRestore.type = 'button'; xpengRestore.textContent = '全部复位'; xpengRestore.onclick = () => reset();
  const xpengCabin = document.createElement('button'); xpengCabin.type = 'button'; xpengCabin.textContent = '查看座舱';
  xpengCabin.onclick = () => { setShowroomBody('hidden'); setShowroomSection('none', 0); focusCamera([5.3,4.4,-5.3],[0,-.1,-.1]); };
  xpengActions.append(xpengExplode, xpengRestore, xpengCabin); showroomPanel.append(xpengActions, inspectionPanel);
  const inspectionBody = inspectionPanel.querySelector<HTMLSelectElement>('[aria-label="写实车外壳"]')!;
  const inspectionAxis = inspectionPanel.querySelector<HTMLSelectElement>('[aria-label="写实车剖面"]')!;
  const inspectionPosition = inspectionPanel.querySelector<HTMLInputElement>('input')!;
  const inspectionOutput = inspectionPanel.querySelector('output')!;
  const inspectionPart = inspectionPanel.querySelector<HTMLSelectElement>('[aria-label="选择写实车部件"]')!;
  const inspectionPartAction = inspectionPanel.querySelector<HTMLButtonElement>('.lab-asset-part-action')!;
  function selectShowroomPart(id: string | null) {
    showroomSelected = id; inspectionPart.value = id ?? ''; showroomModel?.selectPart(id);
    inspectionPartAction.disabled = !id;
    inspectionPartAction.textContent = !id ? '先选择部件' : showroomDetached.has(id) ? '回装所选部件' : '拆出所选部件';
  }
  function setShowroomBody(value: AssetBodyMode) {
    if (value !== 'hidden' && passengerFocus) { passengerFocus = false; controls.minDistance = 3; }
    inspectionBody.value = value; showroomModel?.inspection.setBody(value);
  }
  function setShowroomSection(axis: AssetSectionAxis, value: number) {
    const changed = axis !== showroomClipAxis;
    showroomClipAxis = axis; inspectionAxis.value = axis;
    const range = axis === 'x' ? [-1.2, 1.2] : axis === 'y' ? [0, 1.8] : [-2.5, 2.5];
    inspectionPosition.min = String(Math.min(range[0], value)); inspectionPosition.max = String(Math.max(range[1], value));
    inspectionPosition.value = String(value); inspectionPosition.disabled = axis === 'none';
    inspectionOutput.textContent = axis === 'none' ? '剖面关闭' : `${axis.toUpperCase()} = ${value.toFixed(2)} m`;
    showroomModel?.inspection.setSection(axis, value);
    passengers.setSection(axis, value);
    if (changed) { if (axis === 'none') focusStageCamera(); else focusSection(axis); }
  }
  inspectionBody.onchange = () => setShowroomBody(inspectionBody.value as AssetBodyMode);
  inspectionAxis.onchange = () => setShowroomSection(inspectionAxis.value as AssetSectionAxis, inspectionAxis.value === 'y' ? 0.85 : 0);
  inspectionPosition.oninput = () => setShowroomSection(showroomClipAxis, Number(inspectionPosition.value));
  inspectionPart.onchange = () => selectShowroomPart(inspectionPart.value || null);
  inspectionPartAction.onclick = () => {
    if (!showroomSelected) return;
    if (showroomDetached.has(showroomSelected)) showroomDetached.delete(showroomSelected); else showroomDetached.add(showroomSelected);
    showroomAuto = null; refreshShowroomAssembly();
  };
  inspectionPanel.querySelector<HTMLButtonElement>('.lab-asset-reset')!.onclick = () => reset();
  const showroomAssemblyPanel = document.createElement('details');
  showroomAssemblyPanel.className = 'lab-assembly-panel lab-showroom-assembly'; showroomAssemblyPanel.hidden = true;
  const showroomAssemblySummary = document.createElement('summary'); showroomAssemblySummary.textContent = '写实车外观分件';
  const showroomAssemblyStatus = document.createElement('p'); showroomAssemblyStatus.setAttribute('aria-live', 'polite');
  const showroomAssemblyActions = document.createElement('div'); showroomAssemblyActions.className = 'lab-assembly-actions';
  const showroomDetach = document.createElement('button'); showroomDetach.type = 'button'; showroomDetach.textContent = '拆下一件';
  const showroomAttach = document.createElement('button'); showroomAttach.type = 'button'; showroomAttach.textContent = '逆序回装';
  const showroomAutoDetach = document.createElement('button'); showroomAutoDetach.type = 'button'; showroomAutoDetach.textContent = '自动拆解';
  const showroomAutoAttach = document.createElement('button'); showroomAutoAttach.type = 'button'; showroomAutoAttach.textContent = '自动回装';
  showroomAssemblyActions.append(showroomDetach, showroomAttach, showroomAutoDetach, showroomAutoAttach);
  const showroomAssemblyList = document.createElement('div'); showroomAssemblyList.className = 'lab-assembly-list';
  showroomAssemblyPanel.append(showroomAssemblySummary, showroomAssemblyStatus, showroomAssemblyActions, showroomAssemblyList);
  const showroomDetached = new Set<string>(), showroomProgress = new Map<string, number>();
  let showroomAuto: 'detach' | 'attach' | null = null, showroomSeconds = 0;
  function refreshShowroomAssembly() {
    const total = showroomModel?.parts.length ?? 0;
    showroomAssemblyStatus.textContent = `已拆 ${showroomDetached.size} / ${total} 个${showroomModel?.assetId.startsWith('xpeng-') ? '原创模型' : '原资产几何'}总成`;
    showroomDetach.disabled = showroomDetached.size === total;
    showroomAttach.disabled = showroomAutoAttach.disabled = showroomDetached.size === 0;
    showroomAutoDetach.textContent = showroomAuto === 'detach' ? '暂停自动拆解' : '自动拆解';
    showroomAutoAttach.textContent = showroomAuto === 'attach' ? '暂停自动回装' : '自动回装';
    showroomAssemblyList.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(showroomDetached.has((button as HTMLButtonElement).dataset.part ?? ''))));
    selectShowroomPart(showroomSelected);
  }
  function stepShowroomAssembly(direction: 'detach' | 'attach') {
    const parts = showroomModel?.parts ?? [];
    const part = direction === 'detach' ? parts.find(item => !showroomDetached.has(item.id)) : [...parts].reverse().find(item => showroomDetached.has(item.id));
    if (!part) { showroomAuto = null; refreshShowroomAssembly(); return; }
    if (direction === 'detach') showroomDetached.add(part.id); else showroomDetached.delete(part.id);
    if (showroomDetached.size === 0 || showroomDetached.size === parts.length) showroomAuto = null;
    refreshShowroomAssembly();
  }
  showroomDetach.onclick = () => { showroomAuto = null; stepShowroomAssembly('detach'); };
  showroomAttach.onclick = () => { showroomAuto = null; stepShowroomAssembly('attach'); };
  showroomAutoDetach.onclick = () => { showroomAuto = showroomAuto === 'detach' ? null : 'detach'; showroomSeconds = 0; refreshShowroomAssembly(); };
  showroomAutoAttach.onclick = () => { showroomAuto = showroomAuto === 'attach' ? null : 'attach'; showroomSeconds = 0; refreshShowroomAssembly(); };
  const showroomViews = showroomPanel.querySelector('.lab-showroom-views')!;
  for (const [label, position] of [
    ['前侧', [4.6, 2.45, 4.6]], ['侧面', [5.7, 2, 0]], ['后侧', [4.6, 2.45, -4.6]],
  ] as [string, Vec3][]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.onclick = () => focusCamera([position[0]*1.27,position[1]*1.10,position[2]*1.27], [0, -.1, 0]); showroomViews.append(button);
  }
  const showroomColors = showroomPanel.querySelector('.lab-showroom-colors')!;
  for (const [label, color] of [
    ['湖蓝', '#2465a8'], ['珍珠白', '#d8dde0'], ['曜石黑', '#18202a'], ['深红', '#873c43'],
  ]) {
    const button = document.createElement('button'); button.type = 'button'; button.title = label;
    button.setAttribute('aria-label', `${label}车漆`); button.style.backgroundColor = color;
    button.onclick = () => { showroomModel?.setPaint(color); showroomColors.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button))); };
    showroomColors.append(button);
  }
  host.append(showroomToggle, showroomPanel, showroomAssemblyPanel);
  function leaveShowroom() {
    passengers.attach(null); host.dispatchEvent(new CustomEvent('passenger-layout-change'));
    ++showroomRequest;
    showroomToggle.removeAttribute('title');
    if (!showroomActive) {
      showroomToggle.disabled = false; showroomToggle.textContent = '写实外观';
      return;
    }
    showroomActive = false; host.dataset.asset = 'teaching-fixed-v1'; host.classList.remove('xpeng-active'); xpengPicker.hidden = xpengActions.hidden = true; p7Reference.hidden = p7Views.hidden = true;
    if (showroomModel) showroomModel.inspection.overlay.visible = false;
    showroomAuto = null;
    showroomAssemblyPanel.hidden = true;
    showroomPanel.hidden = true; showroomToggle.textContent = '写实外观';
    showroomToggle.setAttribute('aria-label', '打开写实 SUV 外观范例');
    (ground.material as THREE.MeshStandardMaterial).color.set('#1b2832');
    ground.scale.set(1, 1, 1);
    applyStage();
    if (model) model.group.visible = true;
    if (sections) sections.group.visible = true;
    if (showroomModel) showroomModel.group.visible = false;
    guidePicker.style.display = ''; guideCard.style.display = '';
    fieldNote.style.display = ''; fieldHud.style.display = ''; fieldFocusButton.style.display = ''; pathFocusNote.style.display = '';
    paintField(); reset();
    if (fieldMode !== 'off') focusCamera([4.6, 2.9, -4.6], [0, 1.15, 0]);
  }
  showroomToggle.onclick = () => { if (showroomActive) leaveShowroom(); else void enterShowroom(); };
  async function enterShowroom(xpengId?: XPengId) {
    const request = ++showroomRequest;
    const vehicle = config?.vehicle ?? 'ice';
    const wantedAssetId = xpengId ? `xpeng-${xpengId}` : vehicle === 'bev' ? 'tesla-model-y' : 'range-rover';
    showroomToggle.removeAttribute('title');
    showroomToggle.disabled = true; showroomToggle.textContent = '加载外观…';
    try {
      if (showroomModel && showroomModel.assetId !== wantedAssetId) {
        passengers.attach(null); host.dispatchEvent(new CustomEvent('passenger-layout-change'));
        scene.remove(showroomModel.group); showroomModel.dispose(); showroomModel = null;
      }
      if (!showroomModel) {
        const loaded = xpengId ? (await import('./xpeng-model')).createXPengModel(xpengId) : await (await import('./showroom-model')).loadShowroomModel(vehicle);
        if (disposed || request !== showroomRequest) { loaded.dispose(); return; }
        showroomModel = loaded; showroomModel.group.visible = false; scene.add(showroomModel.group, showroomModel.inspection.overlay);
        showroomModel.inspection.overlay.visible = false;
        showroomModel.setPaint(xpengId === 'p7plus' ? '#b8bdc2' : xpengId ? getXPengSpec(xpengId).color : '#d8dde0');
        showroomColors.querySelectorAll('button').forEach((button, index) => button.setAttribute('aria-pressed', String(!xpengId && index === 1)));
      }
      if (request !== showroomRequest || disposed) return;
      showroomDetached.clear(); showroomProgress.clear(); showroomAuto = null; showroomSelected = null;
      inspectionPanel.hidden = (!xpengId && vehicle !== 'ice') || showroomModel.parts.length === 0;
      xpengPicker.hidden = xpengActions.hidden = !xpengId; host.classList.toggle('xpeng-active', !!xpengId);
      p7Reference.hidden = xpengId !== 'p7plus'; p7Views.hidden = false;
      if (xpengId) { xpengSelect.value = xpengId; inspectionPanel.open = false; }
      inspectionPart.replaceChildren(new Option('点选车模或选择部件', ''));
      showroomAssemblyList.replaceChildren();
      for (const part of showroomModel.parts) {
        showroomModel.setPartProgress(part.id, 0);
        const button = document.createElement('button'); button.type = 'button'; button.dataset.part = part.id;
        button.textContent = part.name; button.setAttribute('aria-label', `拆装 ${part.name}`);
        button.onclick = () => { showroomSelected = part.id; if (showroomDetached.has(part.id)) showroomDetached.delete(part.id); else showroomDetached.add(part.id); showroomAuto = null; refreshShowroomAssembly(); };
        showroomAssemblyList.append(button);
        inspectionPart.add(new Option(part.name, part.id));
      }
      refreshShowroomAssembly();
      showroomTitle.textContent = `${showroomModel.title} · 同车外观验证`;
      showroomDescription.textContent = vehicle === 'hev' || vehicle === 'erev'
        ? '当前尚无经过授权和质量核验的同动力车型外观；此车仅作 SUV 外观参考。动力结构、声学点位和剖面请返回教学模型查看。'
        : vehicle === 'ice'
          ? '道路、车间与结构检视复用同一资产；可点选、拆装、透明和剖切已辨认的几何总成。完整动力结构和声学坐标尚未完成配准。'
          : '同一写实外观可在道路与车间查看；此资产尚无核实的独立拆件，不代表教学结构或声学安装坐标。';
      showroomCredit.href = showroomModel.source;
      showroomCredit.textContent = `模型：${showroomModel.credit} · CC BY 4.0`;
      if (xpengId) {
        const spec = getXPengSpec(xpengId);
        showroomTitle.textContent = `${spec.name} · ${spec.variant}`;
        showroomDescription.textContent = `${Math.round(spec.length * 1000)} × ${Math.round(spec.width * 1000)} × ${Math.round(spec.height * 1000)} mm · 轴距 ${Math.round(spec.wheelbase * 1000)} mm。官网照片参考重建；内部按公开架构细化，非原厂CAD。`;
        showroomCredit.textContent = '查看小鹏官网图片与车型来源 ↗';
        showroomAssemblySummary.textContent = '小鹏模型 · 逐件拆装';
        inspectionPanel.querySelector('small')!.textContent = '保留坐标 ≥ 剖面位置一侧。显示实际网格截线；内部安装尺寸为重建估计，可查看部件与来源说明。';
      } else {
        showroomAssemblySummary.textContent = '写实车外观分件';
        inspectionPanel.querySelector('small')!.textContent = '保留侧为坐标 ≥ 剖面位置。资产仅显示真实截线；未校验实体内部，不填充封口。';
      }
      showroomActive = true; host.dataset.asset = showroomModel.assetId;
      passengers.attach(showroomModel); host.dispatchEvent(new CustomEvent('passenger-layout-change'));
      showroomModel.group.visible = true;
      showroomModel.inspection.overlay.visible = true;
      setShowroomBody('solid'); setShowroomSection('none', 0);
      if (model) model.group.visible = false;
      if (sections) sections.group.visible = false;
      applyStage();
      autoAssembly = null; refreshAssembly();
      guidePicker.style.display = 'none'; guideCard.style.display = 'none';
      for (const element of [fieldNote,fieldHud,fieldFocusButton,pathFocusNote]) element.style.display = acousticAsset() ? '' : 'none';
      syncFieldSampling(); paintField();
      showroomPanel.hidden = false; showroomToggle.textContent = '返回结构实验';
      showroomToggle.setAttribute('aria-label', '返回四类动力教学模型和声学实验');
      focusStageCamera();
      if (xpengId) host.scrollIntoView({ block: 'center' });
    } catch (error) {
      if (disposed || request !== showroomRequest) return;
      showroomToggle.textContent = '外观加载失败 · 重试';
      showroomToggle.title = error instanceof Error ? error.message : String(error);
    } finally { if (!disposed && request === showroomRequest) showroomToggle.disabled = false; }
  };
  function showGuide(part: VehiclePart) {
    if (!config || editMode) return;
    const guide = describeVehiclePart(config.vehicle, part);
    guideSelect.value = guideSelect.querySelector(`option[value="${guide.id}"]`) ? guide.id : '';
    guideTitle.textContent = guide.title;
    guideRole.textContent = guide.role;
    guidePath.textContent = `本车能量路径：${guide.path}`;
    guideSource.textContent = `结构依据：${guide.sourceLabel}`;
    guideSource.href = guide.sourceUrl;
    guideCard.hidden = false;
    if (part.object.name === 'cockpit' && body === 'hidden') focusCockpit();
  }
  guideSelect.onchange = () => { const part = partByName.get(guideSelect.value); if (part) showGuide(part); else clearGuide(); };
  const bodyMaterials = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
  const sourceAnchor = (i: number): Anchor => ({ origin: labLayout(config!).sources[i], mountPart: p7Layout() ? `wheel-${i<2?1:-1}-${i%2===0?1:-1}` : `wheel-${corners[i]}` });
  const speakerAnchor = (i: number): Anchor => ({ origin: labLayout(config!).speakers[i], mountPart: p7Layout() ? `${i<2?'front':'rear'}-door-${i%2===0?1:-1}` : `door-${i < 2 ? 'front' : 'rear'}-${i % 2 === 0 ? 1 : -1}` });
  const micAnchor = (i: number): Anchor => ({ origin: labLayout(config!).microphones[i], mountPart: p7Layout() ? `seat-${i<2?1:2}-${i<2?i+1:i===2?1:vehicleLayout()?.secondRowSeats??3}` : `seat-${[1, 2, 3, 5][i]}` });
  const markerRows: { mesh: THREE.Mesh; button: HTMLButtonElement; line: SVGLineElement; selection: LabSelection; source: boolean; anchor: Anchor }[] = [];
  const waveRows: THREE.Mesh[] = [];
  const pathRows: { line: THREE.Line; dot: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; start: Anchor; end: Anchor; primary: boolean; channel: number; mic: number }[] = [];
  let fieldPoints = createFieldPoints(DENSE_FIELD_GRID);
  const fieldDisplay=createFieldDisplay(fieldPoints,renderer.extensions.has('OES_texture_float_linear'));
  field.add(fieldDisplay.group);field.visible=false;
  const fieldOcclusion=createFieldOcclusion();
  const previewOcclusion=createFieldOcclusion();
  const sliceMeshes=fieldDisplay.slices;
  let improvementView=false,lockedFieldRange:[number,number]|null=null,lockedImprovementRange:[number,number]|null=null,fieldOpacity=.9;
  const fieldNote = document.createElement('div'); fieldNote.className = 'lab-field-interpolation-note'; fieldNote.hidden = true;
  const fieldNoteDetail = document.createElement('span'); fieldNoteDetail.className = 'lab-field-note-detail';
  const fieldNoteCompact = document.createElement('span'); fieldNoteCompact.className = 'lab-field-note-compact';
  fieldNote.append(fieldNoteDetail, fieldNoteCompact); host.append(fieldNote);
  const fieldHud = document.createElement('aside'); fieldHud.className = 'lab-field-hud'; fieldHud.hidden = true;
  fieldHud.setAttribute('aria-label', '三维声场热力图图例');
  const cabinLegend=document.createElement('aside');cabinLegend.className='lab-cabin-legend';cabinLegend.hidden=true;
  cabinLegend.setAttribute('aria-label','模型旁声场色标');cabinLegend.innerHTML='<small></small><i></i><div></div>';host.append(cabinLegend);
  const fieldHudTitle = document.createElement('strong'), fieldHudRange = document.createElement('span');
  const fieldHudScale = document.createElement('div'); fieldHudScale.className = 'lab-field-scale';
  fieldHudScale.innerHTML = '<span>45 dB</span><i></i><span>85 dB</span>';
  const fieldHudHotspot = document.createElement('p'), fieldHudProbe = document.createElement('p');
  fieldHud.append(fieldHudTitle, fieldHudRange, fieldHudScale, fieldHudHotspot, fieldHudProbe); host.append(fieldHud);
  const fieldControls=document.createElement('div');fieldControls.className='lab-field-display-controls';
  const improvementButton=document.createElement('button');improvementButton.type='button';improvementButton.textContent='同窗改善分布';improvementButton.setAttribute('aria-pressed','false');
  improvementButton.onclick=()=>{improvementView=!improvementView;improvementButton.setAttribute('aria-pressed',String(improvementView));paintField();};
  const rangeButton=document.createElement('button');rangeButton.type='button';rangeButton.textContent='增强局部对比';rangeButton.setAttribute('aria-pressed','false');
  rangeButton.onclick=()=>{if(!frame?.valid)return;const lock=!lockedFieldRange;lockedFieldRange=lock?pairedFieldRange(frame):null;lockedImprovementRange=lock?improvementFieldRange(frame):null;rangeButton.setAttribute('aria-pressed',String(!!lockedFieldRange));rangeButton.textContent=lockedFieldRange?'恢复标准色标':'增强局部对比';paintField();};
  const overheadButton=document.createElement('button');overheadButton.type='button';overheadButton.textContent='俯视座舱';overheadButton.onclick=()=>focusCamera(host.clientWidth<1000?[.01,8,.02]:[1,8,.02],host.clientWidth<1000?[0,.8,-.12]:[1,.8,-.12]);
  const densityLabel=document.createElement('label');densityLabel.textContent='不透明度';const density=document.createElement('input');density.type='range';density.min='25';density.max='100';density.value='90';density.step='5';density.setAttribute('aria-label','声场不透明度');density.oninput=()=>{fieldOpacity=Number(density.value)/100;fieldDisplay.setOpacity(fieldOpacity);};densityLabel.append(density);
  const fieldDisplayNote=document.createElement('small');fieldDisplayNote.textContent='1,989 个物理采样点 · 体积声能插值；原声与残余共用色标，帧间平滑不增加物理信息。';
  fieldControls.append(improvementButton,rangeButton,overheadButton,densityLabel,fieldDisplayNote);fieldHud.append(fieldControls);

  const fieldFocusButton = document.createElement('button'); fieldFocusButton.type = 'button';
  fieldFocusButton.className = 'lab-field-focus'; fieldFocusButton.hidden = true;
  fieldFocusButton.onclick = () => { fieldFocus = !fieldFocus; refreshFieldFocus(); };
  host.append(fieldFocusButton);
  function refreshFieldFocus() {
    fieldFocusButton.hidden = fieldMode === 'off';
    fieldFocusButton.textContent = fieldFocus ? '声场聚焦 · 显示硬件' : '显示硬件 · 聚焦声场';
    fieldFocusButton.setAttribute('aria-pressed', String(fieldFocus));
  }
  const probeMarker = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff4b2', depthTest: false }));
  probeMarker.name = 'field-sample-probe'; probeMarker.visible = false; probeMarker.renderOrder = 7; field.add(probeMarker);
  let probeIndex: number | null = null;
  const pathFocusNote = document.createElement('div'); pathFocusNote.className = 'lab-path-focus-note'; pathFocusNote.hidden = true;
  const pathFocusDetail = document.createElement('span'); pathFocusDetail.className = 'lab-path-focus-detail';
  const pathFocusCompact = document.createElement('span'); pathFocusCompact.className = 'lab-path-focus-compact';
  const pathIsolation = document.createElement('button'); pathIsolation.type = 'button';
  pathIsolation.className = 'lab-path-isolation'; pathIsolation.setAttribute('aria-label', '聚焦所选通道路径');
  let isolatePaths = true, hasPathFocus = false;
  pathIsolation.setAttribute('aria-pressed', 'true'); pathIsolation.textContent = '显示全部关联';
  pathIsolation.onclick = () => { isolatePaths = !isolatePaths; pathFocusKey = ''; pathIsolation.setAttribute('aria-pressed', String(isolatePaths)); pathIsolation.textContent = isolatePaths ? '显示全部关联' : '聚焦所选通道'; };
  pathFocusNote.append(pathFocusDetail, pathFocusCompact, pathIsolation); host.append(pathFocusNote);
  let frame: FieldFrame | null = null;
  let pathFocusKey = '';

  function displayPosition(anchor: Anchor, target: THREE.Vector3) {
    target.set(...anchor.origin);
    if (p7Layout() && showroomActive && showroomModel && acousticAsset()) {
      const object = anchor.mountPart ? showroomModel.group.getObjectByName(anchor.mountPart) : null;
      if (object) target.add(object.position);
      return target;
    }
    const part = anchor.mountPart ? partByName.get(anchor.mountPart) : undefined;
    if (part) target.addScaledVector(part.offset, partProgress.get(part.object.name) ?? amount);
    return target;
  }
  function visibleInHierarchy(object: THREE.Object3D) {
    for (let current: THREE.Object3D | null = object; current; current = current.parent) if (!current.visible) return false;
    const material = (object as THREE.Mesh).material;
    return !material || (Array.isArray(material) ? material.some(m => m.visible && m.opacity > 0) : material.visible && material.opacity > 0);
  }
  function unclipped(point: THREE.Vector3) { return clipAxis === 'none' || clipPlane.distanceToPoint(point) >= 0; }

  function clear(group: THREE.Group) {
    group.traverse(object => {
      const item = object as THREE.Mesh;
      item.geometry?.dispose();
      if (item.material) for (const material of Array.isArray(item.material) ? item.material : [item.material]) material.dispose();
    }); group.clear();
  }
  function applyClipping() {
    clipPlane.normal.set(clipAxis === 'x' ? 1 : 0, clipAxis === 'y' ? 1 : 0, clipAxis === 'z' ? 1 : 0);
    clipPlane.constant = -clipValue;
    const planes = clipAxis === 'none' ? [] : [clipPlane];
    // Retain computed field samples while letting cut geometry remain legible.
    fieldDisplay.setOpacity(fieldOpacity);
    fieldDisplay.setClip(clipAxis==='none'?null:clipPlane);
    for (const material of model?.materials ?? []) { material.clippingPlanes = planes; material.needsUpdate = true; }
    // The moving field plane lies exactly on the section boundary. Float32 vertex rounding
    // can place it on the discarded side, so clip the car but not that coincident overlay.
    const coincidentFieldMesh = movingFieldSlice() ? sliceMeshes.get(fieldSlice as SliceAxis)?.mesh : null;
    for (const group of [markers, waves, paths, field]) group.traverse(object => {
      const material = (object as THREE.Mesh).material;
      if (material) for (const value of Array.isArray(material) ? material : [material]) { value.clippingPlanes = object === coincidentFieldMesh ? [] : planes; value.needsUpdate = true; }
    });
  }
  function applyBody() {
    for (const mesh of model?.shell ?? []) {
      mesh.visible = body !== 'hidden';
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const original = bodyMaterials.get(material)!;
        material.transparent = body === 'solid' ? original.transparent : true;
        material.opacity = body === 'solid' ? original.opacity : Math.min(original.opacity, 0.2);
        material.depthWrite = body === 'solid' ? original.depthWrite : false; material.needsUpdate = true;
      }
    }
  }
  function addMarker(anchor: Anchor, selection: LabSelection, name: string, hex: string, source = false) {
    const mesh = new THREE.Mesh(source ? new THREE.TorusGeometry(0.18, 0.024, 8, 24) : new THREE.SphereGeometry(0.065, 14, 10), new THREE.MeshBasicMaterial({ color: hex, depthTest: false }));
    if (source) mesh.rotation.x = Math.PI / 2;
    displayPosition(anchor, mesh.position); mesh.renderOrder = 9; markers.add(mesh);
    mesh.userData.selection = selection;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'lab-marker';
    button.textContent = name; button.style.setProperty('--marker-color', hex);
    button.setAttribute('aria-label', `${name} · ${source ? '查看轮端激励源信号和频谱' : '查看信号和频谱'}`);
    button.dataset.signal = selection.signal; button.dataset.channel = String(selection.channel);
    button.onclick = () => callbacks.select(selection);
    button.oncontextmenu = event => { event.preventDefault(); callbacks.context(selection, event.clientX, event.clientY); };
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', hex); leaders.append(line);
    host.append(button); markerRows.push({ mesh, button, line, selection, source, anchor });
  }
  function setConfig(next: LabConfig) {
    if (config && config.vehicle !== next.vehicle && !registeredVehicleLayout(next.layoutId)) leaveShowroom();
    config = structuredClone(next);
    stage.setRoadSurface(next.roadRoughness>=1.7?'gravel':next.roadRoughness>=.9?'coarse':'smooth');
    refreshRoadSurface();
    const key = JSON.stringify([next.layoutId, next.vehicle, next.references, next.speakerEnabled]);
    if (key === signature) return;
    signature = key;
    frame = null; lockedFieldRange=null;lockedImprovementRange=null;rangeButton.setAttribute('aria-pressed','false');rangeButton.textContent='增强局部对比';paintField();
    if (sections) { scene.remove(sections.group); sections.dispose(); }
    if (model) { scene.remove(model.group); model.dispose(); }
    model = createVehicleModel(next.vehicle); scene.add(model.group);
    sections = createSectionDisplay(model.group); scene.add(sections.group);
    model.group.visible = sections.group.visible = !showroomActive && !p7Layout();
    partByName.clear(); model.parts.forEach(part => partByName.set(part.object.name, part));
    detached.clear(); partProgress.clear(); autoAssembly = null;
    const priority: Record<string, number> = { shell: 0, wheel: 1, cabin: 2, powertrain: 3, energy: 4, suspension: 5, chassis: 6 };
    assemblyOrder = [...model.parts].sort((a, b) => (priority[a.category] ?? 7) - (priority[b.category] ?? 7));
    assemblyList.replaceChildren();
    for (const part of assemblyOrder) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.part = part.object.name;
      button.textContent = part.name; button.setAttribute('aria-label', `拆装 ${part.name}`);
      button.onclick = () => { if (detached.has(part.object.name)) detached.delete(part.object.name); else detached.add(part.object.name); autoAssembly = null; refreshAssembly(); };
      assemblyList.append(button);
    }
    refreshAssembly();
    guideSelect.replaceChildren(new Option('选择关键部件，或点击车模', ''));
    featuredVehicleParts(next.vehicle, model.parts).forEach(part => guideSelect.add(new Option(part.name, part.object.name)));
    clearGuide();
    bodyMaterials.clear(); model.shell.forEach(mesh => {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        bodyMaterials.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
      }
    });
    markerRows.forEach(row => { row.button.remove(); row.line.remove(); }); markerRows.length = 0;
    clear(markers); clear(paths); clear(waves); pathRows.length = 0; waveRows.length = 0;
    pathFocusKey = '';
    mountIssues = [];
    next.references.forEach((sensor, i) => {
      // Old recipes have no mount metadata. Their four default suspension locations are still identifiable geometrically.
      const corner = labLayout(config!).sources.findIndex(p => Math.abs(p[0] * 0.85 - sensor.position[0]) < 1e-6 && Math.abs(p[2] - sensor.position[2]) < 1e-6 && Math.abs(sensor.position[1] - 0.67) < 1e-6);
      const mountPart = sensor.mountPart ?? (corner >= 0 ? `suspension-${corners[corner]}` : 'chassis');
      const missing = !!sensor.mountPart && !(p7Layout() ? showroomModel?.group.getObjectByName(sensor.mountPart) || ['suspension-1','suspension--1','platform'].includes(sensor.mountPart) : partByName.has(sensor.mountPart));
      if (missing) mountIssues.push({ sensorId: sensor.id, mountPart: sensor.mountPart! });
      addMarker({ origin: sensor.position, mountPart }, { signal: 'x', channel: i }, `${sensor.name}${missing ? ' · 安装件缺失' : ''}`, missing ? '#fa8d70' : '#f8c26e');
    });
    labLayout(config!).speakers.forEach((_, i) => addMarker(speakerAnchor(i), { signal: 'u', channel: i }, `OUT ${i + 1}${next.speakerEnabled[i] ? '' : ' 停用'}`, next.speakerEnabled[i] ? '#6ab8ff' : '#687583'));
    labLayout(config!).microphones.forEach((_, i) => addMarker(micAnchor(i), { signal: 'e', channel: i }, `MIC ${corners[i].toUpperCase()}`, '#75e3bc'));
    labLayout(config!).sources.forEach((_, i) => addMarker(sourceAnchor(i), { signal: 'q', channel: i }, `Q${i + 1}`, '#d4a3ff', true));
    labLayout(config!).speakers.forEach((p, i) => {
      for (let k = 0; k < 3; k++) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: '#6ab8ff', wireframe: true, transparent: true, opacity: 0.15, depthWrite: false }));
        mesh.position.set(...p); mesh.userData.speaker = i; mesh.userData.phase = k / 3; waves.add(mesh); waveRows.push(mesh);
      }
    });
    for (const primary of [true, false]) for (let channel = 0; channel < 4; channel++) for (let mic = 0; mic < 4; mic++) {
      const start = primary ? sourceAnchor(channel) : speakerAnchor(channel), end = micAnchor(mic);
      const from = displayPosition(start, new THREE.Vector3()), to = displayPosition(end, new THREE.Vector3());
      const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: primary ? '#d4a3ff' : '#6ab8ff', transparent: true, opacity: 0.25 }));
      line.userData = { primary, channel, mic }; line.frustumCulled = false; paths.add(line);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.023, 6, 6), new THREE.MeshBasicMaterial({ color: primary ? '#e4c2ff' : '#92c9ff', transparent: true, depthWrite: false }));
      paths.add(dot); pathRows.push({ line, dot, from, to, start, end, primary, channel, mic });
    }
    syncFieldSampling(); applyBody(); applyClipping();
  }
  function movingFieldSlice() { return fieldSlice !== 'volume' && clipAxis === fieldSlice && Number.isFinite(clipValue); }
  function syncFieldSampling() {
    const row=vehicleLayout();
    const next = config?.layoutId===P7_LAYOUT_ID ? createFieldPoints(DENSE_FIELD_GRID).map(([x,y,z]): Vec3 => [x, .68 + (y-.85)*.72, z*.90]) : row ? createFieldPoints(DENSE_FIELD_GRID).map(([x,y,z]):Vec3 => {
      const front=row.seatZ[0]+.5,rear=row.seatZ[row.seatZ.length-1]-.25;
      return [x*(row.layout.speakers[0][0]/.84),.65+(y-.85)/.84*(row.layout.roof-.70),rear+(z+1.2)/2.03*(front-rear)];
    }) : createFieldPoints(DENSE_FIELD_GRID);
    if (movingFieldSlice()) {
      const sampled = createFieldPointsForSlice(fieldSlice as SliceAxis, clipValue, DENSE_FIELD_GRID);
      const component = {x:0,y:1,z:2}[fieldSlice as SliceAxis];
      sampled.forEach((point,i) => { if (point[component] === clipValue) { const moved = [...next[i]] as [number,number,number]; moved[component] = clipValue; next[i] = moved; } });
    }
    if (fieldPoints.every((point, i) => point.every((coordinate, component) => coordinate === next[i][component]))) return;
    fieldPoints = next;
    // An old physical position must never retain its colour while a new field query is pending.
    frame = null;
    fieldDisplay.setPoints(fieldPoints);
  }
  let animateField = false;
  function paintField() {
    const valid = fieldMode !== 'off' && !!frame && fieldFrameMatchesPoints(frame, fieldPoints);
    field.visible = valid;
    fieldHud.hidden = !valid;
    cabinLegend.hidden = !valid;
    if (!valid || !frame) {
      fieldDisplay.clear();
      probeMarker.visible = false;
      fieldNote.hidden = fieldMode === 'off';
      if (!fieldNote.hidden) {
        fieldNoteDetail.textContent = frame?.valid ? '空间采样点与模型不匹配，已隐藏声场'
          : frame ? '当前车身剖面暂无有效声场' : '当前车身剖面声场待查询，旧位置色片已隐藏';
        fieldNoteCompact.textContent = frame?.valid ? '采样点不匹配，声场已隐藏'
          : frame ? '当前剖面暂无有效场' : '当前剖面场待更新';
      }
      return;
    }
    fieldNote.hidden = false;
    const unit = frame.weighting === 'A' ? 'dBA' : 'dB';
    const quantity:FieldQuantity=improvementView?'reduction':fieldMode==='primary'?'primary':'residual';
    const range:readonly[number,number]=improvementView?(lockedImprovementRange??[-10,10]):lockedFieldRange??[45,85];
    const values=fieldValues(frame,quantity);
    fieldHudScale.innerHTML=`<span>${range[0]} ${improvementView?'dB':unit}</span><i></i><span>${range[1]} ${improvementView?'dB':unit}</span>`;
    fieldHudScale.querySelector('i')!.style.background=`linear-gradient(90deg,${(improvementView?reductionColors:pressureColors).join(',')})`;
    fieldHud.dataset.quantity=quantity;fieldHud.dataset.time=String(frame.time);
    fieldHud.dataset.weighting=frame.weighting??'Z';
    fieldHud.dataset.range=range.join(',');fieldHud.dataset.rendering=fieldSlice;
    cabinLegend.querySelector('small')!.textContent=improvementView?'改善 / dB':`声压级 / ${unit}`;
    cabinLegend.querySelector('i')!.style.background=`linear-gradient(0deg,${(improvementView?reductionColors:pressureColors).join(',')})`;
    cabinLegend.querySelector('div')!.innerHTML=Array.from({length:5},(_,i)=>`<span>${(range[1]-(range[1]-range[0])*i/4).toFixed(0)}</span>`).join('');
    fieldDisplay.update(frame,quantity,fieldSlice,range,animateField);
    let low = Infinity, high = -Infinity, hot = 0;
    values.forEach((value, index) => {
      if (value < low) low = value;
      if (value > high) { high = value; hot = index; }
    });
    fieldHud.dataset.sampleCount = String(values.length);
    fieldHud.dataset.mode = fieldMode;
    fieldHudTitle.textContent = `${improvementView?'同窗改善 d − e':fieldMode==='primary'?'原声 d':'残余声 e'} · 车内声场`;
    fieldHudRange.textContent = `${frame.time.toFixed(2)} s / 采样范围 ${low.toFixed(1)}–${high.toFixed(1)} ${improvementView?'dB':frame.weighting === 'A' ? 'dBA' : 'dB SPL'}`;
    fieldHudHotspot.textContent = `${improvementView?'蓝绿为改善 · 红色为变差；最大改善':'最高采样值'} ${high.toFixed(1)} ${improvementView?'dB':unit} · (${fieldPoints[hot].map(v => v.toFixed(2)).join(', ')}) m`;
    if (probeIndex !== null && probeIndex < values.length) {
      const point = fieldPoints[probeIndex];
      probeMarker.position.set(...point); probeMarker.visible = true;
      fieldHudProbe.textContent = `探针 #${probeIndex+1} · 原声 ${frame.primarySpl[probeIndex].toFixed(1)} / 残余 ${frame.residualSpl[probeIndex].toFixed(1)} ${unit} · 改善 ${(frame.primarySpl[probeIndex]-frame.residualSpl[probeIndex]).toFixed(1)} dB · (${point.map(v=>v.toFixed(2)).join(', ')}) m`;
    } else {
      probeMarker.visible = false;
      fieldHudProbe.textContent = '点击声场读取最近采样点；切片可定位车内不同区域';
    }
    if (!fieldNote.hidden) {
      if (fieldSlice === 'volume') {
        fieldNoteDetail.textContent = '1,989个真实采样点 · 透视体场 / 每3dB等声压层；透明度仅改变显示，精确读数对应标注时间窗';
        fieldNoteCompact.textContent = '1,989点 · 三维体声场 · 声能平滑';
      } else {
        const axis = fieldSlice as SliceAxis, sample = sliceMeshes.get(axis)!.sampleIndices[0];
        const coordinate = fieldPoints[sample][{ x: 0, y: 1, z: 2 }[axis]];
        const provenance = movingFieldSlice() ? '当前车身剖面真实采样切片' : '固定采样切片 · 车身剖面另行移动';
        fieldNoteDetail.textContent = `${improvementView ? '同窗改善' : fieldMode === 'primary' ? '原噪声' : '残余声'} ${axis.toUpperCase()}=${coordinate.toFixed(2)} m ${provenance} · 连续声能插值/透视叠层 · 每3dB等值线 · 色标见图例`;
        fieldNoteCompact.textContent = `${improvementView ? '同窗改善' : fieldMode === 'primary' ? '原声' : '残余'} ${axis.toUpperCase()}=${coordinate.toFixed(2)}m ${movingFieldSlice() ? '当前剖面真实采样' : '固定场片；车身剖面另移'}`;
      }
    }
  }
  function pathIsShown(row: (typeof pathRows)[number]) {
    return (row.primary || !!config?.speakerEnabled[row.channel]) && (pathMode === 'both' || (row.primary ? pathMode === 'primary' : pathMode === 'secondary'));
  }
  function pathMatchesSelection(row: (typeof pathRows)[number], selected: LabSelection) {
    if (selected.signal === 'q') return row.primary && row.channel === selected.channel;
    if (selected.signal === 'u') return !row.primary && row.channel === selected.channel;
    if (selected.signal === 'd') return row.primary && row.mic === selected.channel;
    if (selected.signal === 'a') return !row.primary && row.mic === selected.channel;
    return selected.signal === 'e' && row.mic === selected.channel;
  }
  function updatePathFocus(selected: LabSelection) {
    const key = `${selected.signal}:${selected.channel}:${pathMode}:${config?.speakerEnabled.join(',')}:${isolatePaths}`;
    if (key === pathFocusKey) return;
    pathFocusKey = key;
    pathFocusNote.hidden = pathMode === 'none';
    if (pathFocusNote.hidden) return;
    const shown = pathRows.filter(pathIsShown), focused = shown.filter(row => pathMatchesSelection(row, selected));
    const hasFocus = focused.length > 0; hasPathFocus = hasFocus;
    for (const row of pathRows) {
      const highlight = hasFocus && pathIsShown(row) && pathMatchesSelection(row, selected);
      const material = row.line.material as THREE.LineBasicMaterial;
      material.opacity = hasFocus ? (highlight ? 0.78 : 0.08) : 0.23;
      material.depthTest = !highlight; material.needsUpdate = true;
      row.line.renderOrder = highlight ? 5 : 0;
      const dotMaterial = row.dot.material as THREE.MeshBasicMaterial;
      dotMaterial.opacity = hasFocus ? (highlight ? 0.92 : 0.12) : 0.4;
      dotMaterial.depthTest = !highlight; dotMaterial.needsUpdate = true;
      row.dot.renderOrder = highlight ? 5 : 0;
    }
    const corner = corners[selected.channel]?.toUpperCase() ?? String(selected.channel + 1);
    const identity = selected.signal === 'q' ? `轮端源 Q${selected.channel + 1} → 四误差点`
      : selected.signal === 'u' ? config?.speakerEnabled[selected.channel]
        ? `扬声器 OUT ${selected.channel + 1} → 四误差点` : `扬声器 OUT ${selected.channel + 1} 已停用，无次级传播路径`
        : selected.signal === 'd' ? `MIC ${corner} 原声 d · 初级路径`
          : selected.signal === 'a' ? `MIC ${corner} 控制声 a · 次级路径`
            : selected.signal === 'e' ? `MIC ${corner} 残余声 e · 初级+次级路径`
              : '参考 x 是测量信号，不是轮端源 q';
    pathFocusDetail.textContent = `直线关系示意 · ${identity} · ${isolatePaths && hasFocus ? '聚焦' : '高亮'} ${focused.length}/${shown.length} 条；全部交叉影响仍参与计算`;
    const shortIdentity = selected.signal === 'q' ? `Q${selected.channel + 1} → 四麦克风`
      : selected.signal === 'u' ? config?.speakerEnabled[selected.channel] ? `OUT ${selected.channel + 1} → 四麦克风` : `OUT ${selected.channel + 1} 停用`
        : selected.signal === 'x' ? '参考 x ≠ 轮端 q' : `MIC ${corner} ${selected.signal}`;
    pathFocusCompact.textContent = `示意路径 ${focused.length}/${shown.length} · ${shortIdentity}`;
    pathFocusNote.dataset.focusedPaths = String(focused.length);
    pathFocusNote.dataset.shownPaths = String(shown.length);
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = [0, 0];
  renderer.domElement.onpointerdown = event => { down = [event.clientX, event.clientY]; };
  function hitAt(event: MouseEvent | PointerEvent) {
    if (!acousticAsset()) return undefined;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    scene.updateMatrixWorld(true);
    return raycaster.intersectObjects(markers.children).find(hit => visibleInHierarchy(hit.object) && unclipped(hit.point));
  }
  renderer.domElement.onpointerup = event => {
    if(driving?.cabin)return;
    if (event.button !== 0 || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
    if (showroomActive && (editMode || fieldMode === 'off')) {
      const signalHit = hitAt(event); if (!editMode && hardwareVisible() && signalHit) { callbacks.select(signalHit.object.userData.selection); return; }
      if ((config?.vehicle !== 'ice' && !showroomModel?.assetId.startsWith('xpeng-')) || !showroomModel?.parts.length) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = showroomModel.inspection.pick(raycaster);
      if (editMode && hit) { const id = showroomModel.partForObject(hit.object); const physical = hit.point.clone(); const part = id ? showroomModel.group.getObjectByName(id) : null; if (part) physical.sub(part.position); callbacks.add(physical.toArray() as [number,number,number], id ?? undefined); return; }
      selectShowroomPart(hit ? showroomModel.partForObject(hit.object) : null);
      if (showroomSelected) inspectionPanel.open = true;
      return;
    }
    const marker = hitAt(event);
    if (marker && !fieldFocus) { callbacks.select(marker.object.userData.selection); return; }
    if (field.visible && frame && !editMode) {
      const planes = fieldSlice==='volume'?[{mesh:fieldDisplay.volume,sampleIndices:fieldPoints.map((_,i)=>i)}]:[...sliceMeshes.values()].filter(row=>row.mesh.visible);
      const hit = raycaster.intersectObjects(planes.map(row => row.mesh)).find(candidate => clipAxis === 'none' || clipPlane.distanceToPoint(candidate.point) >= -.0001);
      if (hit) {
        const row = planes.find(item => item.mesh === hit.object)!;
        probeIndex = row.sampleIndices.reduce((best, sample) => {
          const point = new THREE.Vector3(...fieldPoints[sample]); point.y += field.position.y;
          const bestPoint = new THREE.Vector3(...fieldPoints[best]); bestPoint.y += field.position.y;
          return point.distanceToSquared(hit.point) < bestPoint.distanceToSquared(hit.point) ? sample : best;
        }, row.sampleIndices[0]);
        paintField(); return;
      }
    }
    if (model) {
      const hits = raycaster.intersectObject(model.group, true).filter(hit => visibleInHierarchy(hit.object) && unclipped(hit.point));
      const owner = (object: THREE.Object3D) => {
        for (let current: THREE.Object3D | null = object; current && current !== model?.group; current = current.parent) {
          const part = partByName.get(current.name); if (part && part.object === current) return part;
        }
        return undefined;
      };
      const hit = editMode ? hits[0] : hits.find(candidate => body === 'solid' || owner(candidate.object)?.category !== 'shell') ?? hits[0];
      if (hit) {
        const part = owner(hit.object);
        if (editMode) {
          const physical = hit.point.clone(); if (part) physical.sub(part.offset.clone().multiplyScalar(partProgress.get(part.object.name) ?? amount));
          callbacks.add(physical.toArray() as [number, number, number], part?.object.name);
        } else if (part) showGuide(part);
      }
    }
  };
  renderer.domElement.oncontextmenu = event => { event.preventDefault(); const hit = hitAt(event); if (hit) callbacks.context(hit.object.userData.selection, event.clientX, event.clientY); };
  const pageCameras = new Map<string, {asset: string; position: Vec3; target: Vec3; fov: number; stage: StageMode; compact: boolean}>();
  function focusPresentationCamera() {
    const compact=host.clientWidth<1000,page=host.dataset.presentationPage;
    camera.clearViewOffset();
    if(page==='overview'&&!compact)camera.setViewOffset(host.clientWidth,host.clientHeight,host.clientWidth*.04,host.clientHeight*.075,host.clientWidth,host.clientHeight);
    if(page==='field'){
      // Side/front three-quarter view leaves the right glass panel clear while
      // exposing the whole cabin; the physical model and field stay together.
      if(!compact)camera.setViewOffset(host.clientWidth,host.clientHeight,host.clientWidth*.16,0,host.clientWidth,host.clientHeight);
      const fit=compact?Math.max(1,host.clientHeight/Math.max(1,host.clientWidth)):1;
      focusCamera(compact?[-7.2*fit,.92+2.58*fit,5.8*fit]:[-6.6,2.75,4.6],[0,fit>1?1.5:.92,0],compact?39:36);return;
    }
    if(page==='overview'){focusCamera(compact?[-7.6,2.9,9.2]:[-7.6,1.9,9.9],compact?[0,1.0,0]:[1.9,.45,1.0],compact?38:35);return;}
    focusCamera(compact?[7.4,3.1,8.2]:[6.7,2.6,7.6],compact?[0,1.15,0]:[.75,.3,-.55]);
  }
  let presentationCompact=host.clientWidth<1000;
  let wasNarrow = host.clientWidth < 600;
  let wasP7Compact = host.clientWidth < 900;
  function updateDrawingResolution() {
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    // Gallery prioritises still-scene detail. Keep native pixels on very large screens;
    // supersampling uses the 8.4 MP budget, and driving retains its 1.5x policy.
    const pixelRatio=Math.min(Math.max(stage.mode==='gallery'?2:1.5,window.devicePixelRatio||1),2,Math.max(1,Math.sqrt(8_400_000/(width*height))));
    if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width,height,false);stage.gallery.resize(width,height);
    host.dataset.renderResolution=`${renderer.domElement.width}x${renderer.domElement.height}`;
  }
  function resizeViewer() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    const isNarrow = width < 600;
    const fieldNarrowChanged = isNarrow !== wasNarrow;
    if (isNarrow && !wasNarrow) { assemblyPanel.open = false; showroomAssemblyPanel.open = false; }
    wasNarrow = isNarrow;
    if (width < 900 && !wasP7Compact && showroomActive && showroomModel?.assetId === 'xpeng-p7plus') showroomAssemblyPanel.open = false;
    wasP7Compact = width < 900;
    updateDrawingResolution();
    camera.aspect = width / height;
    if(host.dataset.presentationPage==='overview'&&stage.mode==='gallery'){
      if(width>=1000)camera.setViewOffset(width,height,width*.04,height*.075,width,height);
      else camera.clearViewOffset();
    }
    if(host.dataset.presentationPage==='field'&&stage.mode==='gallery'){
      if(width>=1000)camera.setViewOffset(width,height,width*.16,0,width,height);
      else camera.clearViewOffset();
    }
    if (passengerFocus) {
      if (width >= 1000 && host.closest('.cp-app')?.getAttribute('data-passenger-panel') === 'open') camera.setViewOffset(width,height,width*.12,0,width,height);
      else camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    if(presentationCompact!==(width<1000)&&stage.mode==='road')driving?.focus();
    if(!passengerFocus&&(presentationCompact!==(width<1000)||(fieldNarrowChanged&&host.dataset.presentationPage==='field'))&&host.dataset.presentationPage&&stage.mode==='gallery'&&showroomClipAxis==='none'){focusPresentationCamera();}
    presentationCompact=width<1000;
  }
  const resize = new ResizeObserver(resizeViewer); resize.observe(host);
  window.addEventListener('resize', resizeViewer);
  function reset() {
    pageCameras.clear();
    if (showroomActive) {
      showroomDetached.clear(); showroomAuto = null; showroomSelected = null;
      setShowroomBody('solid'); setShowroomSection('none', 0);
      focusStageCamera(); refreshShowroomAssembly(); return;
    }
    focusStageCamera(); exploded = false; detached.clear(); autoAssembly = null; refreshAssembly();
  }
  function focusSection(axis: string) {
    const views: Record<string, { position: Vec3; target: Vec3 }> = {
      x: { position: [-6.2, 2.0, 0], target: [0, 1.05, 0] },
      y: { position: [0, -5.3, 4.4], target: [0, 1.06, 0] },
      z: { position: [0, 1.7, -6.8], target: [0, 1.05, 0.1] },
    };
    const view = views[axis]; if (!view) return;
    focusCamera(view.position,view.target);
  }
  driving=createDrivingView(host,scene,camera,renderer,controls,{
    focus:focusCamera,model:()=>showroomActive?showroomModel:null,
    body:solid=>{if(showroomModel)setShowroomBody(solid?'solid':'transparent');},
    road:()=>{stage.setMode('road');applyStage();},
    inspect:()=>{stage.setMode('road');applyStage();fieldMode=fieldMode==='off'?'residual':fieldMode;setShowroomBody('transparent');host.dispatchEvent(new CustomEvent('driving-field-inspect',{bubbles:true}));},
    assemble:()=>{showroomDetached.clear();showroomAuto=null;showroomProgress.clear();showroomModel?.parts.forEach(p=>showroomModel!.setPartProgress(p.id,0));showroomModel?.inspection.select(null);setShowroomSection('none',0);},
  });
  applyStage(); reset();
  if (['#xpeng', '#p7plus'].includes(window.location.hash)) queueMicrotask(() => { if (!disposed) void enterShowroom(window.location.hash === '#p7plus' ? 'p7plus' : 'x9'); });
  return {
    get passengerSeats() { return passengers.seats; },
    get passengerAsset() { return passengers.assetId; },
    get passengerQuality() { return passengers.quality; },
    setPassengers(value: PassengerAssignments) { passengers.setAssignments(value); host.dataset.passengers = JSON.stringify(value); },
    setPassengersVisible(value: boolean) { passengers.setVisible(value); host.dataset.passengersVisible = String(value); },
    focusPassengers(seatId?: string) {
      if (!showroomActive || !passengers.seats.length) return;
      const point = seatId ? passengers.position(seatId) : null;
      stage.setMode('gallery'); applyStage(); setShowroomSection('none', 0); setShowroomBody('hidden');
      camera.clearViewOffset();
      if (host.clientWidth >= 1000 && host.closest('.cp-app')?.getAttribute('data-passenger-panel') === 'open') camera.setViewOffset(host.clientWidth, host.clientHeight, host.clientWidth * .12, 0, host.clientWidth, host.clientHeight);
      if (point) focusCamera([point.x + 1.0, point.y + .70, point.z + 1.8], [point.x, point.y + .32, point.z], 38);
      else focusCamera([-3.8, 2.7, 4.5], [0, .94, -.38], 37);
      controls.minDistance = .38; passengerFocus = true;
    },
    get fieldPoints() { return fieldPoints; }, setConfig, reset,
    get acousticAvailable() { return acousticAsset(); },
    get hasValidField() { return !!frame?.valid && acousticAsset(); },
    previewReading(seat: number) {
      if(!config || !frame || !acousticAsset() || !fieldFrameMatchesPoints(frame,fieldPoints))return null;
      const point=micAnchor(seat).origin;
      let nearest=0,distance=Infinity;
      frame.points.forEach((p,i)=>{const d=p.reduce((sum,v,axis)=>sum+(v-point[axis])**2,0);if(d<distance){distance=d;nearest=i;}});
      return {time:frame.time,weighting:frame.weighting,primary:frame.primarySpl[nearest],residual:frame.residualSpl[nearest],reduction:frame.reductionDb[nearest]};
    },
    renderPreview(canvas: HTMLCanvasElement, top = false, acoustic = false, detail: 'vehicle' | 'paths' | 'layout' = 'vehicle', fieldView?: { quantity: FieldQuantity; slice: 'volume' | SliceAxis }) {
      if (!showroomModel || !showroomActive) return;
      const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio();
      const saved = scene.children.map(object => [object,object.visible] as const), background = scene.background;
      const oldBody = inspectionBody.value as AssetBodyMode;
      const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
      const overlay=new THREE.Group();
      const previewMaterials:THREE.Material[]=[],previewGeometries:THREE.BufferGeometry[]=[];
      const bead=(point:THREE.Vector3,color:string,r=.062)=>{
        const g=new THREE.SphereGeometry(r,12,8),m=new THREE.MeshBasicMaterial({color,depthTest:false});
        const mesh=new THREE.Mesh(g,m);mesh.position.copy(point);mesh.renderOrder=10;overlay.add(mesh);previewMaterials.push(m);previewGeometries.push(g);
      };
      try {
        scene.children.forEach(object => { if (!(object instanceof THREE.Light) && object !== showroomModel!.group) object.visible = false; });
        // Transparent off-screen preview preserves the glass panel behind the model.
        scene.background = null;renderer.setClearColor(0,0);
        if (top&&!acoustic) showroomModel.inspection.setBody('hidden');
        else if(acoustic || detail==='paths') showroomModel.inspection.setBody('transparent');
        if(acoustic && frame?.valid && acousticAsset()) field.visible=true;
        if(top&&!acoustic || detail==='layout') markerRows.filter(row=>!row.source).forEach(row=>{
          const color=row.selection.signal==='x'?'#e5a03b':row.selection.signal==='e'?'#2285e0':'#e44c48';
          const point=row.mesh.position.clone();point.y=1.95;bead(point,'#ffffff',.085);bead(point.clone().add(new THREE.Vector3(0,.012,0)),color,.059);
        });
        if(detail==='paths'){
          const sources=markerRows.filter(row=>row.source);
          sources.forEach((row,i)=>{
            const start=row.mesh.position.clone(),end=new THREE.Vector3(start.x*.45,1.04,start.z*.45);
            const curve=new THREE.CatmullRomCurve3([start,new THREE.Vector3(start.x,.5,start.z*.6),end]);
            const g=new THREE.TubeGeometry(curve,24,.025,6,false),m=new THREE.MeshBasicMaterial({color:i<2?'#eda83b':'#4c98eb',transparent:true,opacity:.9,depthTest:false});
            overlay.add(new THREE.Mesh(g,m));previewGeometries.push(g);previewMaterials.push(m);bead(start,'#ffd166',.08);
          });
        }
        scene.add(overlay);
        const width=fieldView?640:960,height=fieldView?260:top||detail==='paths'?430:480;
        const previewCamera = new THREE.PerspectiveCamera(31,width/height, .05,100);
        previewCamera.position.set(...(top ? [0,6.6,.01] : [-4.7,2.65,5.4]) as [number,number,number]); if(top) previewCamera.up.set(1,0,0); previewCamera.lookAt(0,.8,0);previewCamera.zoom=top?1.25:1.45;previewCamera.updateProjectionMatrix();
        if(fieldView?.slice==='x'){previewCamera.position.set(7.8,1.25,.01);previewCamera.up.set(0,1,0);previewCamera.zoom=1.1;previewCamera.lookAt(0,.9,0);previewCamera.updateProjectionMatrix();}
        if(fieldView?.slice==='z'){previewCamera.position.set(.01,1.3,6.4);previewCamera.up.set(0,1,0);previewCamera.zoom=.82;previewCamera.lookAt(0,.9,0);previewCamera.updateProjectionMatrix();}
        renderer.setPixelRatio(1); renderer.setSize(width,height,false);
        if(acoustic&&frame?.valid&&acousticAsset())fieldDisplay.renderSnapshot(()=>{
          previewOcclusion.render(renderer,showroomModel!.group,previewCamera);
          fieldDisplay.setOcclusion(previewOcclusion.texture,previewOcclusion.size,previewCamera);
          renderer.render(scene,previewCamera);
        },fieldView);
        else renderer.render(scene,previewCamera);
        canvas.width=width;canvas.height=height;canvas.getContext('2d')!.drawImage(renderer.domElement,0,0);
        if(fieldView&&frame){canvas.dataset.fieldTime=String(frame.time);canvas.dataset.fieldQuantity=fieldView.quantity;canvas.dataset.fieldSlice=fieldView.slice;canvas.dataset.fieldAsset=showroomModel.assetId;canvas.dataset.fieldWeighting=frame.weighting??'Z';}
      } finally {
        fieldDisplay.setOcclusion(null);
        overlay.removeFromParent();previewGeometries.forEach(g=>g.dispose());previewMaterials.forEach(m=>m.dispose());
        showroomModel.inspection.setBody(oldBody); scene.background=background;renderer.setClearColor(clearColor,clearAlpha); saved.forEach(([object,visible])=>object.visible=visible);
        renderer.setPixelRatio(ratio); renderer.setSize(size.x,size.y,false);
      }
    },
    get displayAsset() { return showroomActive ? showroomModel?.assetId ?? 'loading' : 'teaching-fixed-v1'; },
    async showVehicle(id: 'teaching' | XPengId) { if (id === 'teaching') leaveShowroom(); else await enterShowroom(id); },
    setPresentationPaint(color: string) { showroomModel?.setPaint(color); },
    setStage(mode: StageMode) { stage.setMode(mode); applyStage(); if(mode==='gallery'&&fieldMode!=='off'&&host.dataset.presentationPage!=='overview')setShowroomBody('transparent'); focusStageCamera(); },
    setRoadSurface(surface: RoadSurface) { stage.setRoadSurface(surface); refreshRoadSurface(); callbacks.roadPreset?.(surface, { smooth: .6, coarse: 1.2, gravel: 2.2 }[surface]); },
    setEnvironment(value: GalleryEnvironment) { stage.gallery.setEnvironment(value); if(stage.mode!=='road')stage.setMode('gallery'); applyStage(); },
    setPresentationView(page: string) {
      const previous=host.dataset.presentationPage, asset=showroomModel?.assetId??'teaching';
      if(previous===page){if(stage.mode==='gallery')focusPresentationCamera();return;}
      if(previous)pageCameras.set(previous,{asset,position:camera.position.toArray() as Vec3,target:controls.target.toArray() as Vec3,fov:camera.fov,stage:stage.mode,compact:host.clientWidth<1000});
      host.dataset.presentationPage = page; paintField();
      camera.clearViewOffset();if(page==='overview'&&host.clientWidth>=1000)camera.setViewOffset(host.clientWidth,host.clientHeight,host.clientWidth*.04,host.clientHeight*.075,host.clientWidth,host.clientHeight);
      const saved=pageCameras.get(page);
      if(saved?.asset===asset&&saved.compact===(host.clientWidth<1000)){stage.setMode(saved.stage);applyStage();focusCamera(saved.position,saved.target,saved.fov);return;}
      if (page === 'structure') { assemblyPanel.open = showroomAssemblyPanel.open = host.clientWidth >= 900; }
      if(stage.mode==='road'){stage.setMode('gallery');applyStage();focusPresentationCamera();}
      else if (stage.mode === 'gallery') {
        focusPresentationCamera();
      }
    },
    setHardwareOverlay(value: boolean) { hardwareOverlay = value; },
    getMountIssues() { return mountIssues.map(issue => ({ ...issue })); },
    setExploded(value: boolean) {
      if (showroomActive && (config?.vehicle === 'ice' || showroomModel?.assetId.startsWith('xpeng-')) && showroomModel?.parts.length) {
        exploded = value;
        showroomDetached.clear(); if (value) showroomModel.parts.forEach(part => showroomDetached.add(part.id));
        showroomAuto = null; refreshShowroomAssembly();
        if(value) focusCamera([10.5,5.1,12.4],[0,-.4,0]); else focusStageCamera();
        return;
      }
      leaveShowroom(); exploded = value;
    },
    setBody(value: string) {
      if (showroomActive && (config?.vehicle === 'ice' || showroomModel?.assetId.startsWith('xpeng-')) && showroomModel?.parts.length && ['solid', 'transparent', 'hidden'].includes(value)) {
        body = value; applyBody();
        setShowroomBody(value as AssetBodyMode); return;
      }
      leaveShowroom();
      const leavingCabin = body === 'hidden' && value !== 'hidden' && camera.position.distanceTo(controls.target) < 3;
      body = value; controls.minDistance = value === 'hidden' ? 0.6 : 3; applyBody();
      if (leavingCabin) focusStageCamera();
      else if (value === 'hidden' && guideSelect.value === 'cockpit') focusCockpit();
    },
    setSection(axis: string, value: number) {
      if (showroomActive && (config?.vehicle === 'ice' || showroomModel?.assetId.startsWith('xpeng-')) && showroomModel?.parts.length) {
        clipAxis = axis; clipValue = value; syncFieldSampling(); applyClipping();
        setShowroomSection(axis as AssetSectionAxis, value); return;
      }
      leaveShowroom(); const changed = clipAxis !== axis; clipAxis = axis; clipValue = value; syncFieldSampling(); applyClipping(); paintField();
      if (changed) { if (axis === 'none') focusStageCamera(); else focusSection(axis); }
    },
    setEditMode(value: boolean) { if (value && !acousticAsset()) return; editMode = value; host.classList.toggle('editing', value); guideSelect.disabled = value; if (value) clearGuide(); },
    setWaves(value: boolean) { if (value && !acousticAsset()) return; waveVisible = value; applyClipping(); },
    setPaths(value: string) { if (value !== 'none' && !acousticAsset()) return; pathMode = value; pathFocusKey = ''; applyClipping(); },
    setField(mode: string, slice: 'volume' | 'x' | 'y' | 'z') {
      if (mode !== 'off' && !acousticAsset()) return;
      if (showroomActive && mode !== 'off' && stage.mode!=='road' && host.dataset.presentationPage!=='overview') setShowroomBody('transparent');
      const entering = fieldMode === 'off' && mode !== 'off';
      fieldMode = mode; fieldSlice = slice; probeIndex = null;
      if (entering) { fieldFocus = true; if(stage.mode!=='road')focusPresentationCamera(); }
      if (mode === 'off') {fieldFocus = false;driving?.clearOverlay();}
      refreshFieldFocus(); applyStage(); syncFieldSampling(); applyClipping(); paintField();
    },
    updateField(value: FieldFrame, animate = false) { animateField = animate; frame = value; paintField(); },
    render(time: number, selected: LabSelection, drives: number[], sourceValues: number[], playing = false) {
      const now = performance.now(), dt = Math.min(0.1, (now - lastTime) / 1000); lastTime = now;
      // Presentation easing uses the render clock; physics and driving retain the single playback time.
      fieldDisplay.advance(time, playing, now / 1000);
      passengers.animate(time, reducedMotion.matches);
      const targetAmount = exploded ? 1 : 0;
      amount += (targetAmount - amount) * (1 - Math.exp(-dt * 5));
      // Below 0.1 mm of displacement, snap to the exact pose so section geometry stops rebuilding.
      if (Math.abs(targetAmount - amount) < 1e-4) amount = targetAmount;
      if (autoAssembly && stage.mode !== 'road' && !showroomActive) {
        autoSeconds += dt;
        if (autoSeconds >= 0.75) { autoSeconds = 0; if (autoAssembly === 'detach') detachNext(); else attachLast(false); }
      }
      if (showroomAuto && showroomActive && stage.mode !== 'road') {
        showroomSeconds += dt;
        if (showroomSeconds >= 0.75) { showroomSeconds = 0; stepShowroomAssembly(showroomAuto); }
      }
      for (const part of showroomModel?.parts ?? []) {
        const target = showroomDetached.has(part.id) ? 1 : 0;
        let progress = showroomProgress.get(part.id) ?? 0;
        progress += (target - progress) * (1 - Math.exp(-dt * 5));
        if (Math.abs(target - progress) < 1e-4) progress = target;
        showroomProgress.set(part.id, progress);
        showroomModel?.setPartProgress(part.id, progress);
      }
      for (const part of model?.parts ?? []) {
        const target = exploded || detached.has(part.object.name) ? 1 : 0;
        let progress = partProgress.get(part.object.name) ?? 0;
        progress += (target - progress) * (1 - Math.exp(-dt * 5));
        if (Math.abs(target - progress) < 1e-4) progress = target;
        partProgress.set(part.object.name, progress);
        part.object.position.copy(part.origin).addScaledVector(part.offset, progress);
      }
      const distance=stage.mode==='road'?travelDistance(time,config?.speedKph??0):0;
      model?.wheels.forEach(wheel=>{wheel.rotation.x=distance/.4;});
      const routeBefore=sampleDrivingRoute(distance-.1),routeAfter=sampleDrivingRoute(distance+.1);
      const curvature=(Math.atan2(routeAfter.tangent.x,routeAfter.tangent.z)-Math.atan2(routeBefore.tangent.x,routeBefore.tangent.z))/.2;
      const wheelbase=config?labLayout(config).sources[0][2]-labLayout(config).sources[2][2]:3;
      const car=showroomModel?.group;
      if(car&&!wheelGroups.has(car))wheelGroups.set(car,car.children.filter(o=>o instanceof THREE.Group&&o.userData.rollingCenter) as THREE.Group[]);
      for(const wheel of car?wheelGroups.get(car)!:[]){
        let motion=rollingWheels.get(wheel);if(!motion){motion=createWheelMotion(wheel,new THREE.Vector3(...wheel.userData.rollingCenter as [number,number,number]),wheel.userData.rollingRadius);rollingWheels.set(wheel,motion);}
        motion.setDistance(distance);motion.setSteering(stage.mode==='road'&&wheel.userData.axleZ>0?Math.atan(wheelbase*curvature/(1-curvature*wheel.userData.rollingCenter[0])):0);
      }
      stripes.visible=false;
      stage.update(time,config?.speedKph??0,dt);
      if(stage.mode==='road'){
        const inverse=sampleDrivingRoute(distance).rotation.invert();
        key.position.set(4,7,5).applyQuaternion(inverse);fill.position.set(-5,4,-5).applyQuaternion(inverse);
        scene.environmentRotation.setFromQuaternion(inverse);
      }
      scene.environment = (stage.mode === 'gallery'||stage.mode==='road') && stage.gallery.environmentTexture ? stage.gallery.environmentTexture : environment.texture;
      driving?.update(time,config?.speedKph??0,stage.driving.ready,stage.driving.failed,Number(stage.road.userData.grade??0));
      host.dataset.routeGrade=String(stage.road.userData.grade??0);host.dataset.routeHeading=String(stage.road.userData.heading??0);
      const environmentReady=stage.gallery.group.userData.environmentReady as string;
      if(host.dataset.environmentReady!==environmentReady)host.dataset.environmentReady=environmentReady;
      if(host.dataset.environment!==stage.gallery.environment)host.dataset.environment=stage.gallery.environment;
      const environmentFailed=String(!!stage.gallery.group.userData.panoramaFailed);
      if(host.dataset.environmentFailed!==environmentFailed)host.dataset.environmentFailed=environmentFailed;
      markerRows.forEach(row => {
        displayPosition(row.anchor, row.mesh.position);
        const active = selected.channel === row.selection.channel && (selected.signal === row.selection.signal || ['d', 'a', 'e'].includes(selected.signal) && row.selection.signal === 'e');
        // Hold marker screen size near the camera instead of letting a headrest marker cover the cockpit.
        const distanceScale = Math.min(1, Math.max(0.08, camera.position.distanceTo(row.mesh.position) / 3));
        row.mesh.scale.setScalar(distanceScale * (row.source ? (active ? 1.4 : 1) * (1 + Math.min(0.35, Math.abs(sourceValues[row.selection.channel] ?? 0) * 0.1)) : active ? 1.4 : 1));
        row.button.setAttribute('aria-pressed', String(active));
      });
      updatePathFocus(selected);
      field.position.y = p7Layout() ? 0 : amount * 0.45;
      (contactShade.material as THREE.MeshBasicMaterial).opacity = clipAxis === 'none' ? 1 - amount * 0.8 : 0.12;
      markers.visible = hardwareVisible() && !fieldFocus;
      waves.visible = waveVisible && hardwareVisible() && !fieldFocus;
      waveRows.forEach(row => {
        const i = row.userData.speaker, phase = (time * 1.5 + row.userData.phase) % 1;
        displayPosition(speakerAnchor(i), row.position); row.scale.setScalar(0.12 + phase * 1.1);
        row.visible = !!config?.speakerEnabled[i] && Math.abs(drives[i] ?? 0) > 1e-8;
        (row.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * (field.visible ? 0.10 : 0.16);
      });
      paths.visible = pathMode !== 'none' && hardwareVisible() && !fieldFocus;
      if (!acousticAsset() || host.dataset.presentationPage === 'overview'||!driving?.fieldVisible) field.visible = false;
      else field.visible=fieldMode!=='off'&&!!frame&&fieldFrameMatchesPoints(frame,fieldPoints);
      pathRows.forEach((row, i) => {
        const visible = pathIsShown(row) && (!isolatePaths || !hasPathFocus || pathMatchesSelection(row, selected));
        row.line.visible = row.dot.visible = visible;
        displayPosition(row.start, row.from); displayPosition(row.end, row.to);
        const positions = row.line.geometry.getAttribute('position');
        positions.setXYZ(0, row.from.x, row.from.y, row.from.z); positions.setXYZ(1, row.to.x, row.to.y, row.to.z); positions.needsUpdate = true;
        row.dot.position.copy(row.from).lerp(row.to, (time * 0.7 + i * 0.08) % 1);
      });
      if (showroomActive) showroomModel?.inspection.update();
      else sections?.update(clipAxis === 'none' ? null : clipPlane);
      cameraMotion.update(reducedMotion.matches?Number.MAX_SAFE_INTEGER:now);
      host.dataset.cameraTransition=cameraMotion.active?'moving':'idle';
      if(controls.enabled){
        controls.dampingFactor=1-Math.exp(-Math.min(dt,.05)*9);
        controls.update();
        const outdoor=stage.mode!=='workshop';
        if(outdoor&&!driving?.cabin&&!passengerFocus&&!cameraMotion.active){
          constrainEnvironmentCamera(camera.position,controls.target,stage.mode,showroomModel?.assetId);
          camera.lookAt(controls.target);
        }
      }else camera.lookAt(controls.target);renderedOnce=true;
      host.dataset.cameraPosition=camera.position.toArray().map(v=>v.toFixed(3)).join(',');
      host.dataset.cameraTarget=controls.target.toArray().map(v=>v.toFixed(3)).join(',');
      const underfloor = camera.position.y < 0.1;
      stage.setUnderfloorView(underfloor); underfloorNote.hidden = !underfloor;
      stripes.visible = false; contactShade.visible = !underfloor;
      const occluder=showroomActive?showroomModel?.group:model?.group;
      renderer.info.reset();
      if(field.visible&&occluder){
        fieldOcclusion.render(renderer,occluder,camera);
        fieldDisplay.setOcclusion(fieldOcclusion.texture,fieldOcclusion.size,camera);
      }else fieldDisplay.setOcclusion(null);
      renderer.render(scene, camera);
      recordRender(now,`${showroomModel?.assetId}/${host.dataset.presentationPage}/${stage.mode}/${host.clientWidth}x${host.clientHeight}/${field.visible}`,renderer.info.render.calls,renderer.info.render.triangles);
      fieldDisplay.setOcclusion(null);
      const width = host.clientWidth, height = host.clientHeight;
      const visible = markerRows.map(row => {
        const p = row.mesh.position.clone().project(camera);
        const show = hardwareVisible() && !fieldFocus && p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && (clipAxis === 'none' || clipPlane.distanceToPoint(row.mesh.position) >= 0);
        row.button.hidden = !show; row.line.style.display = show ? '' : 'none';
        return { row, visible: show, x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height };
      }).filter(row => row.visible);
      const obstacles = readLabelObstacles(now);
      const positions = placeLabLabels(visible, width, height, obstacles);
      visible.forEach(({ row, x, y }, i) => {
        const position = positions[i]; row.button.hidden = !!position.hidden;
        row.button.style.left = `${position.x}px`; row.button.style.top = `${position.y}px`;
        // Never draw a leader across an opaque panel to an invisible anchor.
        const occluded = obstacles.some(r => x >= r.x && x <= r.x+r.width && y >= r.y && y <= r.y+r.height);
        row.line.style.display = position.hidden || occluded ? 'none' : '';
        row.line.style.opacity = row.button.getAttribute('aria-pressed') === 'true' ? '.85' : '.36';
        row.line.setAttribute('x1', String(x)); row.line.setAttribute('y1', String(y));
        row.line.setAttribute('x2', String(Math.max(position.x, Math.min(position.x + 64, x))));
        row.line.setAttribute('y2', String(Math.max(position.y, Math.min(position.y + 24, y))));
      });
    },
    dispose() { disposed = true; passengers.dispose(); passengerAssets.dispose(); ++showroomRequest; resize.disconnect(); window.removeEventListener('resize', resizeViewer); driving?.dispose(); controls.dispose(); sections?.dispose(); model?.dispose(); showroomModel?.dispose(); stage.dispose(); clear(markers); clear(paths); clear(waves); fieldOcclusion.dispose(); previewOcclusion.dispose(); cabinLegend.remove(); fieldDisplay.dispose(); clear(field); clear(stripes); ground.geometry.dispose(); ground.material.dispose(); contactShade.geometry.dispose(); shadowTexture.dispose(); environment.dispose(); renderer.dispose(); markerRows.forEach(row => { row.button.remove(); row.line.remove(); }); guidePicker.remove(); guideCard.remove(); fieldNote.remove(); fieldHud.remove(); fieldFocusButton.remove(); pathFocusNote.remove(); showroomToggle.remove(); xpengLaunch.remove(); showroomPanel.remove(); showroomAssemblyPanel.remove(); stageBar.remove(); underfloorNote.remove(); roadSurfaceBar.remove(); assemblyPanel.remove(); leaders.remove(); renderer.domElement.remove(); },
  };
}
