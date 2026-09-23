import type { Four } from '../../shared/contracts';
import type { LabConfig } from '../../shared/lab-contracts';
import { convolve, uniform } from '../engine/data';

/** q has equivalent wheel-excitation acceleration units, not calibrated airborne source power. */
export function sourceParameters(config: LabConfig) {
  const speed = config.speedKph / 60;
  const amplitude = speed ** 1.25 * Math.sqrt(config.roadRoughness) * (0.65 + 0.35 * config.treadRoughness);
  // This temperature coefficient is a declared teaching assumption for dense asphalt, not a universal law.
  const temperatureGain = 10 ** (-0.04 * (config.temperatureC - 20) / 20);
  const stiffnessPeakHz = 95 * Math.sqrt(config.pressureKpa / 240);
  const cavityPeakHz = 220 * Math.sqrt((config.temperatureC + 273.15) / 293.15);
  return { amplitude: amplitude * temperatureGain, stiffnessPeakHz, cavityPeakHz };
}

export function createSources(config: LabConfig): Four<Float32Array> {
  const count = config.sampleRateHz * config.durationSeconds, { amplitude, stiffnessPeakHz, cavityPeakHz } = sourceParameters(config);
  const sinc = (x: number) => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
  const shape = Float64Array.from({ length: 97 }, (_, i) => {
    const t = i - 48;
    return (0.36 * sinc(0.36 * t) - 0.035 * sinc(0.035 * t)) * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / 96));
  });
  const norm = Math.sqrt(shape.reduce((sum, x) => sum + x * x, 0) / 3);
  for (let i = 0; i < shape.length; i++) shape[i] /= norm;
  return Array.from({ length: 4 }, (_, source) => {
    const broad = convolve(uniform(config.seed + source * 101, count), shape);
    const phase = 0.67 * source;
    // Bounded low-frequency structural/cavity modes sit on broadband texture excitation.
    // Pressure moves the structural mode, temperature moves the cavity mode. Neither guarantees lower SPL.
    return Float32Array.from(broad, (sample, n) => amplitude * (sample * 0.88
      + 0.24 * Math.sin(2 * Math.PI * stiffnessPeakHz * n / config.sampleRateHz + phase)
      + 0.18 * Math.sin(2 * Math.PI * cavityPeakHz * n / config.sampleRateHz + 2 * phase)));
  }) as unknown as Four<Float32Array>;
}
