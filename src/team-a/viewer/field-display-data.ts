import type { FieldFrame } from '../../shared/lab-contracts';

export const fieldGrid = { x: 7, y: 5, z: 8 } as const;
export type FieldQuantity = 'primary' | 'residual' | 'reduction';
export const pressureColors = ['#2446ad', '#00a9db', '#31ce9c', '#f5d340', '#de453c'];
export const reductionColors = ['#a91531', '#ea4930', '#d7ddda', '#009991', '#064ea0'];

/** Display interpolation only. Texture values are mean-square ratios relative to 60 dB. */
export function displayEnergy(db: number): number {
  if (!Number.isFinite(db)) throw Error('Non-finite field sample');
  return 10 ** Math.max(-30, Math.min(30, (db - 60) / 10));
}

/** Reorder the worker's x/y/z grid to WebGL's x-fastest texture storage. */
export function packFieldVolume(frame: FieldFrame, target = new Float32Array(7 * 5 * 8 * 2)): Float32Array {
  if (frame.primarySpl.length !== 280 || frame.residualSpl.length !== 280 || target.length !== 560) throw Error('Incomplete field volume');
  for (let x = 0; x < 7; x++) for (let y = 0; y < 5; y++) for (let z = 0; z < 8; z++) {
    const sample = (x * 5 + y) * 8 + z, texel = ((z * 5 + y) * 7 + x) * 2;
    target[texel] = displayEnergy(frame.primarySpl[sample]);
    target[texel + 1] = displayEnergy(frame.residualSpl[sample]);
  }
  return target;
}

export function fieldValues(frame: FieldFrame, quantity: FieldQuantity): Float32Array {
  return quantity === 'primary' ? frame.primarySpl : quantity === 'residual' ? frame.residualSpl
    : Float32Array.from(frame.primarySpl, (v, i) => v - frame.residualSpl[i]);
}

/** A user-locked range is shared by primary and residual, never auto-normalized per mode. */
export function pairedFieldRange(frame: FieldFrame): [number, number] {
  const all = [...frame.primarySpl, ...frame.residualSpl];
  if (!all.length || all.some(v => !Number.isFinite(v))) throw Error('Invalid field range');
  const low = Math.floor(Math.min(...all) / 5) * 5;
  return [low, Math.max(low + 10, Math.ceil(Math.max(...all) / 5) * 5)];
}

/** Zero stays neutral. Lock both signs together so worsening is never hidden by normalization. */
export function improvementFieldRange(frame: FieldFrame): [number, number] {
  const values = fieldValues(frame, 'reduction');
  if (!values.length || values.some(v => !Number.isFinite(v))) throw Error('Invalid improvement range');
  const extent = Math.max(3, Math.ceil(Math.max(...values.map(Math.abs))));
  return [-extent, extent];
}
