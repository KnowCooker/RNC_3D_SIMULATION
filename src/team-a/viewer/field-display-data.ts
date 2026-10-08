import type { FieldFrame } from '../../shared/lab-contracts';

import { LEGACY_FIELD_GRID, gridForCount } from './field-grid';
export const fieldGrid = LEGACY_FIELD_GRID;
export type FieldQuantity = 'primary' | 'residual' | 'reduction';
export const pressureColors = ['#293bbb', '#087ce5', '#00c9dc', '#36ca80', '#e1e646', '#ff9829', '#e72851'];
export const reductionColors = ['#a41242', '#e73a45', '#f6a181', '#e5e8e4', '#73d9c6', '#079ac7', '#2549bd'];

/** Display interpolation only. Texture values are mean-square ratios relative to 60 dB. */
export function displayEnergy(db: number): number {
  if (!Number.isFinite(db)) throw Error('Non-finite field sample');
  return 10 ** Math.max(-30, Math.min(30, (db - 60) / 10));
}

/** Reorder the worker's x/y/z grid to WebGL's x-fastest texture storage. */
export function packFieldVolume(frame: FieldFrame, target = new Float32Array(frame.primarySpl.length * 2)): Float32Array {
  const grid = gridForCount(frame.primarySpl.length);
  if (frame.residualSpl.length !== frame.primarySpl.length || target.length !== frame.primarySpl.length * 2) throw Error('Incomplete field volume');
  for (let x = 0; x < grid.x; x++) for (let y = 0; y < grid.y; y++) for (let z = 0; z < grid.z; z++) {
    const sample = (x * grid.y + y) * grid.z + z, texel = ((z * grid.y + y) * grid.x + x) * 2;
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
