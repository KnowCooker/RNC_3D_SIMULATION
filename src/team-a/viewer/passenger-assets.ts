import * as THREE from 'three';
import type { PassengerId, createPassengerModel } from './passenger-model';
import { passengerHipOffset } from './passenger-model';

export type PassengerModel = ReturnType<typeof createPassengerModel>;

/** Local asset cache: source models with restricted redistribution stay off GitHub.
 * Instances own geometry/materials; textures belong to the library until disposal. */
export function createPassengerAssetLibrary(loadSource: (key: string) => Promise<THREE.Group> = async key => {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  return (await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}passengers-local/${key}.glb?v=crew4`)).scene;
}) {
  const cache = new Map<string, Promise<THREE.Group>>();
  let disposed = false;
  function release(source: THREE.Group) {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    source.traverse(o => { if (o instanceof THREE.Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m); for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
      }
    } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => { t.dispose(); if (typeof ImageBitmap !== 'undefined' && t.image instanceof ImageBitmap) t.image.close(); });
  }
  return {
    async load(id: PassengerId, driver: boolean): Promise<PassengerModel> {
      if (disposed) throw new Error('Character library disposed');
      const key = `${id}-${driver ? 'driver' : 'seated'}`;
      let pending = cache.get(key);
      if (!pending) {
        pending = loadSource(key).then(source => {
          if (disposed) { release(source); throw new Error('Character library disposed'); }
          return source;
        }); cache.set(key, pending);
        // A later explicit selection may retry a failed/missing local resource.
        void pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
      }
      const template = await pending;
      if (disposed) throw new Error('Character library disposed');
      const group = new THREE.Group(), pose = template.clone(true);
      group.name = `passenger-${id}`; group.add(pose);
      group.userData = { passengerId: id, visualOnly: true, driver, assetStatus: 'detailed', seatedHipOffset: passengerHipOffset(id) };
      const geometry = new Set<THREE.BufferGeometry>(), material = new Set<THREE.Material>();
      pose.traverse(o => { if (o instanceof THREE.Mesh) {
        o.geometry = o.geometry.clone(); geometry.add(o.geometry);
        const clone = (m: THREE.Material) => { const next = m.clone(); material.add(next); return next; };
        o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
        o.castShadow = o.receiveShadow = true;
      } });
      const clip = new THREE.Plane(); let released = false, section = '';
      return {
        group,
        animate(time, reduced) { if (!released && Number.isFinite(time)) pose.position.y = reduced ? 0 : Math.sin(time * 1.35) * .0009; },
        setSection(axis, coordinate) {
          const next = `${axis}/${coordinate}`; if (next === section) return; section = next;
          clip.normal.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0); clip.constant = -coordinate;
          material.forEach(m => { m.clippingPlanes = axis === 'none' ? null : [clip]; m.clipShadows = true; m.needsUpdate = true; });
        },
        dispose() { if (released) return; released = true; group.removeFromParent(); group.clear(); geometry.forEach(g => g.dispose()); material.forEach(m => m.dispose()); },
      };
    },
    dispose() { if (disposed) return; disposed = true; cache.forEach(p => { void p.then(release, () => {}); }); cache.clear(); },
  };
}
