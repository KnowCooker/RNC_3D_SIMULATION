import { writeFileSync } from 'node:fs';
import { calculateLab } from '../../../../src/team-b/lab';
import { defaultLabConfig, type LabConfig } from '../../../../src/shared/lab-contracts';

const config = { ...defaultLabConfig(), speedKph: 40 };
const results: unknown[] = [];
for (const [name, patch] of [
  ['baseline', {}], ['high', { taps: 128, stepSize: .5, speedKph: 130, roadRoughness: 3, treadRoughness: 3, pressureKpa: 320, temperatureC: 50 }],
  ['high-default-step', { taps: 128, speedKph: 130, roadRoughness: 3, treadRoughness: 3, pressureKpa: 320, temperatureC: 50 }],
  ['colocated', { stepSize: .5, references: Array.from({ length: 8 }, (_, i) => ({ id: `same-${i}`, name: `same ${i}`, position: [0, .8, 0] })) }],
] as const) {
  try {
    const run = calculateLab({ ...config, ...patch } as LabConfig, name);
    results.push({ name, status: 'finite', metrics: run.metrics, milliseconds: run.computeMilliseconds });
    if (name === 'baseline') {
      const channels = [...run.signals.x, ...run.signals.d];
      const samples = new Float32Array(run.sampleCount * channels.length);
      for (let i = 0; i < run.sampleCount; i++) for (let c = 0; c < channels.length; c++) samples[i * channels.length + c] = channels[c][i];
      writeFileSync(new URL('./simulated-x-d.f32', import.meta.url), new Uint8Array(samples.buffer));
    }
  } catch (error) { results.push({ name, status: 'explicit-failure', error: String(error) }); }
}
writeFileSync(new URL('./simulation-check.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
