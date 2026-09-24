import * as THREE from 'three';

export type StageMode = 'road' | 'workshop';

/** Geometry-only environments; the vehicle and acoustic scene stay at the same origin. */
export function createSceneStage(scene: THREE.Scene) {
  const road = new THREE.Group(); road.name = 'rnc-road-stage'; scene.add(road);
  const workshop = new THREE.Group(); workshop.name = 'rnc-workshop-stage'; scene.add(workshop);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const mat = (color: string, roughness = 0.83, metalness = 0.06, emissive?: string) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: emissive ?? '#000000' });
    materials.add(value); return value;
  };
  const asphalt = mat('#303b48'), ocean = mat('#3e718a', 0.32, 0.12);
  const sand = mat('#b3976b'), concrete = mat('#87949c'), wall = mat('#485763');
  const iron = mat('#48545a', 0.4, 0.55), yellow = mat('#f2bc58', 0.38, 0.18);
  const blue = mat('#68c3d6', 0.4, 0.08, '#153a47'), black = mat('#1d2931');
  function add(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number]) {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position);
    mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function box(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
    return add(parent, new THREE.BoxGeometry(...size), material, position);
  }

  // A road around the fixed vehicle; existing moving lane dashes supply the travel cue.
  box(road, [11, 0.1, 160], [0, -0.085, 0], asphalt);
  box(road, [0.07, 0.015, 160], [-5.15, -0.025, 0], mat('#dbe7e9'));
  box(road, [0.07, 0.015, 160], [5.15, -0.025, 0], mat('#dbe7e9'));
  box(road, [36, 0.02, 160], [23.5, -0.14, 0], ocean);
  const duneVertices: number[] = [], duneIndices: number[] = [];
  const rows = 40;
  for (let z = 0; z <= rows; z++) for (let x = 0; x <= 5; x++) {
    const distance = x / 5;
    const longitudinal = z / rows * 160 - 80;
    duneVertices.push(-5.55 - distance * 24, -0.06 + Math.pow(distance, 0.68) * (5.5 + 0.55 * Math.sin(longitudinal * 0.09)), longitudinal);
    if (x < 5 && z < rows) { const i = z * 6 + x; duneIndices.push(i, i + 1, i + 6, i + 1, i + 7, i + 6); }
  }
  const dune = new THREE.BufferGeometry(); dune.setAttribute('position', new THREE.Float32BufferAttribute(duneVertices, 3));
  dune.setIndex(duneIndices); dune.computeVertexNormals(); add(road, dune, sand, [0, 0, 0]);
  const posts = new THREE.Group(); road.add(posts);
  for (let z = -64; z <= 64; z += 4) for (const side of [-1, 1]) {
    box(posts, [0.07, 0.55, 0.07], [side * 5.55, 0.24, z], iron);
  }
  for (const side of [-1, 1]) {
    box(road, [0.045, 0.045, 160], [side * 5.55, 0.40, 0], mat('#b5c1c4', 0.35, 0.7));
  }

  // The workshop is actual scene geometry, not a flat backdrop or screenshot.
  box(workshop, [18, 0.10, 18], [0, -0.095, 0], concrete);
  const tile = mat('#63747e', 0.9), tileCount = 9;
  for (let i = -tileCount; i <= tileCount; i++) {
    box(workshop, [0.012, 0.004, 18], [i, -0.04, 0], tile);
    box(workshop, [18, 0.004, 0.012], [0, -0.04, i], tile);
  }
  box(workshop, [18, 5.7, 0.16], [0, 2.82, -7.25], wall);
  for (const x of [-6, -3, 0, 3, 6]) box(workshop, [0.14, 5.7, 0.18], [x, 2.82, -7.13], mat('#71828c', 0.5, 0.4));
  for (const x of [-4.5, 0, 4.5]) box(workshop, [3.45, 0.055, 0.08], [x, 4.08, -7.06], blue);
  box(workshop, [5.4, 0.74, 0.14], [-1.8, 2.42, -7.02], black);
  const signCanvas = document.createElement('canvas'); signCanvas.width = 1024; signCanvas.height = 144;
  const signContext = signCanvas.getContext('2d');
  if (signContext) {
    signContext.fillStyle = '#162631'; signContext.fillRect(0, 0, 1024, 144);
    signContext.fillStyle = '#f7f9f5'; signContext.font = 'bold 79px system-ui';
    signContext.textAlign = 'center'; signContext.textBaseline = 'middle'; signContext.fillText('RNC / ASSEMBLY', 512, 78);
    const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace; textures.add(signTexture);
    const signMaterial = new THREE.MeshBasicMaterial({ map: signTexture }); materials.add(signMaterial);
    add(workshop, new THREE.PlaneGeometry(5.2, 0.72), signMaterial, [-1.8, 2.42, -6.94]);
  }
  for (const x of [-0.95, 0.95]) box(workshop, [0.31, 0.07, 5.8], [x, 0.045, 0], iron);
  for (const x of [-2.65, 2.65]) {
    box(workshop, [0.42, 2.1, 0.42], [x, 1.05, -1.55], yellow);
    box(workshop, [0.60, 0.10, 0.60], [x, 0.03, -1.55], black);
    box(workshop, [1.65, 0.08, 0.18], [x * 0.64, 0.49, -1.55], yellow);
  }
  const bayOutline = mat('#e8c263', 0.6);
  for (const x of [-3.2, 3.2]) box(workshop, [0.035, 0.008, 7.3], [x, -0.028, 0], bayOutline);
  for (const z of [-3.65, 3.65]) box(workshop, [6.4, 0.008, 0.035], [0, -0.028, z], bayOutline);
  for (const y of [0.68, 1.4, 2.12]) {
    box(workshop, [3.0, 0.1, 0.72], [5.75, y, -5.45], iron);
    for (const x of [4.8, 5.75, 6.7]) box(workshop, [0.56, 0.46, 0.54], [x, y + 0.28, -5.45], x === 5.75 ? yellow : black);
  }
  for (const y of [0.13, 0.34, 0.55]) {
    const tyre = add(workshop, new THREE.TorusGeometry(0.48, 0.13, 8, 24), mat('#202930'), [5.8, y, -2.4]);
    tyre.rotation.x = Math.PI / 2;
  }

  let mode: StageMode = 'road';
  function setMode(value: StageMode) { mode = value; road.visible = value === 'road'; workshop.visible = value === 'workshop'; }
  setMode(mode);
  return {
    road, workshop,
    get mode() { return mode; },
    setMode,
    update(time: number, speedKph: number) { posts.position.z = -(time * speedKph / 3.6) % 4; },
    dispose() {
      scene.remove(road, workshop);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
