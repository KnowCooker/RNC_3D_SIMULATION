import * as THREE from 'three';
import { createSectionDisplay } from './section-display';

export type AssetBodyMode = 'solid' | 'transparent' | 'hidden';
export type AssetSectionAxis = 'none' | 'x' | 'y' | 'z';

/** Inspection changes presentation only. Source geometry and assembled coordinates stay intact. */
export function createAssetInspection(root: THREE.Group, shell: readonly THREE.Mesh[]) {
  const meshes: THREE.Mesh[] = [];
  root.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
  const shellSet = new Set(shell);
  const originals = new Map<THREE.Mesh, { material: THREE.Material | THREE.Material[]; visible: boolean }>();
  const copies = new Map<THREE.Material, THREE.Material>();
  const materials = new Set<THREE.Material>();
  const originalPlanes = new Map<THREE.Material, THREE.Plane[] | null>();
  for (const mesh of meshes) {
    originals.set(mesh, { material: mesh.material, visible: mesh.visible });
    if (shellSet.has(mesh)) {
      const copy = (material: THREE.Material) => {
        let cloned = copies.get(material);
        if (!cloned) { cloned = material.clone(); copies.set(material, cloned); }
        return cloned;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material);
    }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material); originalPlanes.set(material, material.clippingPlanes);
    }
  }
  // Authored GLBs have not been certified as closed solids. Only their actual
  // mesh/plane contours are shown, never an invented filled mechanical section.
  const sections = createSectionDisplay(root, false);
  const overlay = new THREE.Group(); overlay.name = 'asset-inspection-overlay'; overlay.add(sections.group);
  const selectedBounds = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#ffd27b'));
  selectedBounds.name = 'asset-selected-part'; selectedBounds.visible = false; overlay.add(selectedBounds);
  const plane = new THREE.Plane();
  let sectionAxis: AssetSectionAxis = 'none', selected: THREE.Object3D | null = null, disposed = false;

  function setBody(mode: AssetBodyMode) {
    for (const mesh of shellSet) {
      const original = originals.get(mesh);
      if (original) mesh.visible = original.visible && mode !== 'hidden';
    }
    for (const [original, material] of copies) {
      material.transparent = mode === 'transparent' || original.transparent;
      material.opacity = mode === 'transparent' ? Math.min(original.opacity, 0.18) : original.opacity;
      material.depthWrite = mode === 'transparent' ? false : original.depthWrite;
      material.needsUpdate = true;
    }
  }
  function setSection(axis: AssetSectionAxis, coordinate: number) {
    if (!['none', 'x', 'y', 'z'].includes(axis) || !Number.isFinite(coordinate)) throw new Error('Invalid asset section');
    sectionAxis = axis;
    plane.normal.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    plane.constant = -coordinate;
    for (const material of materials) {
      material.clippingPlanes = axis === 'none' ? originalPlanes.get(material)! : [plane];
      material.needsUpdate = true;
    }
    update();
  }
  function visible(object: THREE.Object3D) {
    for (let current: THREE.Object3D | null = object; current; current = current.parent) if (!current.visible) return false;
    return true;
  }
  function pick(raycaster: THREE.Raycaster) {
    root.updateWorldMatrix(true, true);
    return raycaster.intersectObjects(meshes, false).find(hit => {
      const mesh = hit.object as THREE.Mesh;
      const material = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
      return visible(mesh) && material?.visible && material.opacity > 0
        && (sectionAxis === 'none' || plane.distanceToPoint(hit.point) >= -1e-6);
    });
  }
  function update() {
    sections.update(sectionAxis === 'none' ? null : plane);
    let selectedVisible = false;
    selected?.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !visible(object)) return;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      if (list.some(material => material.visible && material.opacity > 0)) selectedVisible = true;
    });
    selectedBounds.visible = selectedVisible;
    if (selectedBounds.visible && selected) selectedBounds.box.setFromObject(selected);
  }
  return {
    overlay, setBody, setSection, pick, update,
    select(object: THREE.Object3D | null) { selected = object; update(); },
    dispose() {
      if (disposed) return; disposed = true;
      sections.dispose(); selectedBounds.geometry.dispose();
      (selectedBounds.material as THREE.Material).dispose();
      for (const [mesh, original] of originals) { mesh.material = original.material; mesh.visible = original.visible; }
      for (const material of materials) material.clippingPlanes = originalPlanes.get(material)!;
      copies.forEach(material => material.dispose()); overlay.removeFromParent(); overlay.clear();
    },
  };
}
