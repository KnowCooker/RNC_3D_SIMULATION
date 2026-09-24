import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createVehicleModel, type VehiclePart } from './vehicle-model';
import type { ShowroomModel } from './showroom-model';
import { createSectionDisplay } from './section-display';
import { MIC_POSITIONS, SOURCE_POSITIONS, SPEAKER_POSITIONS, type FieldFrame, type LabConfig, type LabSelection, type Vec3 } from '../../shared/lab-contracts';
import { placeLabLabels } from './labels';
import { describeVehiclePart, featuredVehicleParts } from './part-guide';
import { createFieldPoints, createFieldPointsForSlice, createFieldSliceTopology, fieldFrameMatchesPoints, type SliceAxis } from './field-slices';
import './viewer.css';

export function createLabViewer(host: HTMLElement, callbacks: {
  select(selection: LabSelection): void;
  add(position: Vec3, mountPart?: string): void;
  context(selection: LabSelection, x: number, y: number): void;
}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#101a25');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.08, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace; host.append(renderer.domElement);
  const leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leaders.classList.add('lab-marker-leaders'); leaders.setAttribute('aria-hidden', 'true'); host.append(leaders);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  const environmentRoom = new RoomEnvironment(), environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environment = environmentGenerator.fromScene(environmentRoom, 0.04);
  scene.environment = environment.texture; scene.environmentIntensity = 0.7;
  environmentRoom.dispose(); environmentGenerator.dispose();
  renderer.domElement.setAttribute('aria-label', '可旋转、剖切、改制的车辆三维视图');
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 16;
  // Allow a real user orbit under the vehicle to inspect the battery, exhaust and axles.
  controls.maxPolarAngle = Math.PI * 0.84;
  scene.add(new THREE.HemisphereLight('#e3f2ff', '#283643', 1.4));
  const key = new THREE.DirectionalLight('#fff2db', 2.4); key.position.set(4, 7, 5); scene.add(key);
  const fill = new THREE.DirectionalLight('#7cb6ff', 1.1); fill.position.set(-5, 4, -5); scene.add(fill);
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
  let model: ReturnType<typeof createVehicleModel> | null = null;
  let sections: ReturnType<typeof createSectionDisplay> | null = null;
  let mountIssues: { sensorId: string; mountPart: string }[] = [];
  let config: LabConfig | null = null, signature = '';
  let exploded = false, amount = 0, lastTime = performance.now();
  let body = 'transparent', editMode = false, waveVisible = false, pathMode = 'none';
  let fieldMode = 'off', fieldSlice: 'volume' | 'x' | 'y' | 'z' = 'volume';
  let clipAxis = 'none', clipValue = 0;
  const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  const markers = new THREE.Group(), paths = new THREE.Group(), waves = new THREE.Group(), field = new THREE.Group();
  scene.add(markers, paths, waves, field);
  type Anchor = { origin: Vec3; mountPart?: string };
  const corners = ['fl', 'fr', 'rl', 'rr'];
  const partByName = new Map<string, VehiclePart>();
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
  function focusCamera(position: Vec3, target: Vec3) {
    const damping = controls.enableDamping; controls.enableDamping = false; controls.update();
    camera.position.set(...position); controls.target.set(...target);
    controls.update(); controls.enableDamping = damping;
  }
  function focusCockpit() { focusCamera([0.05, 1.85, -0.25], [0.1, 1.25, 1.15]); }
  let showroomModel: ShowroomModel | null = null;
  let showroomActive = false, showroomRequest = 0, disposed = false;
  const showroomToggle = document.createElement('button');
  showroomToggle.type = 'button'; showroomToggle.className = 'lab-showroom-toggle';
  showroomToggle.textContent = '写实外观'; showroomToggle.setAttribute('aria-label', '打开写实 SUV 外观范例');
  const showroomPanel = document.createElement('aside');
  showroomPanel.className = 'lab-showroom-panel'; showroomPanel.hidden = true;
  showroomPanel.innerHTML = '<strong>写实 SUV 外观范例</strong><p>此车仅供外观与材质欣赏；四类动力结构、声学点位和剖面请返回教学模型查看。</p><div class="lab-showroom-views" aria-label="外观视角"></div><div class="lab-showroom-colors" aria-label="车漆颜色"></div><a href="https://sketchfab.com/3d-models/land-rover-range-rover-sport-svr-5462d65acb0e4dca8c20da82360261db" target="_blank" rel="noopener noreferrer">模型：Mona x Supercars · CC BY 4.0</a>';
  const showroomViews = showroomPanel.querySelector('.lab-showroom-views')!;
  for (const [label, position] of [
    ['前侧', [4.6, 2.45, 4.6]], ['侧面', [5.7, 2, 0]], ['后侧', [4.6, 2.45, -4.6]],
  ] as [string, Vec3][]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.onclick = () => focusCamera(position, [0, 0.85, 0]); showroomViews.append(button);
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
  host.append(showroomToggle, showroomPanel);
  function leaveShowroom() {
    ++showroomRequest;
    if (!showroomActive) {
      showroomToggle.disabled = false; showroomToggle.textContent = '写实外观';
      return;
    }
    showroomActive = false;
    showroomPanel.hidden = true; showroomToggle.textContent = '写实外观';
    showroomToggle.setAttribute('aria-label', '打开写实 SUV 外观范例');
    scene.background = new THREE.Color('#101a25');
    scene.environmentIntensity = 0.7; renderer.toneMappingExposure = 0.95;
    (ground.material as THREE.MeshStandardMaterial).color.set('#1b2832');
    ground.scale.set(1, 1, 1);
    stripes.visible = true;
    if (model) model.group.visible = true;
    if (sections) sections.group.visible = true;
    if (showroomModel) showroomModel.group.visible = false;
    guidePicker.style.display = ''; guideCard.style.display = '';
    fieldNote.style.display = ''; pathFocusNote.style.display = '';
    paintField(); reset();
  }
  showroomToggle.onclick = async () => {
    if (showroomActive) { leaveShowroom(); return; }
    const request = ++showroomRequest;
    showroomToggle.disabled = true; showroomToggle.textContent = '加载外观…';
    try {
      if (!showroomModel) {
        const loaded = await (await import('./showroom-model')).loadShowroomModel();
        if (disposed) { loaded.dispose(); return; }
        showroomModel = loaded; showroomModel.group.visible = false; scene.add(showroomModel.group);
        showroomModel.setPaint('#18202a');
        showroomColors.querySelectorAll('button')[2].setAttribute('aria-pressed', 'true');
      }
      if (request !== showroomRequest || disposed) return;
      showroomActive = true;
      showroomModel.group.visible = true;
      if (model) model.group.visible = false;
      if (sections) sections.group.visible = false;
      scene.background = new THREE.Color('#d7dfe4');
      scene.environmentIntensity = 1; renderer.toneMappingExposure = 1.2;
      (ground.material as THREE.MeshStandardMaterial).color.set('#bbc7ce');
      ground.scale.set(10, 3, 1);
      stripes.visible = false;
      guidePicker.style.display = 'none'; guideCard.style.display = 'none';
      fieldNote.style.display = 'none'; pathFocusNote.style.display = 'none';
      showroomPanel.hidden = false; showroomToggle.textContent = '返回结构实验';
      showroomToggle.setAttribute('aria-label', '返回四类动力教学模型和声学实验');
      focusCamera([4.6, 2.45, 4.6], [0, 0.85, 0]);
    } catch (error) {
      showroomToggle.textContent = '外观加载失败 · 重试';
      showroomToggle.title = error instanceof Error ? error.message : String(error);
    } finally { if (!disposed) showroomToggle.disabled = false; }
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
  const sourceAnchor = (i: number): Anchor => ({ origin: SOURCE_POSITIONS[i], mountPart: `wheel-${corners[i]}` });
  const speakerAnchor = (i: number): Anchor => ({ origin: SPEAKER_POSITIONS[i], mountPart: `door-${i < 2 ? 'front' : 'rear'}-${i % 2 === 0 ? 1 : -1}` });
  const micAnchor = (i: number): Anchor => ({ origin: MIC_POSITIONS[i], mountPart: `seat-${[1, 2, 3, 5][i]}` });
  const markerRows: { mesh: THREE.Mesh; button: HTMLButtonElement; line: SVGLineElement; selection: LabSelection; source: boolean; anchor: Anchor }[] = [];
  const waveRows: THREE.Mesh[] = [];
  const pathRows: { line: THREE.Line; dot: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; start: Anchor; end: Anchor; primary: boolean; channel: number; mic: number }[] = [];
  let fieldPoints = createFieldPoints();
  const fieldMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.48, depthWrite: false });
  const fieldMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 8, 6), fieldMaterial, fieldPoints.length);
  fieldMesh.frustumCulled = false; field.add(fieldMesh); field.visible = false;
  const sliceMaterials: THREE.MeshBasicMaterial[] = [];
  const sliceMeshes = new Map<SliceAxis, { mesh: THREE.Mesh; sampleIndices: number[] }>();
  for (const axis of ['x', 'y', 'z'] as const) {
    const topology = createFieldSliceTopology(axis, fieldPoints);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(topology.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(topology.sampleIndices.length * 3), 3));
    geometry.setIndex(topology.triangles);
    // An explanatory see-through overlay: the sampled plane must remain readable inside opaque seats and chassis.
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.52, depthTest: false, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 4;
    field.add(mesh); sliceMeshes.set(axis, { mesh, sampleIndices: topology.sampleIndices }); sliceMaterials.push(material);
  }
  const fieldNote = document.createElement('div'); fieldNote.className = 'lab-field-interpolation-note'; fieldNote.hidden = true;
  const fieldNoteDetail = document.createElement('span'); fieldNoteDetail.className = 'lab-field-note-detail';
  const fieldNoteCompact = document.createElement('span'); fieldNoteCompact.className = 'lab-field-note-compact';
  fieldNote.append(fieldNoteDetail, fieldNoteCompact); host.append(fieldNote);
  const pathFocusNote = document.createElement('div'); pathFocusNote.className = 'lab-path-focus-note'; pathFocusNote.hidden = true;
  const pathFocusDetail = document.createElement('span'); pathFocusDetail.className = 'lab-path-focus-detail';
  const pathFocusCompact = document.createElement('span'); pathFocusCompact.className = 'lab-path-focus-compact';
  pathFocusNote.append(pathFocusDetail, pathFocusCompact); host.append(pathFocusNote);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  let frame: FieldFrame | null = null;
  let pathFocusKey = '';

  function displayPosition(anchor: Anchor, target: THREE.Vector3) {
    target.set(...anchor.origin);
    const part = anchor.mountPart ? partByName.get(anchor.mountPart) : undefined;
    if (part) target.addScaledVector(part.offset, amount);
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
    const layered = waveVisible || pathMode !== 'none';
    fieldMaterial.opacity = clipAxis === 'none' ? (layered ? 0.36 : 0.48) : 0.18;
    sliceMaterials.forEach(material => { material.opacity = clipAxis === 'none' ? (layered ? 0.44 : 0.52) : 0.32; });
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
    if (config && config.vehicle !== next.vehicle) leaveShowroom();
    config = structuredClone(next);
    const key = JSON.stringify([next.vehicle, next.references, next.speakerEnabled]);
    if (key === signature) return;
    signature = key;
    frame = null; paintField();
    if (sections) { scene.remove(sections.group); sections.dispose(); }
    if (model) { scene.remove(model.group); model.dispose(); }
    model = createVehicleModel(next.vehicle); scene.add(model.group);
    sections = createSectionDisplay(model.group); scene.add(sections.group);
    partByName.clear(); model.parts.forEach(part => partByName.set(part.object.name, part));
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
      const corner = SOURCE_POSITIONS.findIndex(p => Math.abs(p[0] * 0.85 - sensor.position[0]) < 1e-6 && Math.abs(p[2] - sensor.position[2]) < 1e-6 && Math.abs(sensor.position[1] - 0.67) < 1e-6);
      const mountPart = sensor.mountPart ?? (corner >= 0 ? `suspension-${corners[corner]}` : 'chassis');
      const missing = !!sensor.mountPart && !partByName.has(sensor.mountPart);
      if (missing) mountIssues.push({ sensorId: sensor.id, mountPart: sensor.mountPart! });
      addMarker({ origin: sensor.position, mountPart }, { signal: 'x', channel: i }, `${sensor.name}${missing ? ' · 安装件缺失' : ''}`, missing ? '#fa8d70' : '#f8c26e');
    });
    SPEAKER_POSITIONS.forEach((_, i) => addMarker(speakerAnchor(i), { signal: 'u', channel: i }, `OUT ${i + 1}${next.speakerEnabled[i] ? '' : ' 停用'}`, next.speakerEnabled[i] ? '#6ab8ff' : '#687583'));
    MIC_POSITIONS.forEach((_, i) => addMarker(micAnchor(i), { signal: 'e', channel: i }, `MIC ${corners[i].toUpperCase()}`, '#75e3bc'));
    SOURCE_POSITIONS.forEach((_, i) => addMarker(sourceAnchor(i), { signal: 'q', channel: i }, `Q${i + 1}`, '#d4a3ff', true));
    SPEAKER_POSITIONS.forEach((p, i) => {
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
    applyBody(); applyClipping();
  }
  function movingFieldSlice() { return fieldSlice !== 'volume' && clipAxis === fieldSlice && Number.isFinite(clipValue); }
  function syncFieldSampling() {
    const next = movingFieldSlice() ? createFieldPointsForSlice(fieldSlice as SliceAxis, clipValue) : createFieldPoints();
    if (fieldPoints.every((point, i) => point.every((coordinate, component) => coordinate === next[i][component]))) return;
    fieldPoints = next;
    // An old physical position must never retain its colour while a new field query is pending.
    frame = null;
    for (const [axis, row] of sliceMeshes) {
      const topology = createFieldSliceTopology(axis, fieldPoints);
      const positions = row.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      (positions.array as Float32Array).set(topology.positions);
      positions.needsUpdate = true;
    }
  }
  function paintField() {
    const valid = fieldMode !== 'off' && !!frame && fieldFrameMatchesPoints(frame, fieldPoints);
    field.visible = valid;
    if (!valid || !frame) {
      fieldNote.hidden = fieldMode === 'off' || fieldSlice === 'volume' || (!movingFieldSlice() && !frame?.valid);
      if (!fieldNote.hidden) {
        fieldNoteDetail.textContent = frame?.valid ? '空间采样点与模型不匹配，已隐藏声场'
          : frame ? '当前车身剖面暂无有效声场' : '当前车身剖面声场待查询，旧位置色片已隐藏';
        fieldNoteCompact.textContent = frame?.valid ? '采样点不匹配，声场已隐藏'
          : frame ? '当前剖面暂无有效场' : '当前剖面场待更新';
      }
      return;
    }
    fieldNote.hidden = fieldSlice === 'volume';
    const values = fieldMode === 'primary' ? frame.primarySpl : frame.residualSpl;
    fieldMesh.visible = fieldSlice === 'volume';
    if (fieldMesh.visible) {
      fieldPoints.forEach((p, i) => {
        matrix.makeScale(1, 1, 1); matrix.setPosition(...p); fieldMesh.setMatrixAt(i, matrix);
        const scalar = Math.max(0, Math.min(1, (values[i] - 30) / 50));
        color.setHSL((1 - scalar) * 0.65, 0.86, 0.54); fieldMesh.setColorAt(i, color);
      });
      fieldMesh.instanceMatrix.needsUpdate = true; if (fieldMesh.instanceColor) fieldMesh.instanceColor.needsUpdate = true;
    }
    for (const [axis, row] of sliceMeshes) {
      row.mesh.visible = fieldSlice === axis;
      if (!row.mesh.visible) continue;
      const colors = row.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
      row.sampleIndices.forEach((sample, i) => {
        const scalar = Math.max(0, Math.min(1, (values[sample] - 30) / 50));
        color.setHSL((1 - scalar) * 0.65, 0.86, 0.54); colors.setXYZ(i, color.r, color.g, color.b);
      });
      colors.needsUpdate = true;
    }
    if (!fieldNote.hidden) {
      const axis = fieldSlice as SliceAxis, sample = sliceMeshes.get(axis)!.sampleIndices[0];
      const coordinate = fieldPoints[sample][{ x: 0, y: 1, z: 2 }[axis]];
      const provenance = movingFieldSlice() ? '当前车身剖面真实采样切片' : '固定采样切片 · 车身剖面另行移动';
      fieldNoteDetail.textContent = `${fieldMode === 'primary' ? '原噪声' : '残余声'} ${axis.toUpperCase()}=${coordinate.toFixed(2)} m ${provenance} · 三角插值/透视叠层 · 30–80 dB SPL`;
      fieldNoteCompact.textContent = `${fieldMode === 'primary' ? '原声' : '残余'} ${axis.toUpperCase()}=${coordinate.toFixed(2)}m ${movingFieldSlice() ? '当前剖面真实采样' : '固定场片；车身剖面另移'}`;
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
    const key = `${selected.signal}:${selected.channel}:${pathMode}:${config?.speakerEnabled.join(',')}`;
    if (key === pathFocusKey) return;
    pathFocusKey = key;
    pathFocusNote.hidden = pathMode === 'none';
    if (pathFocusNote.hidden) return;
    const shown = pathRows.filter(pathIsShown), focused = shown.filter(row => pathMatchesSelection(row, selected));
    const hasFocus = focused.length > 0;
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
    pathFocusDetail.textContent = `直线示意路径 · ${identity} · 高亮 ${focused.length}/${shown.length} 条；其余淡化但保留`;
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
    if (showroomActive) return undefined;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    scene.updateMatrixWorld(true);
    return raycaster.intersectObjects(markers.children).find(hit => visibleInHierarchy(hit.object) && unclipped(hit.point));
  }
  renderer.domElement.onpointerup = event => {
    if (showroomActive) return;
    if (event.button !== 0 || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
    const marker = hitAt(event);
    if (marker) { callbacks.select(marker.object.userData.selection); return; }
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
          const physical = hit.point.clone(); if (part) physical.sub(part.offset.clone().multiplyScalar(amount));
          callbacks.add(physical.toArray() as [number, number, number], part?.object.name);
        } else if (part) showGuide(part);
      }
    }
  };
  renderer.domElement.oncontextmenu = event => { event.preventDefault(); const hit = hitAt(event); if (hit) callbacks.context(hit.object.userData.selection, event.clientX, event.clientY); };
  const resize = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight, false); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); }); resize.observe(host);
  function reset() {
    if (showroomActive) { focusCamera([4.6, 2.45, 4.6], [0, 0.85, 0]); return; }
    const damping = controls.enableDamping; controls.enableDamping = false; controls.update();
    camera.position.set(4, 3.4, 4.8); controls.target.set(0, 0.7, 0); controls.update(); controls.enableDamping = damping; exploded = false;
  }
  function focusSection(axis: string) {
    const views: Record<string, { position: Vec3; target: Vec3 }> = {
      x: { position: [-6.2, 2.0, 0], target: [0, 1.05, 0] },
      y: { position: [0, -5.3, 4.4], target: [0, 1.06, 0] },
      z: { position: [0, 1.7, -6.8], target: [0, 1.05, 0.1] },
    };
    const view = views[axis]; if (!view) return;
    // Consume damped orbit deltas before switching to the visible cut face.
    const damping = controls.enableDamping; controls.enableDamping = false; controls.update();
    camera.position.set(...view.position); controls.target.set(...view.target); controls.update(); controls.enableDamping = damping;
  }
  reset();
  return {
    get fieldPoints() { return fieldPoints; }, setConfig, reset,
    getMountIssues() { return mountIssues.map(issue => ({ ...issue })); },
    setExploded(value: boolean) { leaveShowroom(); exploded = value; },
    setBody(value: string) {
      leaveShowroom();
      const leavingCabin = body === 'hidden' && value !== 'hidden' && camera.position.distanceTo(controls.target) < 3;
      body = value; controls.minDistance = value === 'hidden' ? 0.6 : 3; applyBody();
      if (leavingCabin) focusCamera([4, 3.4, 4.8], [0, 0.7, 0]);
      else if (value === 'hidden' && guideSelect.value === 'cockpit') focusCockpit();
    },
    setSection(axis: string, value: number) { leaveShowroom(); const changed = clipAxis !== axis; clipAxis = axis; clipValue = value; syncFieldSampling(); applyClipping(); paintField(); if (changed) focusSection(axis); },
    setEditMode(value: boolean) { if (value) leaveShowroom(); editMode = value; host.classList.toggle('editing', value); guideSelect.disabled = value; if (value) clearGuide(); },
    setWaves(value: boolean) { if (value) leaveShowroom(); waveVisible = value; applyClipping(); },
    setPaths(value: string) { if (value !== 'none') leaveShowroom(); pathMode = value; pathFocusKey = ''; applyClipping(); },
    setField(mode: string, slice: 'volume' | 'x' | 'y' | 'z') { if (mode !== 'off') leaveShowroom(); fieldMode = mode; fieldSlice = slice; syncFieldSampling(); applyClipping(); paintField(); },
    updateField(value: FieldFrame) { frame = value; paintField(); },
    render(time: number, selected: LabSelection, drives: number[], sourceValues: number[]) {
      const now = performance.now(), dt = Math.min(0.1, (now - lastTime) / 1000); lastTime = now;
      const targetAmount = exploded ? 1 : 0;
      amount += (targetAmount - amount) * (1 - Math.exp(-dt * 5));
      // Below 0.1 mm of displacement, snap to the exact pose so section geometry stops rebuilding.
      if (Math.abs(targetAmount - amount) < 1e-4) amount = targetAmount;
      for (const part of model?.parts ?? []) part.object.position.copy(part.origin).addScaledVector(part.offset, amount);
      model?.wheels.forEach(wheel => { wheel.rotation.x = time * ((config?.speedKph ?? 60) / 3.6) / 0.4; });
      stripes.children.forEach((line, i) => { line.position.z = (Math.floor(i / 2) * 3 + time * ((config?.speedKph ?? 60) / 3.6)) % 96 - 48; });
      markerRows.forEach(row => {
        displayPosition(row.anchor, row.mesh.position);
        const active = selected.channel === row.selection.channel && (selected.signal === row.selection.signal || ['d', 'a', 'e'].includes(selected.signal) && row.selection.signal === 'e');
        // Hold marker screen size near the camera instead of letting a headrest marker cover the cockpit.
        const distanceScale = Math.min(1, Math.max(0.08, camera.position.distanceTo(row.mesh.position) / 3));
        row.mesh.scale.setScalar(distanceScale * (row.source ? (active ? 1.4 : 1) * (1 + Math.min(0.35, Math.abs(sourceValues[row.selection.channel] ?? 0) * 0.1)) : active ? 1.4 : 1));
        row.button.setAttribute('aria-pressed', String(active));
      });
      updatePathFocus(selected);
      field.position.y = amount * 0.45;
      (contactShade.material as THREE.MeshBasicMaterial).opacity = clipAxis === 'none' ? 1 - amount * 0.8 : 0.12;
      markers.visible = !showroomActive;
      waves.visible = waveVisible && !showroomActive;
      waveRows.forEach(row => {
        const i = row.userData.speaker, phase = (time * 1.5 + row.userData.phase) % 1;
        displayPosition(speakerAnchor(i), row.position); row.scale.setScalar(0.12 + phase * 1.1);
        row.visible = !!config?.speakerEnabled[i] && Math.abs(drives[i] ?? 0) > 1e-8;
        (row.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * (field.visible ? 0.10 : 0.16);
      });
      paths.visible = pathMode !== 'none' && !showroomActive;
      if (showroomActive) field.visible = false;
      pathRows.forEach((row, i) => {
        const visible = pathIsShown(row);
        row.line.visible = row.dot.visible = visible;
        displayPosition(row.start, row.from); displayPosition(row.end, row.to);
        const positions = row.line.geometry.getAttribute('position');
        positions.setXYZ(0, row.from.x, row.from.y, row.from.z); positions.setXYZ(1, row.to.x, row.to.y, row.to.z); positions.needsUpdate = true;
        row.dot.position.copy(row.from).lerp(row.to, (time * 0.7 + i * 0.08) % 1);
      });
      sections?.update(clipAxis === 'none' ? null : clipPlane);
      controls.update(); renderer.render(scene, camera);
      const width = host.clientWidth, height = host.clientHeight;
      const visible = markerRows.map(row => {
        const p = row.mesh.position.clone().project(camera);
        const show = !showroomActive && p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && (clipAxis === 'none' || clipPlane.distanceToPoint(row.mesh.position) >= 0);
        row.button.hidden = !show; row.line.style.display = show ? '' : 'none';
        return { row, visible: show, x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height };
      }).filter(row => row.visible);
      const positions = placeLabLabels(visible, width, height);
      visible.forEach(({ row, x, y }, i) => {
        const position = positions[i]; row.button.style.left = `${position.x}px`; row.button.style.top = `${position.y}px`;
        row.line.setAttribute('x1', String(x)); row.line.setAttribute('y1', String(y));
        row.line.setAttribute('x2', String(Math.max(position.x, Math.min(position.x + 64, x))));
        row.line.setAttribute('y2', String(Math.max(position.y, Math.min(position.y + 24, y))));
      });
    },
    dispose() { disposed = true; ++showroomRequest; resize.disconnect(); controls.dispose(); sections?.dispose(); model?.dispose(); showroomModel?.dispose(); clear(markers); clear(paths); clear(waves); clear(field); clear(stripes); ground.geometry.dispose(); ground.material.dispose(); contactShade.geometry.dispose(); contactShade.material.dispose(); shadowTexture.dispose(); environment.dispose(); renderer.dispose(); markerRows.forEach(row => { row.button.remove(); row.line.remove(); }); guidePicker.remove(); guideCard.remove(); fieldNote.remove(); pathFocusNote.remove(); showroomToggle.remove(); showroomPanel.remove(); leaders.remove(); renderer.domElement.remove(); },
  };
}
