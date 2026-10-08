import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

/** Consume the native response completely before decoding. Avoids the intermediary
 * FileLoader progress stream that reports spurious aborted transfers in Chrome. */
export async function loadHDRTexture(url: string): Promise<THREE.DataTexture> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HDR request failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const parsed = new HDRLoader().parse(buffer);
  const texture = new THREE.DataTexture(parsed.data, parsed.width, parsed.height, THREE.RGBAFormat, parsed.type);
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = true;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}
