import * as THREE from 'three';

/** Depth from the actual opaque vehicle meshes keeps seats legible inside the heat field.
 * Transparent bodywork never becomes an invisible occluder. No acoustic sample is edited.
 */
export function createFieldOcclusion() {
  const depth = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: depth });
  const scene = new THREE.Scene();
  const material = new THREE.MeshDepthMaterial();
  material.colorWrite = false;
  scene.overrideMaterial = material;
  const size = new THREE.Vector2();
  return {
    texture: depth,
    size,
    render(renderer: THREE.WebGLRenderer, root: THREE.Object3D, camera: THREE.PerspectiveCamera) {
      renderer.getDrawingBufferSize(size);
      if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
      const parent = root.parent, index = parent?.children.indexOf(root) ?? -1;
      const previousTarget = renderer.getRenderTarget(), shadowUpdate = renderer.shadowMap.autoUpdate;
      const hidden: THREE.Object3D[] = [];
      material.clippingPlanes=null;
      root.traverse(object => {
        if (!object.visible) return;
        if(object instanceof THREE.Line){hidden.push(object);object.visible=false;return;}
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        const clipped=materials.find(m=>m.clippingPlanes?.length);
        if(clipped)material.clippingPlanes=clipped.clippingPlanes;
        if (materials.every(m => !m.visible || m.transparent || !m.depthWrite)) {
          hidden.push(object); object.visible = false;
        }
      });
      try {
        scene.add(root); renderer.shadowMap.autoUpdate = false;
        renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(previousTarget); renderer.shadowMap.autoUpdate = shadowUpdate;
        scene.remove(root);
        if (parent) {
          parent.add(root);
          parent.children.splice(parent.children.indexOf(root), 1);
          parent.children.splice(index, 0, root);
        }
        hidden.forEach(object => { object.visible = true; });
      }
    },
    dispose() { material.dispose(); target.dispose(); },
  };
}
