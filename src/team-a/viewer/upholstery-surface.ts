import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Upholstery is a visual skin only; callers retain the assembled part origin.
 * Closed rounded surfaces retain their width/depth envelope and can be sectioned. */
export function upholsterySurface(width: number, height: number, depth: number, kind: 'cushion' | 'back' | 'headrest') {
  const geometry = new RoundedBoxGeometry(width, height, depth, 7, Math.min(height, depth, width) * .37);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal'), jacobian = new THREE.Matrix3(), normal = new THREE.Vector3();
  function shape(x: number, y: number, z: number): [number, number, number] {
    const u = x / (width / 2), v = (y / height + .5), w = z / (depth / 2);
    if (kind === 'back') {
      // Narrow lumbar section, rounded shoulders and a padded front face.
      return [x * (.84 + .16 * Math.sin(v * Math.PI * .84)),
        y - .018 * Math.pow(Math.abs(u), 4) * v,
        z + .026 * (1 - u * u) * Math.sin(v * Math.PI) * Math.max(0, w)];
    } else if (kind === 'cushion') {
      return [x * (.94 + .06 * (1 - w) / 2),
        y + .018 * (1 - u * u) * (1 - w * w) * Math.max(0, v), z];
    } else {
      return [x * (.94 + .06 * Math.sin(v * Math.PI)), y,
        z + .009 * (1 - u * u) * Math.sin(v * Math.PI) * Math.max(0, w)];
    }
  }
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i), e = .00001;
    positions.setXYZ(i, ...shape(x, y, z));
    const dx = shape(x+e,y,z).map((v,j) => (v-shape(x-e,y,z)[j])/(2*e));
    const dy = shape(x,y+e,z).map((v,j) => (v-shape(x,y-e,z)[j])/(2*e));
    const dz = shape(x,y,z+e).map((v,j) => (v-shape(x,y,z-e)[j])/(2*e));
    jacobian.set(dx[0],dy[0],dz[0],dx[1],dy[1],dz[1],dx[2],dy[2],dz[2]).invert().transpose();
    normal.fromBufferAttribute(normals,i).applyMatrix3(jacobian).normalize(); normals.setXYZ(i,normal.x,normal.y,normal.z);
  }
  positions.needsUpdate = normals.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.sectionClosed = true;
  return geometry;
}

/** Deterministic, locally generated material micrograin; no model/photo texture is implied. */
export function upholsteryGrain() {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hash = Math.imul(x + 29, 374761393) ^ Math.imul(y + 17, 668265263);
    const shade = 205 + ((hash ^ hash >>> 13) >>> 0) % 41;
    pixels.set([shade, shade, shade, 255], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7); texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
