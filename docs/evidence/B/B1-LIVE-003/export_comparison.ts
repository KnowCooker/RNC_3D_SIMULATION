import { readFileSync, writeFileSync } from 'node:fs';
import { calculateLab, decodeRecordedNoise } from '../../../../src/team-b/lab';
import { weightedPower } from '../../../../src/team-b/lab/weighting';
import { defaultLabConfig, MIC_POSITIONS, type LabConfig } from '../../../../src/shared/lab-contracts';
import { primaryPath, RECORDED_NOISE_PRESSURE_GAIN } from '../../../../src/team-b/lab/paths';

const raw = readFileSync(new URL('../../../../src/team-b/lab/data/recorded-primary.f32', import.meta.url));
const recording = decodeRecordedNoise(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const config: LabConfig = { ...defaultLabConfig(), sourceMode: 'recorded-noise', speedKph: 40, durationSeconds: 40, rncEnabled: false };
const result = calculateLab(config, 'recorded-comparison', recording);
const synthetic = calculateLab({ ...config, sourceMode: 'shaped-noise' }, 'previous-source');
const energy = result.signals.d.map(d => weightedPower(d, 2000, 78000, 'A'));
const averageDba = 10 * Math.log10(energy.reduce((s, p) => s + p, 0) / 4 / (20e-6)**2);
const topologyCases: Partial<LabConfig>[] = [
  {vehicle:'bev',speedKph:60},
  {vehicle:'ice',references:config.references.slice(0,1),speakerEnabled:[true,false,true,false]},
  {vehicle:'hev',taps:128,references:[...config.references,...config.references.map((r,i)=>({...r,id:`added-${i}`,position:[r.position[0]*.5,.85,r.position[2]*.5] as const}))]},
  {vehicle:'erev',speedKph:130,temperatureC:50},
];
const topology = topologyCases.map(patch=>{
  const run=calculateLab({...config,...patch,durationSeconds:10,rncEnabled:true},'recorded-topology',recording);
  if(!run.signals.e.every(values=>values.every(Number.isFinite))) throw new Error('Nonfinite topology result');
  return {patch,metrics:run.metrics,computeMs:run.computeMilliseconds};
});
const output = new URL('./', import.meta.url);
for (const [name, signals] of [['recorded-primary', result.signals.d], ['synthetic-primary', synthetic.signals.d]] as const) {
  writeFileSync(new URL(`${name}.f32`, output), Buffer.concat(signals.map(signal => Buffer.from(signal.buffer, signal.byteOffset, signal.byteLength))));
}
const report = { config, primaryGain: RECORDED_NOISE_PRESSURE_GAIN, pooledBaselineDba: averageDba,
  suggested60DbaGain: RECORDED_NOISE_PRESSURE_GAIN * 10 ** ((60 - averageDba)/20),
  primaryPaths: MIC_POSITIONS.map(point => [0,1,2,3].map(q => primaryPath(config, q, point))),
  recordedComputeMs: result.computeMilliseconds, syntheticComputeMs: synthetic.computeMilliseconds, topology };
writeFileSync(new URL('simulation-comparison.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ averageDba, suggested60DbaGain: report.suggested60DbaGain, recordedComputeMs: report.recordedComputeMs }));
