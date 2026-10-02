import { Vector3 } from 'three';
import type { StageMode } from './scene-stage';

/** Outdoor orbit stays in the clear viewing area. Workshop retains deliberate underfloor inspection. */
export function constrainEnvironmentCamera(position: Vector3, target: Vector3, mode: StageMode, asset?: string) {
  if (mode === 'workshop') return;
  const before = target.clone();
  target.x = Math.max(-2, Math.min(2, target.x));
  target.y = Math.max(.45, Math.min(2.2, target.y));
  target.z = Math.max(-1.5, Math.min(1.5, target.z));
  position.add(target.clone().sub(before));
  const offset = position.clone().sub(target), limit = mode === 'road' ? 19 : 20;
  if (offset.length() > limit) position.copy(target).add(offset.setLength(limit));
  const horizontal = Math.hypot(position.x,position.z);
  if (horizontal > limit) { position.x *= limit / horizontal; position.z *= limit / horizontal; }
  position.y = Math.max(mode === 'road' ? 1.1 : .4, position.y);
  // A conservative envelope around the largest current vehicle; seat views bypass this function.
  const halfLength = asset === 'xpeng-x9' || asset === 'xpeng-gx' ? 2.9 : 2.65;
  const roof = asset === 'xpeng-x9' || asset === 'xpeng-gx' ? 2.15 : 1.85;
  if (position.y < roof && Math.abs(position.x) < 1.5 && Math.abs(position.z) < halfLength + .4) {
    const scale = Math.min(1.5 / Math.max(.001, Math.abs(position.x)), (halfLength + .4) / Math.max(.001, Math.abs(position.z)));
    if (Math.hypot(position.x,position.z) < .01) position.z = -halfLength - .4;
    else { position.x *= scale; position.z *= scale; }
  }
}
