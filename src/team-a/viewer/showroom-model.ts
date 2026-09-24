import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Offline asset. The exterior is a separate visual reference, never a source of
// RNC geometry, part identities, or acoustic coordinates.
const assetUrl = new URL('./assets/range-rover-sport-svr.glb', import.meta.url).href;

export interface ShowroomModel {
  group: THREE.Group;
  setPaint(color: string): void;
  dispose(): void;
}

export async function loadShowroomModel(): Promise<ShowroomModel> {
  const gltf = await new GLTFLoader().loadAsync(assetUrl);
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
      if (material.name === 'carPaint' && material instanceof THREE.MeshStandardMaterial) paints.push(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  return {
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
