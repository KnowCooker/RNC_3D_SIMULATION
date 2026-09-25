import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLabConfig, labDurationLimit, MIC_POSITIONS, type LabConfig } from '../src/shared/lab-contracts';
import { analyzeLab, calculateLab, createLabStream, sampleField, validateLabConfig } from '../src/team-b/lab';
import { aWeightPower, weightedPower, weightedSpectrum } from '../src/team-b/lab/weighting';
import { nfxlmsGain } from '../src/team-b/lab/nfxlms';

test('A weighting matches reference corrections and applies power rather than amplitude to PSD', () => {
  for (const [f, db] of [[20,-50.4],[31.5,-39.5],[63,-26.2],[100,-19.1],[250,-8.6],[500,-3.2],[1000,0]]) {
    assert.ok(Math.abs(10*Math.log10(aWeightPower(f))-db)<0.1, `reference correction at ${f} Hz`);
    const sine = Float32Array.from({ length: 8000 }, (_, n) => Math.sin(2*Math.PI*f*n/2000));
    if (f < 1000) assert.ok(Math.abs(10*Math.log10(weightedPower(sine,4000,8000,'A')/weightedPower(sine,4000,8000,'Z'))-db)<0.25);
  }
  assert.equal(aWeightPower(0),0);
  const psd = new Float32Array(513).fill(1), weighted = weightedSpectrum(psd,2000,'A')!;
  assert.ok(Math.abs(weighted[128]-aWeightPower(250))<1e-8);
  assert.equal(weighted[512],1); assert.equal(weighted[0],0);
  assert.ok(psd.every(v=>v===1));
  assert.equal(weightedSpectrum(psd,2000,'Z'),psd);
});

test('teaching calibration anchors pooled 40 km/h baseline at 60 dBA; offset changes H only', () => {
  const cfg = { ...defaultLabConfig(), speedKph:40, rncEnabled:false };
  const baseline = calculateLab(cfg,'calibration');
  const p = baseline.signals.d.reduce((sum,ch)=>sum+weightedPower(ch,24000,32000,'A'),0)/4;
  assert.ok(Math.abs(10*Math.log10(p/(20e-6)**2)-60)<0.01);
  const shifted = calculateLab({...cfg,levelOffsetDb:6},'plus6');
  assert.deepEqual(shifted.sources,baseline.sources); assert.deepEqual(shifted.signals.x,baseline.signals.x);
  for (let m=0;m<4;m++) assert.ok(Math.abs(10*Math.log10(weightedPower(shifted.signals.d[m],24000,32000,'A')/weightedPower(baseline.signals.d[m],24000,32000,'A'))-6)<1e-5);
});

test('A/Z analysis and field agree at microphones, including first window and wrapped live history', () => {
  const stream = createLabStream(defaultLabConfig(),'weighted',8000), whole = stream.process(84000), snapshot = stream.snapshot(4096);
  const result = {...snapshot.result, sources:whole.sources, signals:whole.signals, sampleCount:whole.sampleCount};
  for (const time of [0.5,1,16,42]) {
    const a = analyzeLab(result,time,{signal:'e',channel:0},{levelWeighting:'A',spectrumWeighting:'A'});
    const z = analyzeLab(result,time,{signal:'e',channel:0});
    assert.deepEqual(a.waveform,z.waveform);
    assert.deepEqual(a.spectrum,weightedSpectrum(z.spectrum,2000,'A'));
    const field = sampleField(result,time,[...MIC_POSITIONS],'A');
    for(let m=0;m<4;m++) {
      assert.ok(Math.abs(field.primarySpl[m]-a.primarySpl[m]!)<1e-4);
      assert.ok(Math.abs(field.residualSpl[m]-a.residualSpl[m]!)<1e-4);
    }
  }
  const localTime = snapshot.result.sampleCount/2000;
  const local = analyzeLab(snapshot.result,localTime,{signal:'e',channel:0},{levelWeighting:'A'});
  const full = analyzeLab(result,42,{signal:'e',channel:0},{levelWeighting:'A'});
  assert.deepEqual(local.primarySpl,full.primarySpl); assert.deepEqual(local.residualSpl,full.residualSpl);
  assert.deepEqual(sampleField(snapshot.result,localTime,[...MIC_POSITIONS],'A').residualSpl,sampleField(result,42,[...MIC_POSITIONS],'A').residualSpl);
  const x = analyzeLab(result,42,{signal:'x',channel:0},{spectrumWeighting:'A'});
  assert.equal(x.spectrumWeighting,'Z');
  assert.deepEqual(x.spectrum,analyzeLab(result,42,{signal:'x',channel:0}).spectrum);
});

test('duration budget rejects invalid allocations; short runs have finite metrics and long runs share streaming samples', () => {
  const config=defaultLabConfig(), limit=labDurationLimit(config);
  for(const durationSeconds of [1,40,limit]) validateLabConfig({...config,durationSeconds});
  for(const durationSeconds of [0,1.5,NaN,Infinity,limit+1]) assert.throws(()=>validateLabConfig({...config,durationSeconds}));
  for(const levelOffsetDb of [-13,13,NaN]) assert.throws(()=>validateLabConfig({...config,levelOffsetDb}));
  assert.ok(labDurationLimit({...config,references:[...config.references,...config.references]})<limit);
  const short=calculateLab({...config,durationSeconds:1},'short');
  assert.equal(short.sampleCount,2000); assert.ok(Number.isFinite(short.metrics.aggregateReductionDb));
  const longConfig:LabConfig={...config,durationSeconds:42};
  const batch=calculateLab(longConfig,'long'), live=createLabStream(longConfig,'live').process(84000);
  assert.deepEqual(batch.signals,live.signals); assert.deepEqual(batch.sources,live.sources);
  assert.notDeepEqual(batch.sources[0].slice(0,4000),batch.sources[0].slice(80000,84000));
});

test('NFxLMS joint normalization scales inversely with filtered-reference power and regularizes silence', () => {
  const powers=new Float64Array([1,2,3,4]);
  assert.equal(nfxlmsGain(.08,powers),.08/(10+1e-6));
  assert.ok(Math.abs(nfxlmsGain(.08,powers.map(v=>v*100))*100/nfxlmsGain(.08,powers)-1)<1e-6);
  assert.equal(nfxlmsGain(0,powers),0); assert.ok(Number.isFinite(nfxlmsGain(.08,new Float64Array(64))));
});
