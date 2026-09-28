import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLabConfig } from '../src/shared/lab-contracts';
import { calculateLab, createLabStream, analyzeLab, validateLabConfig } from '../src/team-b/lab';

test('step size accepts every nonnegative finite value and finite drives exceed the former 100 threshold',()=>{
  const config={...defaultLabConfig(),durationSeconds:4};
  for(const stepSize of [0,1,100,Number.MAX_VALUE]) assert.doesNotThrow(()=>validateLabConfig({...config,stepSize}));
  for(const stepSize of [-1,NaN,Infinity]) assert.throws(()=>validateLabConfig({...config,stepSize}));
  const result=calculateLab({...config,stepSize:.5},'large-finite');
  assert.equal(result.divergence,undefined); assert.equal(result.sampleCount,8000);
  assert.ok(result.signals.u.some(channel=>channel.some(v=>Math.abs(v)>100)));
});
test('batch and chunked overflow stop at the same Float32 boundary, keeping the last finite samples and spectra',()=>{
  const config={...defaultLabConfig(),durationSeconds:4,stepSize:2};
  const batch=calculateLab(config,'overflow');
  const stream=createLabStream(config,'overflow',2048);
  let chunk=stream.process(127);
  while(!chunk.divergence) chunk=stream.process(127);
  assert.deepEqual(chunk.divergence,batch.divergence);
  const snapshot=stream.snapshot();
  for(const kind of ['x','u','d','a','e'] as const) snapshot.result.signals[kind].forEach((values,i)=>assert.deepEqual(values,batch.signals[kind][i].slice(snapshot.startSample)));
  for(const weighting of ['A','Z'] as const) {
    const analysis=analyzeLab(batch,batch.sampleCount/2000,{signal:'e',channel:0},{spectrumWeighting:weighting,levelWeighting:weighting});
    assert.ok(analysis.spectrum?.every(Number.isFinite));
    assert.ok(analysis.spectrumDb?.every(Number.isFinite));
    assert.ok(analysis.residualSpl.every(v=>v!==null && Number.isFinite(v)));
    assert.ok(analysis.reductionDb.some(v=>v!==null && v < -100));
  }
});
test('overflow on the first weight update gives an empty finite prefix and a terminal diagnostic',()=>{
  const config={...defaultLabConfig(),durationSeconds:1,stepSize:Number.MAX_VALUE};
  const batch=calculateLab(config,'immediate');
  assert.equal(batch.sampleCount,0); assert.ok(batch.divergence);
  assert.ok(batch.metrics.reductionDbByMic.every(Number.isFinite));
  const stream=createLabStream(config,'immediate');
  assert.equal(stream.process(400).sampleCount,0);
  assert.equal(stream.snapshot().result.sampleCount,0);
  assert.throws(()=>stream.process(1),/已经发散/);
});
