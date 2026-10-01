import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateLab, createLabStream, sampleField, analyzeLab, decodeRecordedNoise } from '../src/team-b/lab';
import { createRecordedNoiseReader, RECORDED_NOISE_CHANNELS, RECORDED_NOISE_PERIOD } from '../src/team-b/lab/recorded-noise';
import { createSources, RECORDED_SOURCE_AMPLITUDE_GAIN } from '../src/team-b/lab/sources';
import { welchPsd } from '../src/team-b/analysis';
import { primaryPath } from '../src/team-b/lab/paths';
import { weightedPower, weightedSpectrum } from '../src/team-b/lab/weighting';
import { defaultLabConfig, LAB_LIVE_HISTORY_SAMPLES, MIC_POSITIONS, type LabConfig } from '../src/shared/lab-contracts';

const raw = readFileSync(new URL('../src/team-b/lab/data/recorded-primary.f32', import.meta.url));
const bytes = () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const recording = decodeRecordedNoise(bytes());
const config: LabConfig = { ...defaultLabConfig(), sourceMode: 'recorded-noise', speedKph: 40, durationSeconds: 90 };

test('recorded sources use the four primary-noise ears, validate assets and require explicit data', () => {
  assert.deepEqual([...RECORDED_NOISE_CHANNELS], [49,53,51,55]);
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'c3bcc4ffcea96268032403eb01a0743f822701d6958bebc979752f93283d421a');
  assert.equal(raw.byteLength, 1280016);
  assert.throws(() => decodeRecordedNoise(new ArrayBuffer(3)), /格式/);
  const invalid = bytes(); new DataView(invalid).setFloat32(16, NaN, true);
  assert.throws(() => decodeRecordedNoise(invalid), /无效样本/);
  assert.throws(() => calculateLab(config, 'missing'), /加载四路实录初级噪声/);
  assert.throws(() => createLabStream(config, 'missing'), /加载四路实录初级噪声/);
  assert.throws(() => calculateLab({ ...config, sourceMode: 'bad' as LabConfig['sourceMode'] }, 'bad'), /声源类型/);
});

test('recorded source samples retain shared timing and gain, crossfade synchronously and do not become random or pitch shifted', () => {
  const reader = createRecordedNoiseReader(recording), period = RECORDED_NOISE_PERIOD;
  for (let ch = 0; ch < 4; ch++) {
    for (const n of [0,1000,40000,79199]) assert.equal(reader.sample(ch,n),recording.channels[ch][n+400]);
    const j=137, w=(1-Math.cos(Math.PI*j/399))/2;
    assert.equal(reader.sample(ch,79200+j),recording.channels[ch][79600+j]*(1-w)+recording.channels[ch][j]*w);
    assert.equal(reader.sample(ch,period-1),recording.channels[ch][399]);
    assert.equal(reader.sample(ch,period),recording.channels[ch][400]);
    assert.equal(reader.sample(ch,period+12567),reader.sample(ch,12567));
  }
  const source = createSources({ ...config, durationSeconds: 1 },recording);
  const otherSeedPressure = createSources({ ...config, durationSeconds: 1, seed: 72, pressureKpa: 160 },recording);
  assert.deepEqual(source,otherSeedPressure,'recorded samples are independent of random seed and disabled tire-pressure extrapolation');
  assert.notDeepEqual(source[0],source[1]);
  const changed = decodeRecordedNoise(bytes()), owned = createRecordedNoiseReader(changed), before=owned.sample(0,0);
  changed.channels[0].fill(999); assert.equal(owned.sample(0,0),before);
  const faster = createSources({ ...config, durationSeconds: 1, speedKph: 80 },recording);
  assert.equal(faster[0][1000],Math.fround(recording.channels[0][1400]*(2**1.25*RECORDED_SOURCE_AMPLITUDE_GAIN)));
});

test('recorded batch and irregular live blocks agree exactly through two source loops; storage and adaptation remain continuous', () => {
  const batch = calculateLab(config,'recorded-batch',recording);
  const stream = createLabStream(config,'recorded-live',LAB_LIVE_HISTORY_SAMPLES,recording), storage=stream.storageBytes;
  let start=0, block=0;
  while (start<batch.sampleCount) {
    const size=Math.min([1,399,79123,2057,4000,799][block++%6],batch.sampleCount-start), chunk=stream.process(size);
    for (let ch=0;ch<4;ch++) assert.deepEqual(chunk.sources[ch],batch.sources[ch].slice(start,start+size));
    for (const kind of ['x','u','d','a','e'] as const) for(let ch=0;ch<batch.signals[kind].length;ch++) {
      assert.deepEqual(chunk.signals[kind][ch],batch.signals[kind][ch].slice(start,start+size),`${kind}/${ch} at ${start}`);
    }
    start+=size; assert.equal(stream.storageBytes,storage);
  }
  assert.ok(batch.signals.e.every(values=>values.every(Number.isFinite)));
  assert.ok(batch.signals.u.some(values=>values.slice(79600,80000).some(value=>Math.abs(value)>.001)), 'recording wrap does not reset the learned controller');
  const frozen=stream.controllerWeights(); stream.setRncEnabled(false);
  const off=stream.process(4000); assert.deepEqual(stream.controllerWeights(),frozen);
  assert.ok(off.signals.u.every(values=>values.every(value=>value===0)));
  for(let ch=0;ch<4;ch++) assert.deepEqual(off.signals.e[ch].slice(512),off.signals.d[ch].slice(512));
  stream.setRncEnabled(true); stream.process(4000);
  assert.notDeepEqual(stream.controllerWeights(),frozen);
  assert.equal(stream.storageBytes,storage);
});

test('recorded primary paths stay causal and fully coupled, match the passenger 48dBA/Hz peak anchor, and match microphone fields', () => {
  const result=calculateLab({ ...config,durationSeconds:40,rncEnabled:false },'recorded-field',recording);
  for(const point of MIC_POSITIONS) for(let q=0;q<4;q++) {
    const path=primaryPath(config,q,point);
    assert.ok(path.gains.some(value=>Math.abs(value)>1e-5));
    assert.ok(path.delays.every(delay=>Number.isInteger(delay)&&delay>0&&delay<256));
  }
  const power=result.signals.d.map(values=>weightedPower(values,2000,78000,'A')).reduce((sum,p)=>sum+p,0)/4;
  assert.ok(Math.abs(10*Math.log10(power/(20e-6)**2)-(60+20*Math.log10(RECORDED_SOURCE_AMPLITUDE_GAIN)))<1e-5);
  const fr = result.signals.d[1].slice(2000,78000), mean = new Float64Array(513);
  let frames = 0;
  for (let end=2048; end<=fr.length; end+=512) {
    weightedSpectrum(welchPsd(fr,end),2000,'A')!.forEach((p,i)=>mean[i]+=p); frames++;
  }
  const band = Array.from(mean.slice(103,154),p=>10*Math.log10(p/frames/(20e-6)**2));
  assert.ok(Math.abs(Math.max(...band)-48)<0.001);
  for(const weighting of ['A','Z'] as const) {
    const field=sampleField(result,39,[...MIC_POSITIONS],weighting), analysis=analyzeLab(result,39,{signal:'e',channel:0},{levelWeighting:weighting});
    for(let m=0;m<4;m++) assert.ok(Math.abs(field.primarySpl[m]-analysis.primarySpl[m]!)<1e-4);
  }
  assert.equal(analyzeLab(result,1,{signal:'q',channel:0}).unit,'相对幅值');
  const base=primaryPath(config,0,MIC_POSITIONS[0]), changed=primaryPath({...config,vehicle:'ice',temperatureC:-20},0,MIC_POSITIONS[0]);
  assert.notDeepEqual(base,changed,'vehicle and temperature still alter the effective spatial path');
});
