import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createVehicleModel, type VehiclePart } from './vehicle-model';
import { createSectionDisplay } from './section-display';
import { MIC_POSITIONS, SOURCE_POSITIONS, SPEAKER_POSITIONS, type FieldFrame, type LabConfig, type LabSelection, type Vec3 } from '../../shared/lab-contracts';
import { placeLabels } from './labels';

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
  const bodyMaterials = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
  const sourceAnchor = (i: number): Anchor => ({ origin: SOURCE_POSITIONS[i], mountPart: `wheel-${corners[i]}` });
  const speakerAnchor = (i: number): Anchor => ({ origin: SPEAKER_POSITIONS[i], mountPart: `door-${i < 2 ? 'front' : 'rear'}-${i % 2 === 0 ? 1 : -1}` });
  const micAnchor = (i: number): Anchor => ({ origin: MIC_POSITIONS[i], mountPart: `seat-${[1, 2, 3, 5][i]}` });
  const markerRows: { mesh: THREE.Mesh; button: HTMLButtonElement; selection: LabSelection; source: boolean; anchor: Anchor }[] = [];
  const waveRows: THREE.Mesh[] = [];
  const pathRows: { line: THREE.Line; dot: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; start: Anchor; end: Anchor; primary: boolean; channel: number }[] = [];
  const fieldPoints: Vec3[] = [];
  for (let x = 0; x < 7; x++) for (let y = 0; y < 5; y++) for (let z = 0; z < 8; z++) fieldPoints.push([-0.72 + x * 0.24, 0.85 + y * 0.21, -1.2 + z * 0.29]);
  const fieldMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.48, depthWrite: false });
  const fieldMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 8, 6), fieldMaterial, fieldPoints.length);
  fieldMesh.frustumCulled = false; field.add(fieldMesh); field.visible = false;
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  let frame: FieldFrame | null = null;

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
    for (const material of model?.materials ?? []) { material.clippingPlanes = planes; material.needsUpdate = true; }
    for (const group of [markers, waves, paths, field]) group.traverse(object => {
      const material = (object as THREE.Mesh).material;
      if (material) for (const value of Array.isArray(material) ? material : [material]) { value.clippingPlanes = planes; value.needsUpdate = true; }
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
    host.append(button); markerRows.push({ mesh, button, selection, source, anchor });
  }
  function setConfig(next: LabConfig) {
    config = structuredClone(next);
    const key = JSON.stringify([next.vehicle, next.references, next.speakerEnabled]);
    if (key === signature) return;
    signature = key;
    if (sections) { scene.remove(sections.group); sections.dispose(); }
    if (model) { scene.remove(model.group); model.dispose(); }
    model = createVehicleModel(next.vehicle); scene.add(model.group);
    sections = createSectionDisplay(model.group); scene.add(sections.group);
    partByName.clear(); model.parts.forEach(part => partByName.set(part.object.name, part));
    bodyMaterials.clear(); model.shell.forEach(mesh => {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        bodyMaterials.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
      }
    });
    markerRows.forEach(row => row.button.remove()); markerRows.length = 0;
    clear(markers); clear(paths); clear(waves); pathRows.length = 0; waveRows.length = 0;
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
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.023, 6, 6), new THREE.MeshBasicMaterial({ color: primary ? '#e4c2ff' : '#92c9ff' }));
      paths.add(dot); pathRows.push({ line, dot, from, to, start, end, primary, channel });
    }
    applyBody(); applyClipping();
  }
  function paintField() {
    field.visible = fieldMode !== 'off' && !!frame?.valid;
    if (!frame?.valid) return;
    const values = fieldMode === 'primary' ? frame.primarySpl : frame.residualSpl;
    fieldPoints.forEach((p, i) => {
      const shown = fieldSlice === 'volume' || (fieldSlice === 'x' ? Math.abs(p[0]) < 0.13 : fieldSlice === 'y' ? Math.abs(p[1] - 1.48) < 0.12 : Math.abs(p[2] - 0.54) < 0.16);
      matrix.makeScale(shown ? 1 : 0, shown ? 1 : 0, shown ? 1 : 0); matrix.setPosition(...p); fieldMesh.setMatrixAt(i, matrix);
      const scalar = Math.max(0, Math.min(1, (values[i] - 30) / 50));
      color.setHSL((1 - scalar) * 0.65, 0.86, 0.54); fieldMesh.setColorAt(i, color);
    });
    fieldMesh.instanceMatrix.needsUpdate = true; if (fieldMesh.instanceColor) fieldMesh.instanceColor.needsUpdate = true;
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = [0, 0];
  renderer.domElement.onpointerdown = event => { down = [event.clientX, event.clientY]; };
  function hitAt(event: MouseEvent | PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
    scene.updateMatrixWorld(true);
    return raycaster.intersectObjects(markers.children).find(hit => visibleInHierarchy(hit.object) && unclipped(hit.point));
  }
  renderer.domElement.onpointerup = event => {
    if (event.button !== 0 || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
    const marker = hitAt(event);
    if (marker) { callbacks.select(marker.object.userData.selection); return; }
    if (editMode && model) {
      const hit = raycaster.intersectObject(model.group, true).find(hit => visibleInHierarchy(hit.object) && unclipped(hit.point));
      if (hit) {
        const part = model.parts.find(part => part.object === hit.object || part.object.getObjectById(hit.object.id));
        const physical = hit.point.clone(); if (part) physical.sub(part.offset.clone().multiplyScalar(amount));
        callbacks.add(physical.toArray() as [number, number, number], part?.object.name);
      }
    }
  };
  renderer.domElement.oncontextmenu = event => { event.preventDefault(); const hit = hitAt(event); if (hit) callbacks.context(hit.object.userData.selection, event.clientX, event.clientY); };
  const resize = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight, false); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); }); resize.observe(host);
  function reset() {
    const damping = controls.enableDamping; controls.enableDamping = false; controls.update();
    camera.position.set(4, 3.4, 4.8); controls.target.set(0, 0.7, 0); controls.update(); controls.enableDamping = damping; exploded = false;
  }
  reset();
  return {
    fieldPoints, setConfig, reset,
    getMountIssues() { return mountIssues.map(issue => ({ ...issue })); },
    setExploded(value: boolean) { exploded = value; },
    setBody(value: string) { body = value; applyBody(); },
    setSection(axis: string, value: number) { clipAxis = axis; clipValue = value; applyClipping(); },
    setEditMode(value: boolean) { editMode = value; host.classList.toggle('editing', value); },
    setWaves(value: boolean) { waveVisible = value; },
    setPaths(value: string) { pathMode = value; },
    setField(mode: string, slice: 'volume' | 'x' | 'y' | 'z') { fieldMode = mode; fieldSlice = slice; paintField(); },
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
        row.mesh.scale.setScalar(row.source ? (active ? 1.4 : 1) * (1 + Math.min(0.35, Math.abs(sourceValues[row.selection.channel] ?? 0) * 0.1)) : active ? 1.4 : 1);
        row.button.setAttribute('aria-pressed', String(active));
      });
      field.position.y = amount * 0.45;
      waves.visible = waveVisible;
      waveRows.forEach(row => {
        const i = row.userData.speaker, phase = (time * 1.5 + row.userData.phase) % 1;
        displayPosition(speakerAnchor(i), row.position); row.scale.setScalar(0.12 + phase * 1.1);
        row.visible = !!config?.speakerEnabled[i] && Math.abs(drives[i] ?? 0) > 1e-8;
        (row.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.16;
      });
      paths.visible = pathMode !== 'none';
      pathRows.forEach((row, i) => {
        const visible = (row.primary || !!config?.speakerEnabled[row.channel]) && (pathMode === 'both' || (row.primary ? pathMode === 'primary' : pathMode === 'secondary'));
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
        const show = p.z >= -1 && p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && (clipAxis === 'none' || clipPlane.distanceToPoint(row.mesh.position) >= 0);
        row.button.hidden = !show;
        return { row, visible: show, x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height };
      }).filter(row => row.visible);
      const positions = placeLabels(visible, width, height);
      visible.forEach(({ row }, i) => { row.button.style.left = `${positions[i].x}px`; row.button.style.top = `${positions[i].y}px`; });
    },
    dispose() { resize.disconnect(); controls.dispose(); sections?.dispose(); model?.dispose(); clear(markers); clear(paths); clear(waves); clear(field); clear(stripes); ground.geometry.dispose(); ground.material.dispose(); contactShade.geometry.dispose(); contactShade.material.dispose(); shadowTexture.dispose(); environment.dispose(); renderer.dispose(); markerRows.forEach(row => row.button.remove()); renderer.domElement.remove(); },
  };
}
