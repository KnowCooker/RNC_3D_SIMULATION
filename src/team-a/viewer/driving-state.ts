import type { Vec3 } from '../../shared/lab-contracts';

export type DrivingView = 'orbit' | 'overhead' | 'fl' | 'fr' | 'rl' | 'rr';
// Eye positions derived from the current P7+ seat geometry, in the SAME car coordinates.
// They are viewing locations, not replacements for the acoustic microphones.
export const cabinViews: Record<Exclude<DrivingView, 'orbit' | 'overhead'>, { label: string; eye: Vec3; seat: string }> = {
  fl: { label: '主驾', eye: [.465, 1.17, .49], seat: 'seat-1-1' },
  fr: { label: '副驾', eye: [-.465, 1.17, .49], seat: 'seat-1-2' },
  rl: { label: '左后排', eye: [.49, 1.17, -.72], seat: 'seat-2-1' },
  rr: { label: '右后排', eye: [-.49, 1.17, -.72], seat: 'seat-2-3' },
};
export const isCabinView = (view: DrivingView): view is keyof typeof cabinViews => view in cabinViews;
export function travelDistance(time: number, speedKph: number) {
  if (!Number.isFinite(time) || !Number.isFinite(speedKph)) return 0;
  return Math.max(0, time) * Math.max(0, speedKph) / 3.6;
}
/** A stable world-indexed segment. Seeking backward reconstructs exactly the same scenery. */
export function roadSegment(slot: number, distance: number, count = 12, length = 48) {
  const first = Math.floor(distance / length) - 3;
  const index = first + ((slot - first % count + count) % count);
  return { index, z: index * length - distance };
}
export function drivingLook(eye: Vec3, yaw = 0, pitch = 0): Vec3 {
  const p = Math.max(-.55, Math.min(.55, pitch));
  return [eye[0] + Math.sin(yaw) * Math.cos(p) * 5, eye[1] + Math.sin(p) * 5, eye[2] + Math.cos(yaw) * Math.cos(p) * 5];
}
