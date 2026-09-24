import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { VehicleKind } from '../../shared/lab-contracts';

// Offline asset. The exterior is a separate visual reference, never a source of
// RNC geometry, part identities, or acoustic coordinates.
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
  setPaint(color: string): void;
  dispose(): void;
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

  const paints: THREE.MeshStandardMaterial[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  exterior.traverse(object => {
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
  return {
    assetId: asset.id,
    title: asset.title,
    credit: asset.credit,
    source: asset.source,
    group,
    setPaint(color: string) { for (const paint of paints) paint.color.set(color); },
    dispose() {
      group.remove(exterior);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
