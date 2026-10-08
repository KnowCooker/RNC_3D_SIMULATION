import * as THREE from 'three';
import type { GalleryEnvironment } from './champagne-gallery';
import { galleryHeight, landscapeNoise } from './landscape-height';

export const GALLERY_SHORE_INNER_RADIUS = 27.05;
export const GALLERY_LANDSCAPE_RADIUS = 640;
export const GALLERY_WATER_LEVEL = -.45;

/** Fine shore rings and progressively wider distant rings share one indexed surface. */
export function galleryTerrainRadii() {
  const radii = [GALLERY_SHORE_INNER_RADIUS];
  for (let r = 27.5; r <= 48; r += .5) radii.push(r);
  for (let r = 50; r <= 110; r += 2) radii.push(r);
  for (let r = 114; r <= GALLERY_LANDSCAPE_RADIUS; r += 4) radii.push(r);
  if (radii.at(-1) !== GALLERY_LANDSCAPE_RADIUS) radii.push(GALLERY_LANDSCAPE_RADIUS);
  return radii;
}

export function createGalleryTerrainGeometry(env: GalleryEnvironment, angular = 384) {
  const positions: number[] = [], normals: number[] = [], colours: number[] = [], uv: number[] = [], indices: number[] = [];
  const green = new THREE.Color(env === 'coast' ? '#879875' : '#81916e');
  const stone = new THREE.Color('#a49d8d'), sand = new THREE.Color('#bfa482'), snow = new THREE.Color('#e2e9e6');
  const radii = galleryTerrainRadii();
  for (const radius of radii) for (let a = 0; a <= angular; a++) {
    const angle = (a === angular ? 0 : a / angular) * Math.PI * 2;
    const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius, y = galleryHeight(x, z, env);
    const dx = (galleryHeight(x + .2, z, env) - galleryHeight(x - .2, z, env)) / .4;
    const dz = (galleryHeight(x, z + .2, env) - galleryHeight(x, z - .2, env)) / .4;
    const slope = Math.hypot(dx, dz), n = new THREE.Vector3(-dx, 1, -dz).normalize();
    positions.push(x, y, z); normals.push(...n.toArray()); uv.push(x / 11, z / 11);
    const nearShore = 1 - THREE.MathUtils.smoothstep(radius, 36, 53);
    const color = (env === 'desert' ? sand : env === 'snow' ? snow : green).clone();
    color.lerp(stone, Math.min(env === 'snow' ? .25 : .6, slope * .75));
    if (env === 'coast' || env === 'mountain') color.lerp(sand, nearShore * .7);
    color.multiplyScalar(.95 + .1 * landscapeNoise(x / 6, z / 6));
    colours.push(color.r, color.g, color.b);
  }
  for (let r = 0; r < radii.length - 1; r++) for (let a = 0; a < angular; a++) {
    const i = r * (angular + 1) + a, j = i + angular + 1;
    // Outward radial then azimuthal winding faces upward.
    indices.push(i, j, i + 1, i + 1, j, j + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}

export interface GalleryLandscapePlacement {
  x: number; y: number; z: number; scale: number; angle: number;
}

/** Stable authored landscape, not measured vegetation or a surveyed shoreline. */
export function galleryLandscapePlacements(env: GalleryEnvironment, kind: 'rock' | 'tree' | 'grass', count: number): GalleryLandscapePlacement[] {
  let seed = kind === 'rock' ? 9123 : kind === 'tree' ? 52499 : 8724;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const rows: GalleryLandscapePlacement[] = [], lake = env === 'coast' || env === 'mountain';
  if (env === 'desert' && kind !== 'rock') return rows;
  // Qwantani's grassy mesa landscape has no foreground conifer belt.
  if (env === 'coast' && kind === 'tree') return rows;
  const groves: { x: number; z: number }[] = [];
  if (kind === 'tree') {
    // Anchor groves on dry foothills, then scatter within each grove. Most of the
    // real tree geometry remains before the 240 m photographic blend boundary.
    for (let attempt = 0; groves.length < 16 && attempt < 240; attempt++) {
      const angle = random() * Math.PI * 2, radius = env === 'mountain' ? 190 + random() * 36 : 146 + random() * 73;
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      if (galleryHeight(x, z, env) < .55 || groves.some(grove => Math.hypot(grove.x - x, grove.z - z) < 30)) continue;
      groves.push({ x, z });
    }
    if (!groves.length) return rows;
  }
  for (let attempt = 0; rows.length < count && attempt < count * 24; attempt++) {
    const angle = random() * Math.PI * 2, near = random() < (kind === 'rock' ? .62 : kind === 'grass' ? .84 : 0);
    const radius = kind === 'tree' ? 0 : near ? 30.5 + random() * 18 : 65 + random() * 350;
    let x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
    if (kind === 'tree') {
      const grove = groves[Math.floor(random() * groves.length)];
      x = grove.x + (random() + random() - 1) * 17;
      z = grove.z + (random() + random() - 1) * 17;
      if (Math.hypot(x, z) < 140 || Math.hypot(x, z) > 235) continue;
    }
    const y = galleryHeight(x, z, env);
    const scale = kind === 'tree' ? 2.6 + random() ** 1.35 * 7.8 : kind === 'rock' ? .22 + random() ** 2 * 1.15 : .28 + random() * .48;
    if (kind === 'tree' && rows.some(row => Math.hypot(row.x - x, row.z - z) < 1.2 + scale * .08)) continue;
    const slope = Math.hypot(galleryHeight(x + .5, z, env) - galleryHeight(x - .5, z, env), galleryHeight(x, z + .5, env) - galleryHeight(x, z - .5, env));
    // Full footprint clearance from the platform and both stair landings.
    if (Math.hypot(x, z) - scale < 29.2 || (Math.abs(z) < 3.2 + scale && Math.abs(x) < 33.1 + scale)) continue;
    if (slope > .65 || (lake && y < GALLERY_WATER_LEVEL + (kind === 'rock' ? -.16 : .035))) continue;
    if (kind === 'tree' && y < .35) continue;
    rows.push({ x, y, z, scale, angle: random() * Math.PI * 2 });
  }
  return rows;
}
