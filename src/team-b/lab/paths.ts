import { labLayout, P7_LAYOUT_ID, type LabConfig, type Vec3, type VehicleKind } from '../../shared/lab-contracts';
import { RECORDED_PROFILE } from './recorded-profile';
import { TEACHING_PRESSURE_GAIN } from './pressure-calibration';

/** Short, causal teaching impulse responses. All positions are in assembled-car metres. */
export interface SparsePath { delays: number[]; gains: number[] }
export const VEHICLE_ACOUSTICS: Record<VehicleKind, { primary: number; bodyDelay: number; reflection: number; roof: number }> = {
  ice: { primary: 1.08, bodyDelay: 11, reflection: 0.21, roof: 1.93 },
  bev: { primary: 0.94, bodyDelay: 13, reflection: 0.17, roof: 1.90 },
  hev: { primary: 1.02, bodyDelay: 12, reflection: 0.19, roof: 1.92 },
  erev: { primary: 0.98, bodyDelay: 14, reflection: 0.23, roof: 1.94 },
};
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const soundSpeed = (temperatureC: number) => 331.3 * Math.sqrt((temperatureC + 273.15) / 273.15);

function fractionalPath(components: { delay: number; gain: number }[], shape: number[]): SparsePath {
  const bins = new Map<number, number>();
  for (const component of components) {
    const delay = Math.floor(component.delay), fraction = component.delay - delay;
    for (let k = 0; k < shape.length; k++) {
      bins.set(delay + k, (bins.get(delay + k) ?? 0) + component.gain * shape[k] * (1 - fraction));
      bins.set(delay + k + 1, (bins.get(delay + k + 1) ?? 0) + component.gain * shape[k] * fraction);
    }
  }
  const entries = [...bins].filter(([, gain]) => Math.abs(gain) > 1e-15).sort(([a], [b]) => a - b);
  return { delays: entries.map(([delay]) => delay), gains: entries.map(([, gain]) => gain) };
}

function acousticPath(config: LabConfig, source: Vec3, point: Vec3, gain: number, extraDelay: number, secondary: boolean): SparsePath {
  const profile = VEHICLE_ACOUSTICS[config.vehicle], fs = config.sampleRateHz, c = soundSpeed(config.temperatureC);
  // Image sources give a floor and roof early reflection; this is not FEM/BEM or a measured cabin.
  const layout = labLayout(config), roof = config.layoutId === P7_LAYOUT_ID ? layout.roof : profile.roof;
  const positions: Vec3[] = [source, [source[0], 2 * layout.floor - source[1], source[2]], [source[0], 2 * roof - source[1], source[2]]];
  const relative = [1, profile.reflection, profile.reflection * 0.6];
  return fractionalPath(positions.map((position, i) => {
    const r = distance(position, point);
    return { delay: extraDelay + r / c * fs, gain: gain * relative[i] / (0.4 + r) };
  }), secondary ? [0.18, 0.32, 0.32, 0.18] : [0.72, 0.28]);
}

export function geometricPrimaryPath(config: LabConfig, sourceIndex: number, point: Vec3): SparsePath {
  const wheel = labLayout(config).sources[sourceIndex], profile = VEHICLE_ACOUSTICS[config.vehicle];
  // Wheel excitation reaches the floor through the suspension/body, which then radiates into the cabin.
  const radiator: Vec3 = [wheel[0] * 0.72, 0.58, wheel[2] * 0.85];
  return acousticPath(config, radiator, point, 0.065 * profile.primary, profile.bodyDelay, false);
}

export function primaryPath(config: LabConfig, sourceIndex: number, point: Vec3): SparsePath {
  if (config.sourceMode === 'recorded-noise') {
    // A local dominant equivalent path preserves each recorded seat's spectrum,
    // while a 5% coupling floor retains every source at every spatial point.
    // This fitted teaching spatial envelope is not measured radiation directivity.
    const wheel = labLayout(config).sources[sourceIndex], anchor = labLayout(config).microphones[sourceIndex];
    const profile = VEHICLE_ACOUSTICS[config.vehicle];
    const radiator: Vec3 = [wheel[0] * .72, .58, wheel[2] * .85];
    const layout = labLayout(config), roof = config.layoutId === P7_LAYOUT_ID ? layout.roof : profile.roof;
    const positions: Vec3[] = [radiator, [radiator[0], 2*layout.floor-radiator[1], radiator[2]], [radiator[0], 2*roof-radiator[1], radiator[2]]];
    const locality = .05 + .95 * Math.exp(-(((point[0]-anchor[0])/.4)**2 + ((point[2]-anchor[2])/.6)**2));
    const scale = RECORDED_NOISE_PRESSURE_GAIN * 10 ** ((config.levelOffsetDb ?? 0) / 20);
    const bins = new Map<number, number>();
    for (let reflection = 0; reflection < positions.length; reflection++) {
      const r = distance(positions[reflection], point);
      const delay = profile.bodyDelay + r/soundSpeed(config.temperatureC)*config.sampleRateHz;
      const integer = Math.floor(delay), fraction = delay-integer;
      // A 17-tap windowed-sinc fractional delay adds 8 causal samples of latency,
      // avoiding the strong high-frequency rolloff of a two-tap interpolation.
      const taps = Array.from({ length: 17 }, (_, k) => {
        const at = k-8-fraction;
        return (Math.abs(at)<1e-12 ? 1 : Math.sin(Math.PI*at)/(Math.PI*at)) * (.42-.5*Math.cos(2*Math.PI*k/16)+.08*Math.cos(4*Math.PI*k/16));
      });
      const norm = taps.reduce((sum, value) => sum+value, 0);
      const reflectionGain = reflection === 0 ? 1 : profile.reflection * (reflection === 1 ? 1 : .6);
      const gain = .065 * profile.primary * locality * reflectionGain / (.4+r) * scale;
      taps.forEach((value, k) => bins.set(integer+k, (bins.get(integer+k) ?? 0) + gain*value/norm));
    }
    const entries = [...bins].filter(([,gain])=>Math.abs(gain)>1e-15).sort(([a],[b])=>a-b);
    return { delays: entries.map(([delay])=>delay), gains: entries.map(([,gain])=>gain) };
  }
  const geometry = geometricPrimaryPath(config, sourceIndex, point);
  // A common causal coloration fits pooled recorded noise shape, not a measured
  // primary transfer function. Arbitrary field points reuse this same path.
  const values = new Float64Array(Math.max(...geometry.delays) + RECORDED_PROFILE.primaryColorFir.length);
  for (let j = 0; j < geometry.delays.length; j++) for (let k = 0; k < RECORDED_PROFILE.primaryColorFir.length; k++) {
    values[geometry.delays[j] + k] += geometry.gains[j] * RECORDED_PROFILE.primaryColorFir[k];
  }
  const delays: number[] = [], gains: number[] = [];
  const scale = TEACHING_PRESSURE_GAIN * 10 ** ((config.levelOffsetDb ?? 0) / 20);
  values.forEach((gain, delay) => { if (Math.abs(gain) > 1e-15) { delays.push(delay); gains.push(gain * scale); } });
  return { delays, gains };
}

/** Teaching Pa gain for the normalized recorded-noise sources; not a V/Pa calibration. */
export const RECORDED_NOISE_PRESSURE_GAIN = 4.3619057736237865;

export function secondaryPath(config: LabConfig, speakerIndex: number, point: Vec3): SparsePath {
  return acousticPath(config, labLayout(config).speakers[speakerIndex], point, 0.28, 1, true);
}

export function referencePath(config: LabConfig, sourceIndex: number, point: Vec3): SparsePath {
  const r = distance(labLayout(config).sources[sourceIndex], point);
  // Effective early structural arrival and spatial coupling; adding/moving a reference changes real input coherence.
  return fractionalPath([{ delay: r / 900 * config.sampleRateHz,
    gain: Math.exp(-r * r / 2.5) / (0.35 + r) }], [0.85, 0.15]);
}

export function applyPath(input: Float32Array | Float64Array, path: SparsePath, output = new Float64Array(input.length)): Float64Array {
  for (let j = 0; j < path.delays.length; j++) {
    const delay = path.delays[j], gain = path.gains[j];
    for (let n = delay; n < input.length; n++) output[n] += gain * input[n - delay];
  }
  return output;
}

export function samplePath(input: Float32Array | Float64Array, path: SparsePath, sample: number): number {
  let value = 0;
  for (let j = 0; j < path.delays.length; j++) {
    const index = sample - path.delays[j];
    if (index >= 0 && index < input.length) value += input[index] * path.gains[j];
  }
  return value;
}
