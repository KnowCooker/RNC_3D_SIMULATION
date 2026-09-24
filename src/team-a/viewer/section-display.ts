import * as THREE from 'three';
import { sectionGeometry } from './section-geometry';

/** CPU contours follow the actual source mesh, while the existing GPU plane clips its visible surface. */
export function createSectionDisplay(modelRoot: THREE.Group) {
  const group = new THREE.Group(); group.name = 'vehicle-sections';
  const hatch = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const value = (x + y) % 16 < 3 ? 95 : 245, i = (y * 32 + x) * 4;
    hatch[i] = hatch[i + 1] = hatch[i + 2] = value; hatch[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(hatch, 32, 32); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12); texture.needsUpdate = true;
  const rows: { source: THREE.Mesh; cap: THREE.Mesh; contour: THREE.LineSegments; lastPlane: THREE.Vector4 }[] = [];
  modelRoot.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const baseColor = (material as THREE.MeshStandardMaterial).color ?? new THREE.Color('#b0bec8');
    const capMaterial = new THREE.MeshStandardMaterial({ color: baseColor.clone().lerp(new THREE.Color('#e6ba75'), 0.35), map: texture,
      side: THREE.DoubleSide, roughness: 0.86, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const cap = new THREE.Mesh(new THREE.BufferGeometry(), capMaterial); cap.name = 'section-cap';
    const contour = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f2c572', transparent: true, opacity: 0.9 }));
    contour.name = 'section-contour';
    for (const piece of [cap, contour]) { piece.matrixAutoUpdate = false; piece.frustumCulled = false; piece.visible = false; piece.renderOrder = 2; piece.userData.sourceMeshId = object.id; group.add(piece); }
    rows.push({ source: object, cap, contour, lastPlane: new THREE.Vector4(Infinity, Infinity, Infinity, Infinity) });
  });
  const inverse = new THREE.Matrix4(), localPlane = new THREE.Plane(), state = new THREE.Vector4();
  function visible(object: THREE.Object3D) { for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return false; return true; }
  return {
    group,
    update(plane: THREE.Plane | null) {
      group.visible = !!plane; if (!plane) return;
      modelRoot.updateWorldMatrix(true, true);
      for (const row of rows) {
        const material = Array.isArray(row.source.material) ? row.source.material[0] : row.source.material;
        if (!visible(row.source) || !material.visible || material.opacity <= 0) { row.cap.visible = row.contour.visible = false; continue; }
        inverse.copy(row.source.matrixWorld).invert(); localPlane.copy(plane).applyMatrix4(inverse);
        state.set(localPlane.normal.x, localPlane.normal.y, localPlane.normal.z, localPlane.constant);
        if (Math.max(Math.abs(state.x - row.lastPlane.x), Math.abs(state.y - row.lastPlane.y), Math.abs(state.z - row.lastPlane.z), Math.abs(state.w - row.lastPlane.w)) > 1e-7) {
          const section = sectionGeometry(row.source.geometry, localPlane, row.source.geometry.userData.sectionClosed === true);
          row.cap.geometry.dispose(); row.contour.geometry.dispose();
          row.cap.geometry = section.cap ?? new THREE.BufferGeometry(); row.contour.geometry = section.contour ?? new THREE.BufferGeometry();
          row.cap.userData.openChains = section.openChains; row.cap.userData.closedLoops = section.closedLoops;
          row.lastPlane.copy(state);
        }
        row.cap.visible = !!row.cap.geometry.getAttribute('position'); row.contour.visible = !!row.contour.geometry.getAttribute('position');
        row.cap.matrix.copy(row.source.matrixWorld); row.contour.matrix.copy(row.source.matrixWorld);
        const capMaterial = row.cap.material as THREE.MeshStandardMaterial;
        capMaterial.opacity = material.opacity; capMaterial.transparent = material.transparent; capMaterial.depthWrite = !material.transparent;
      }
    },
    dispose() {
      rows.forEach(row => { row.cap.geometry.dispose(); row.contour.geometry.dispose(); (row.cap.material as THREE.Material).dispose(); (row.contour.material as THREE.Material).dispose(); });
      texture.dispose(); group.clear();
    },
  };
}
