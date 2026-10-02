import * as THREE from 'three';

// Authored scenic route, not a measured road. Arc-length parameterisation keeps
// tyre travel, world motion and the experiment clock in the same metre scale.
const period = 2048, steps = 8192, du = period / steps;
function center(u: number) {
  const a = u * Math.PI * 2 / period;
  return new THREE.Vector3(38 * Math.sin(3 * a + .4) + 16 * Math.sin(7 * a), 8 * Math.sin(2 * a) + 3 * Math.sin(5 * a + .6), u);
}
function derivative(u: number) {
  const a = u * Math.PI * 2 / period, k = Math.PI * 2 / period;
  return new THREE.Vector3(k * (114 * Math.cos(3 * a + .4) + 112 * Math.cos(7 * a)), k * (16 * Math.cos(2 * a) + 15 * Math.cos(5 * a + .6)), 1);
}
const lengths = new Float64Array(steps + 1);
for (let i = 1; i <= steps; i++) lengths[i] = lengths[i - 1] + du / 6 * (derivative((i - 1) * du).length() + 4 * derivative((i - .5) * du).length() + derivative(i * du).length());
export const routePeriodMetres = lengths[steps];
export function sampleDrivingRoute(distance: number) {
  const d = Number.isFinite(distance) ? distance : 0;
  const cycle = Math.floor(d / routePeriodMetres), local = d - cycle * routePeriodMetres;
  let lo = 0, hi = steps;
  while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (lengths[mid] <= local) lo = mid; else hi = mid; }
  let u = (lo + (local - lengths[lo]) / (lengths[hi] - lengths[lo])) * du;
  // One Newton refinement removes lookup interpolation speed ripple.
  const start=lo*du, span=u-start;
  const integrated=span/6*(derivative(start).length()+4*derivative(start+span/2).length()+derivative(u).length());
  u-=(lengths[lo]+integrated-local)/derivative(u).length();
  const position = center(u); position.z += cycle * period;
  const tangent = derivative(u).normalize();
  const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
  const up = new THREE.Vector3().crossVectors(tangent, right).normalize();
  const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, tangent));
  return { position, tangent, right, up, rotation, grade: tangent.y / Math.hypot(tangent.x, tangent.z) };
}
export function routePoint(distance: number, lateral = 0, height = 0) {
  const frame = sampleDrivingRoute(distance);
  return frame.position.addScaledVector(frame.right, lateral).addScaledVector(frame.up, height);
}
