import { readFileSync, writeFileSync } from 'node:fs';
import { calculateLab, decodeRecordedNoise } from '../../../../src/team-b/lab';
import { defaultLabConfig } from '../../../../src/shared/lab-contracts';
import { welchPsd } from '../../../../src/team-b/analysis';
import { weightedSpectrum } from '../../../../src/team-b/lab/weighting';
const raw = readFileSync(new URL('../../../../src/team-b/lab/data/recorded-primary.f32', import.meta.url));
const recording = decodeRecordedNoise(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const config = { ...defaultLabConfig(), sourceMode: 'recorded-noise' as const, speedKph: 40, roadRoughness: 1, durationSeconds: 40, rncEnabled: false };
const result = calculateLab(config, 'fr-40-calibration', recording);
const signal = result.signals.d[1].slice(2000, 78000), mean = new Float64Array(513);
let frames = 0;
for (let end = 2048; end <= signal.length; end += 512) {
  const spectrum = weightedSpectrum(welchPsd(signal, end, 2000), 2000, 'A')!;
  spectrum.forEach((value, bin) => mean[bin] += value); frames++;
}
let peak = -Infinity, peakHz = 0;
for (let bin = Math.ceil(200 * 1024 / 2000); bin <= Math.floor(300 * 1024 / 2000); bin++) {
  const level = 10 * Math.log10(mean[bin] / frames / (20e-6) ** 2);
  if (level > peak) { peak = level; peakHz = bin * 2000 / 1024; }
}
const report = { config, channel: 'FR / front passenger', intervalSeconds: [1,39], fftSize: 1024, window: 'symmetric Hann', binHz: 2000/1024, frames, averaging: 'linear A-weighted PSD; same Welch estimator as UI', peakHz, peakDbAperHz: peak, targetDbAperHz: 48, correctionDb: 48-peak, requiredAmplitudeRatio: 10 ** ((48-peak)/20) };
console.log(JSON.stringify(report, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2)+'\n');
