import * as THREE from 'three';
import type { Vec3 } from '../../shared/lab-contracts';

/** Orbit between poses rather than cutting through the car. New input replaces the active move. */
export function createCameraMotion(camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
  let move: { start: number; duration: number; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; from: THREE.Spherical; to: THREE.Spherical; fromFov: number; fov: number; finalPosition: THREE.Vector3 } | null = null;
  return {
    get active() { return move !== null; },
    cancel() { move = null; },
    start(position: Vec3, destination: Vec3, fov: number, now: number, duration: number) {
      const end = new THREE.Vector3(...position), toTarget = new THREE.Vector3(...destination);
      const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
      const to = new THREE.Spherical().setFromVector3(end.clone().sub(toTarget));
      to.theta = from.theta + Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
      move = { start: now, duration, fromTarget: target.clone(), toTarget, from, to, fromFov: camera.fov, fov, finalPosition: end };
      if (duration <= 0) { camera.position.copy(end); target.copy(toTarget); camera.fov = fov; camera.updateProjectionMatrix(); move = null; }
    },
    update(now: number) {
      if (!move) return;
      const t = Math.min(1, Math.max(0, (now - move.start) / move.duration));
      const ease = t * t * (3 - 2 * t);
      target.lerpVectors(move.fromTarget, move.toTarget, ease);
      const pose = new THREE.Spherical(THREE.MathUtils.lerp(move.from.radius, move.to.radius, ease), THREE.MathUtils.lerp(move.from.phi, move.to.phi, ease), THREE.MathUtils.lerp(move.from.theta, move.to.theta, ease));
      camera.position.setFromSpherical(pose).add(target); camera.fov = THREE.MathUtils.lerp(move.fromFov, move.fov, ease); camera.updateProjectionMatrix();
      if (t === 1) { camera.position.copy(move.finalPosition); target.copy(move.toTarget); move = null; }
    },
  };
}
