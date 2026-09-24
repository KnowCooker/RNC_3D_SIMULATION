import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { VehicleKind } from '../../shared/lab-contracts';
import { splitFourWheelMesh, wheelCorners, type WheelCorner } from './wheel-geometry';

// Offline assets. Their exterior groups are not RNC geometry or physical anchors.
const assets = {
  ice: {
    id: 'range-rover',
    url: new URL('./assets/range-rover-sport-svr.glb', import.meta.url).href,
    title: 'Range Rover Sport SVR',
    credit: 'Mona x Supercars',
    source: 'https://sketchfab.com/3d-models/land-rover-range-rover-sport-svr-5462d65acb0e4dca8c20da82360261db',
    paint: 'carPaint',
  },
  bev: {
    id: 'tesla-model-y',
    url: new URL('./assets/tesla-model-y.meshopt.glb', import.meta.url).href,
    title: '2021 Tesla Model Y',
    credit: 'tonielpro520',
    source: 'https://sketchfab.com/3d-models/2021-tesla-model-y-59e2ead369984b1a85c800ff6cf6789d',
    paint: 'Carro_Pintura',
  },
} as const;

export interface ShowroomModel {
  assetId: string;
  title: string;
  credit: string;
  source: string;
  group: THREE.Group;
  parts: { id: string; name: string }[];
  setPartProgress(id: string, progress: number): void;
  setPaint(color: string): void;
  dispose(): void;
}

interface AuthoredPartSpec {
  id: string;
  name: string;
  labels: readonly string[];
  materials?: readonly string[];
  offset: readonly [number, number, number];
}

export async function loadShowroomModel(vehicle: VehicleKind): Promise<ShowroomModel> {
  // The hybrids still use the exterior-only ICE reference until licensed,
  // powertrain-matched assets are reviewed. The UI discloses this fallback.
  const asset = vehicle === 'bev' ? assets.bev : assets.ice;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(asset.url);
  const group = new THREE.Group();
  const exterior = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(exterior);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.x + size.y + size.z) || Math.max(size.x, size.z) <= 0) {
    throw new Error('Invalid showroom asset bounds');
  }
  const scale = 4.8 / Math.max(size.x, size.z);
  exterior.scale.setScalar(scale);
  exterior.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  group.add(exterior);

  const wheelMeshes = new Map<WheelCorner, THREE.Mesh[]>(wheelCorners.map(corner => [corner, []]));
  const replacedGeometries = new Set<THREE.BufferGeometry>();
  if (asset.id === 'range-rover') {
    group.updateMatrixWorld(true);
    const combinedWheelMeshes: THREE.Mesh[] = [], rimMeshes: THREE.Mesh[] = [];
    exterior.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const parent = mesh.parent?.name ?? '';
      if (/car_landrover_rangeroversport_2014_MeshM_(Tire|BrakeDisc|Caliper)_High/.test(parent)) combinedWheelMeshes.push(mesh);
      else if (/^r?WheelFL6_/.test(parent)) rimMeshes.push(mesh);
    });
    if (combinedWheelMeshes.length !== 3 || rimMeshes.length !== 16) throw new Error('Unexpected Range Rover wheel topology');
    for (const mesh of combinedWheelMeshes) {
      const result = splitFourWheelMesh(mesh);
      replacedGeometries.add(result.sourceGeometry);
      for (const corner of wheelCorners) wheelMeshes.get(corner)!.push(result.pieces[corner]);
    }
    group.updateMatrixWorld(true);
    for (const mesh of rimMeshes) {
      const bounds = new THREE.Box3().setFromObject(mesh);
      const point = bounds.getCenter(new THREE.Vector3());
      const corner = `${point.z > 0 ? 'f' : 'r'}${point.x > 0 ? 'l' : 'r'}` as WheelCorner;
      wheelMeshes.get(corner)!.push(mesh);
    }
    if (wheelCorners.some(corner => wheelMeshes.get(corner)!.length !== 7)) throw new Error('Incomplete Range Rover wheel corner');
  }

  // This source has material-split meshes. Regroup only visibly distinct
  // authored assemblies; a mesh/material count must never become a part count.
  const partSpecs: AuthoredPartSpec[] = asset.id === 'range-rover' ? [
    { id: 'front-bumper', name: '前保险杠及格栅', labels: ['BumperF6', 'BumperChassisF6', 'Grille6'], offset: [0, 0.15, 0.85] },
    { id: 'hood', name: '前舱盖', labels: ['Hood6'], offset: [0, 0.85, 0.30] },
    { id: 'fender-front-left', name: '左前翼子板', labels: ['FenderFL6'], offset: [0.65, 0.26, 0.18] },
    { id: 'fender-front-right', name: '右前翼子板', labels: ['FenderFR6'], offset: [-0.65, 0.26, 0.18] },
    { id: 'headlight-left', name: '左前灯组', labels: ['HeadLightL6'], offset: [0.40, 0.25, 0.48] },
    { id: 'headlight-right', name: '右前灯组', labels: ['HeadLightR6'], offset: [-0.40, 0.25, 0.48] },
    { id: 'front-inner-panels', name: '前轮区内侧板', labels: ['FendersChassisF6'], offset: [0, 0.48, 0.54] },
    { id: 'door-left', name: '左前车门及后视镜', labels: ['DoorL6', 'DoorL', 'MirrorBaseL6', 'MirrorL6'], offset: [0.86, 0.28, 0] },
    { id: 'door-right', name: '右前车门及后视镜', labels: ['DoorR6', 'DoorR', 'MirrorBaseR6', 'MirrorR6'], offset: [-0.86, 0.28, 0] },
    { id: 'wheel-fl', name: '左前轮胎、轮辋与制动总成', labels: [], offset: [0.72, 0.12, 0.12] },
    { id: 'wheel-fr', name: '右前轮胎、轮辋与制动总成', labels: [], offset: [-0.72, 0.12, 0.12] },
    { id: 'wheel-rl', name: '左后轮胎、轮辋与制动总成', labels: [], offset: [0.72, 0.12, -0.12] },
    { id: 'wheel-rr', name: '右后轮胎、轮辋与制动总成', labels: [], offset: [-0.72, 0.12, -0.12] },
    { id: 'tailgate', name: '尾门及后窗', labels: ['Boot6', 'Boot', 'Spoiler6'], offset: [0, 0.65, -0.55] },
    { id: 'rear-bumper', name: '后保险杠与扩散器', labels: ['BumperR6', 'BumperChassisR6', 'Diffuser6'], offset: [0, 0.14, -0.85] },
    { id: 'taillight-left', name: '左后灯组', labels: ['TailLightL6'], offset: [0.36, 0.24, -0.48] },
    { id: 'taillight-right', name: '右后灯组', labels: ['TailLightR6'], offset: [-0.36, 0.24, -0.48] },
    { id: 'rear-quarters', name: '后侧围外板', labels: ['FendersR6'], offset: [0, 0.58, -0.55] },
    { id: 'rear-inner-panels', name: '后轮区内侧板', labels: ['FendersChassisR6'], offset: [0, 0.32, -0.40] },
    { id: 'side-skirts', name: '两侧门槛饰板', labels: ['Skirts6'], offset: [0, -0.28, 0] },
    { id: 'roof', name: '车顶面板', labels: ['Roof6'], offset: [0, 0.85, 0] },
    { id: 'glazing', name: '车窗玻璃组', labels: ['Glass6'], offset: [0, 0.82, 0] },
    { id: 'engine-bay', name: '机舱动力几何（原模型）', labels: [], materials: ['Chassis6/rM_Engine_Max1'], offset: [0, 0.75, 0.18] },
    { id: 'steering-wheel', name: '方向盘总成', labels: ['SteeringWheel5'], offset: [0, 0.40, 0.30] },
    { id: 'interior', name: '座舱内饰总成', labels: ['Interior5'], offset: [0, 0.72, 0] },
    { id: 'chassis-shell', name: '车身与底盘主体网格', labels: [], materials: ['Chassis6/rM_Chassis_Max1'], offset: [0, -0.38, 0] },
    { id: 'exhaust', name: '排气总成', labels: ['Exhausts6'], offset: [0, -0.30, -0.20] },
  ] : [];
  const semanticMeshes = new Map<string, THREE.Mesh[]>();
  const materialMeshes = new Map<string, THREE.Mesh[]>();
  exterior.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    let ancestor: THREE.Object3D | null = mesh.parent;
    while (ancestor && !/^r[A-Za-z]/.test(ancestor.name)) ancestor = ancestor.parent;
    const label = /^r([^_]+)_/.exec(ancestor?.name ?? '')?.[1];
    if (!label) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const key = `${label}/${material.name}`;
      const bucket = materialMeshes.get(key) ?? [];
      bucket.push(mesh); materialMeshes.set(key, bucket);
    }
    const bucket = semanticMeshes.get(label) ?? [];
    bucket.push(mesh); semanticMeshes.set(label, bucket);
  });
  const partPivots = new Map<string, { pivot: THREE.Group; origin: THREE.Vector3; offset: THREE.Vector3 }>();
  group.updateMatrixWorld(true);
  for (const spec of partSpecs) {
    const meshes = [...spec.labels.flatMap(label => semanticMeshes.get(label) ?? []), ...(spec.materials?.flatMap(material => materialMeshes.get(material) ?? []) ?? []), ...(spec.id.startsWith('wheel-') ? wheelMeshes.get(spec.id.slice(6) as WheelCorner) ?? [] : [])];
    if (meshes.length === 0) throw new Error(`Missing authored assembly ${spec.id}`);
    const partBounds = new THREE.Box3();
    for (const mesh of meshes) partBounds.expandByObject(mesh);
    const origin = partBounds.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group(); pivot.name = `assembly-${spec.id}`;
    pivot.position.copy(origin); group.add(pivot); pivot.updateMatrixWorld(true);
    for (const mesh of meshes) pivot.attach(mesh);
    partPivots.set(spec.id, { pivot, origin, offset: new THREE.Vector3(...spec.offset) });
  }

  const paints: THREE.MeshStandardMaterial[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      if (material.name === asset.paint && material instanceof THREE.MeshStandardMaterial) {
        paints.push(material);
        // The source paint has metallic=0 and implicit roughness=1, making
        // the body look matte under the studio environment.
        if (asset.id === 'tesla-model-y') {
          material.metalness = 0.32;
          material.roughness = 0.28;
          material.needsUpdate = true;
        }
      }
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const geometry of replacedGeometries) geometries.add(geometry);
  return {
    assetId: asset.id,
    title: asset.title,
    credit: asset.credit,
    source: asset.source,
    group,
    parts: partSpecs.map(({ id, name }) => ({ id, name })),
    setPartProgress(id: string, progress: number) {
      const part = partPivots.get(id);
      if (!part) return;
      part.pivot.position.copy(part.origin).addScaledVector(part.offset, THREE.MathUtils.clamp(progress, 0, 1) * 1.6);
    },
    setPaint(color: string) { for (const paint of paints) paint.color.set(color); },
    dispose() {
      group.remove(exterior);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
