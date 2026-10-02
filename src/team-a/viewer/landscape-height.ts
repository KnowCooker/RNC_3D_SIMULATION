import { MathUtils } from 'three';
import type { GalleryEnvironment } from './champagne-gallery';
import { routeAtWorldZ } from './driving-route';

const mix = MathUtils.lerp, smooth = MathUtils.smoothstep;
function hash(x: number, z: number) {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967295;
}
export function landscapeNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return mix(mix(hash(ix, iz), hash(ix + 1, iz), ease(fx)), mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), ease(fx)), ease(fz));
}
/** Broad mass, subsidiary ridges and fine weathering; no periodic folded-sine peaks. */
export function landscapeRelief(x: number, z: number, env: GalleryEnvironment) {
  const warp = landscapeNoise(x / 270, z / 270) * 90;
  const broad = landscapeNoise((x + warp) / 220, (z - warp) / 240);
  const ridgeNoise = 2 * landscapeNoise((x + warp) / 115, z / 145) - 1;
  const ridge = 1 - Math.sqrt(ridgeNoise * ridgeNoise + .035);
  const detail = landscapeNoise(x / 38, z / 38) * 2 + landscapeNoise(x / 13, z / 13) * .45;
  const amplitude = env === 'coast' ? 22 : env === 'desert' ? 34 : env === 'snow' ? 90 : 72;
  return amplitude * (broad * .82 + ridge * ridge * .18) + detail;
}
export function galleryHeight(x: number, z: number, env: GalleryEnvironment) {
  const radius = Math.hypot(x, z), coast = env === 'coast';
  const edge = smooth(radius, coast ? 180 : 75, coast ? 340 : 260);
  // Low, receding foothills leave space for the captured distant mountain skyline.
  return -2.2 + edge * landscapeRelief(x, z, env) * (env === 'mountain' ? .7 : env === 'snow' ? .8 : 1);
}

export const ROAD_WATER_LEVEL = -16;
/** Cartesian ground, independent of the road ribbon: cannot fold at the inside of a bend. */
export function drivingGroundHeight(x: number, z: number, env: GalleryEnvironment) {
  let u = z;
  const centre = routeAtWorldZ(z), projectionWeight = 1 - smooth(Math.abs(x - centre.x), 35, 100);
  // Project to the nearest centreline in the horizontal plane (monotonic route Z).
  for (let i = 0; i < 4; i++) {
    const frame = routeAtWorldZ(u);
    const step = ((frame.x - x) * frame.dx + u - z) / (1 + frame.dx * frame.dx);
    u -= MathUtils.clamp(step, -15, 15) * projectionWeight;
  }
  const frame = routeAtWorldZ(u), lateral = ((x - frame.x) - (z - u) * frame.dx) / Math.sqrt(1 + frame.dx * frame.dx);
  const side = Math.abs(lateral - 1.8), verge = smooth(side, 7, 27), foothill = smooth(side, 24, 190);
  const relief = landscapeRelief(x, z, env);
  let land = frame.y - .13 + verge * .7 + foothill * relief;
  if ((env === 'coast' || env === 'mountain') && lateral < 0) {
    // A level lake with a graded bank. Water never follows the road's pitch.
    const shore = smooth(-lateral, 13, 57), farBank = smooth(-lateral, 175, 290);
    land = mix(land, ROAD_WATER_LEVEL - 2 + farBank * (relief + 20), shore);
  }
  return land;
}

export function sceneryVisibility(distance: number) { return 1 - smooth(distance, 230, 360); }
