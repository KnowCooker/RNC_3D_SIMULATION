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
  const radius = Math.hypot(x, z), angle = Math.atan2(z, x);
  const lake = env === 'coast' || env === 'mountain';
  // The pavilion sits in a continuous island, rather than over a missing annulus.
  // A restrained, irregular shore reveals real depth without obscuring the photo skyline.
  const shoreline = 37 + 2.4 * Math.sin(angle * 3 + .7) + 1.5 * Math.sin(angle * 5 - .3);
  const beach = smooth(radius, 27.2, shoreline);
  const shelf = mix(-.13, -.45, beach);
  // The two ±X stairs end at y=-.36. Their foundations enter this dry landing soil.
  const stair = (1 - smooth(Math.abs(z), 2.15, 3.6)) * (1 - smooth(radius, 31.1, 33.5));
  const landing = mix(shelf, -.405, stair);
  const basin = smooth(radius, shoreline, shoreline + 11);
  const near = mix(landing, lake ? -2.6 : -.72, basin);
  const relief = landscapeRelief(x, z, env);
  const foothill = smooth(radius, lake ? 115 : 62, lake ? 420 : 345);
  const distant = relief * (env === 'coast' ? .65 : env === 'mountain' ? .38 : env === 'snow' ? .32 : .45);
  const smallRelief = (landscapeNoise(x / 19, z / 19) - .5) * .85;
  return near + foothill * (distant + smallRelief);
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
