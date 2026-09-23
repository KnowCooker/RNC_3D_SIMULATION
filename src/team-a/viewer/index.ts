import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ORDER, type Corner, type SignalKind } from '../../shared/contracts';

type Select = (signal: SignalKind, channel: Corner) => void;
export function createViewer(host: HTMLElement, onSelect: Select) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#14232e');
  scene.fog = new THREE.Fog('#14232e', 12, 30);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); host.append(renderer.domElement);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minDistance = 4; controls.maxDistance = 15; controls.maxPolarAngle = Math.PI / 2.05;
  scene.add(new THREE.HemisphereLight('#e2f5ff', '#263745', 2.8));
  const light = new THREE.DirectionalLight('#fff3da', 3.5); light.position.set(4, 8, 5); scene.add(light);
  const vehicle = new THREE.Group(); scene.add(vehicle);
  const layers: { mesh: THREE.Object3D; y: number; lift: number }[] = [];
  const shell: THREE.Mesh[] = [], wheels: THREE.Mesh[] = [];
  const markers: THREE.Mesh[] = [], labels: { el: HTMLSpanElement; object: THREE.Object3D }[] = [];
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#a9cad0', metalness: 0.48, roughness: 0.32, transparent: true, opacity: 0.34, depthWrite: false });
  function box(size: number[], position: number[], color: string, lift = 0, material?: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), material ?? new THREE.MeshStandardMaterial({ color, roughness: 0.62 }));
    mesh.position.set(...position as [number, number, number]); vehicle.add(mesh);
    layers.push({ mesh, y: position[1], lift }); return mesh;
  }
  box([1.85, 0.16, 4.5], [0, 0.63, 0], '#344752'); // chassis
  box([1.5, 0.21, 2.9], [0, 0.43, 0], '#30a69d', -0.35); // battery
  for (let i = 0; i < 8; i++) box([1.36, 0.025, 0.025], [0, 0.547, -1.2 + i * 0.34], '#84e7d2', -0.35);
  box([1.1, 0.32, 0.48], [0, 0.85, -1.43], '#e5a354', 0.12); // rear e-drive
  box([1.72, 0.1, 0.1], [0, 0.63, -1.45], '#748995');
  box([0.06, 0.06, 1.0], [0, 0.58, -0.8], '#f49c40', -0.12);
  for (const x of [-1, 1]) for (const z of [-1.45, 1.45]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.24, 24), new THREE.MeshStandardMaterial({ color: '#11191f', roughness: 0.95 }));
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.42, z); vehicle.add(wheel); wheels.push(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.255, 12), new THREE.MeshStandardMaterial({ color: '#8d9ca4', metalness: 0.6, roughness: 0.4 })); wheel.add(hub);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.26, 0.06), new THREE.MeshStandardMaterial({ color: '#34434d' })); wheel.add(spoke);
  }
  for (const z of [-0.77, 0.65]) for (const x of [-0.48, 0.48]) {
    box([0.62, 0.22, 0.65], [x, 0.93, z], '#354d60', 0.4);
    box([0.62, 0.69, 0.16], [x, 1.3, z - 0.28], '#405d71', 0.4);
    box([0.32, 0.25, 0.15], [x, 1.77, z - 0.28], '#537589', 0.4);
  }
  box([0.3, 0.22, 0.64], [0, 0.93, -0.77], '#354d60', 0.4);
  box([0.3, 0.69, 0.16], [0, 1.3, -1.05], '#405d71', 0.4);
  box([0.25, 0.25, 0.15], [0, 1.77, -1.05], '#537589', 0.4);
  box([1.65, 0.25, 0.34], [0, 1.2, 1.2], '#263d4b', 0.4);
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24), new THREE.MeshStandardMaterial({ color: '#839ba9' }));
  steering.position.set(0.48, 1.39, 0.98); vehicle.add(steering); layers.push({ mesh: steering, y: 1.39, lift: 0.4 });
  shell.push(box([1.95, 0.35, 0.9], [0, 1.03, 1.72], '', 0.65, bodyMaterial));
  shell.push(box([1.95, 0.6, 0.38], [0, 1.1, -2.04], '', 0.65, bodyMaterial));
  shell.push(box([1.87, 0.12, 2.85], [0, 2.02, -0.26], '', 0.95, bodyMaterial));
  for (const x of [-0.96, 0.96]) {
    for (const z of [0.65, -0.75]) shell.push(box([0.075, 0.73, 1.32], [x, 1.08, z], '', 0.65, bodyMaterial));
    for (const z of [1.16, -0.28, -1.65]) shell.push(box([0.075, 0.64, 0.09], [x, 1.68, z], '', 0.8, bodyMaterial));
  }
  box([1.8, 0.1, 0.06], [0, 1.08, 2.19], '#d9fff6', 0.65);
  box([1.8, 0.08, 0.06], [0, 1.13, -2.25], '#dd6858', 0.65);
  const kinds = [
    { signal: 'x' as const, color: '#f3bd65', y: 0.8, x: 0.86, front: 1.45, rear: -1.45, lift: 0, prefix: 'REF' },
    { signal: 'u' as const, color: '#70b9ff', y: 1.15, x: 1.03, front: 0.65, rear: -0.75, lift: 0.65, prefix: 'OUT' },
    { signal: 'e' as const, color: '#5ee2bf', y: 1.86, x: 0.48, front: 0.4, rear: -1.01, lift: 0.4, prefix: 'MIC' },
  ];
  for (const kind of kinds) ORDER.forEach((corner, i) => {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ color: kind.color, depthTest: false }));
    marker.position.set(i % 2 === 0 ? kind.x : -kind.x, kind.y, i < 2 ? kind.front : kind.rear);
    marker.userData = { signal: kind.signal, corner }; marker.renderOrder = 5; vehicle.add(marker); markers.push(marker);
    layers.push({ mesh: marker, y: kind.y, lift: kind.lift });
    const el = document.createElement('span'); el.className = 'model-label'; el.style.color = kind.color; el.textContent = `${kind.prefix} ${corner.toUpperCase()}`;
    host.append(el); labels.push({ el, object: marker });
  });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 100), new THREE.MeshStandardMaterial({ color: '#22323c', roughness: 1 }));
  road.rotation.x = -Math.PI / 2; road.position.y = 0.01; scene.add(road);
  const roadMarks: THREE.Mesh[] = [];
  for (let i = 0; i < 22; i++) for (const x of [-2.5, 2.5]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 1), new THREE.MeshBasicMaterial({ color: '#64818e' }));
    stripe.position.set(x, 0.023, i * 3 - 30); scene.add(stripe); roadMarks.push(stripe);
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = { x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(markers)[0];
    if (hit) onSelect(hit.object.userData.signal, hit.object.userData.corner);
  });
  const resize = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }); resize.observe(host);
  function reset() {
    camera.position.set(6.7, 4.9, 7.4); controls.target.set(0, 1.05, 0); controls.update();
    setExploded(false); setBody('transparent');
  }
  function setExploded(enabled: boolean) { for (const layer of layers) layer.mesh.position.y = layer.y + (enabled ? layer.lift : 0); }
  function setBody(mode: string) {
    for (const mesh of shell) mesh.visible = mode !== 'hidden';
    bodyMaterial.opacity = mode === 'solid' ? 1 : 0.34; bodyMaterial.depthWrite = mode === 'solid';
  }
  reset();
  return { reset, setExploded, setBody,
    render(time: number, selected: { signal: SignalKind; channel: Corner }, residualSpl: (number | null)[]) {
      wheels.forEach(wheel => { wheel.rotation.x = time * (60 / 3.6) / 0.4; });
      roadMarks.forEach((line, i) => { line.position.z = (Math.floor(i / 2) * 3 + time * (60 / 3.6)) % 66 - 33; });
      markers.forEach(marker => {
        const { signal, corner } = marker.userData;
        marker.scale.setScalar(signal === selected.signal && corner === selected.channel ? 1.5 : 1);
        if (signal === 'e') {
          const spl = residualSpl[ORDER.indexOf(corner)];
          (marker.material as THREE.MeshBasicMaterial).color.set(spl === null ? '#8eabb7' : new THREE.Color().setHSL((1 - Math.max(0, Math.min(1, (spl - 30) / 50))) * 0.38, 0.65, 0.6));
        }
      });
      controls.update(); renderer.render(scene, camera);
      for (const label of labels) {
        const p = label.object.getWorldPosition(new THREE.Vector3()).project(camera);
        label.el.style.display = p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1 ? 'none' : '';
        label.el.style.left = `${(p.x + 1) / 2 * host.clientWidth}px`;
        label.el.style.top = `${(1 - p.y) / 2 * host.clientHeight - 15}px`;
      }
    },
  };
}
