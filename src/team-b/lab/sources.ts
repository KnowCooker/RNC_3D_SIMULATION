import type { Four } from '../../shared/contracts';
import type { LabConfig } from '../../shared/lab-contracts';
import { convolve, uniform } from '../engine/data';
import { RECORDED_PROFILE } from './recorded-profile';

/** q has equivalent wheel-excitation acceleration units, not calibrated airborne source power. */
export function sourceParameters(config: LabConfig) {
  const speed = config.speedKph / RECORDED_PROFILE.baselineSpeedKph;
  const amplitude = speed ** 1.25 * Math.sqrt(config.roadRoughness) * (0.65 + 0.35 * config.treadRoughness);
  // This temperature coefficient is a declared teaching assumption for dense asphalt, not a universal law.
  const temperatureGain = 10 ** (-0.04 * (config.temperatureC - 20) / 20);
  // Parameter extrapolation is still a teaching assumption, not identified by
  // a single 40 km/h recording. Stretch the broadband envelope, not fake tones.
  const spectrumScale = Math.sqrt(config.pressureKpa / 240) * Math.sqrt((config.temperatureC + 273.15) / 293.15);
  return { amplitude: amplitude * temperatureGain, spectrumScale };
}

/** Shared by batch and streaming; coefficients describe normalized shape only. */
export function createSourceShape(config: LabConfig): Float64Array {
  const { spectrumScale } = sourceParameters(config), base = RECORDED_PROFILE.sourceFir;
  const shape = Float64Array.from({ length: Math.ceil(base.length / spectrumScale) }, (_, i) => {
    const at = i * spectrumScale, left = Math.floor(at), fraction = at - left;
    return (base[left] ?? 0) * (1 - fraction) + (base[left + 1] ?? 0) * fraction;
  });
  const norm = Math.sqrt(shape.reduce((sum, value) => sum + value * value, 0) / 3);
  for (let i = 0; i < shape.length; i++) shape[i] /= norm;
  return shape;
}

export function createSources(config: LabConfig): Four<Float32Array> {
  const count = config.sampleRateHz * config.durationSeconds, { amplitude } = sourceParameters(config);
  const shape = createSourceShape(config);
  return Array.from({ length: 4 }, (_, source) => {
    const broad = convolve(uniform(config.seed + source * 101, count), shape);
    return Float32Array.from(broad, sample => amplitude * sample);
  }) as unknown as Four<Float32Array>;
}
