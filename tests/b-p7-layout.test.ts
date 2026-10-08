import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { defaultP7Config, defaultLabConfig, labLayout, supportedLabLayoutId, P7_LAYOUT_ID } from '../src/shared/lab-contracts';
import { calculateLab, createLabStream, sampleField, decodeRecordedNoise } from '../src/team-b/lab';
import { primaryPath, secondaryPath } from '../src/team-b/lab/paths';
const config={...defaultP7Config(),durationSeconds:4};
const result=calculateLab(config,'p7-batch');
test('P7 layout has its own cabin and paths; legacy layout unchanged and unsupported IDs rejected',()=>{
 const p=labLayout(config),old=labLayout(defaultLabConfig());
 assert.equal(supportedLabLayoutId(config),P7_LAYOUT_ID);
 assert.equal(old.microphones[0][1],1.65);assert.equal(p.sources[0][2]-p.sources[2][2],3);
 for(const m of p.microphones)assert.ok(m[1]<p.roof && m[1]>p.floor);
 for(let output=0;output<4;output++)for(let input=0;input<4;input++){
  const path=secondaryPath(config,input,p.microphones[output]);assert.ok(path.gains.some(v=>v!==0));
  assert.notDeepEqual(path,secondaryPath(defaultLabConfig(),input,old.microphones[output]));
  assert.ok(primaryPath(config,input,p.microphones[output]).gains.some(v=>v!==0));
 }
 assert.throws(()=>calculateLab({...config,layoutId:'unknown'},'bad'),/物理布局/);
 assert.throws(()=>createLabStream({...config,vehicle:'ice'},'bad'),/纯电/);
});
test('P7 arbitrary stream blocks match batch q/x/u/d/a/e bit for bit',()=>{
 const stream=createLabStream(config,'p7-stream');let start=0;
 for(const size of [137,2048,321,4096,1398]){
  const chunk=stream.process(size);
  for(const signal of ['x','u','d','a','e'] as const)for(let c=0;c<chunk.signals[signal].length;c++)assert.deepEqual(chunk.signals[signal][c],result.signals[signal][c].slice(start,start+size));
  for(let c=0;c<4;c++)assert.deepEqual(chunk.sources[c],result.sources[c].slice(start,start+size));start+=size;
 }
 assert.equal(start,result.sampleCount);
});
test('P7 field equals independent microphone trace power at the same point and window',()=>{
 for(const time of [.5,1.5,4]){
  const field=sampleField(result,time,[...labLayout(config).microphones]); assert.ok(field.valid);
  const end=Math.floor(time*2000);
  for(let c=0;c<4;c++)for(const [signal,values] of [['d',field.primarySpl],['e',field.residualSpl]] as const){
   let power=0;for(let i=end-1000;i<end;i++)power+=result.signals[signal][c][i]**2/1000;
   assert.ok(Math.abs(values[c]-10*Math.log10(power/(20e-6)**2))<1e-4);
  }
 }
});

test('P7 recorded-source branch shares fractional paths between batch, streaming and field',()=>{
 const raw=readFileSync(new URL('../src/team-b/lab/data/recorded-primary.f32',import.meta.url));
 const recording=decodeRecordedNoise(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
 const recorded={...config,sourceMode:'recorded-noise' as const};
 const batch=calculateLab(recorded,'recorded-batch',recording),stream=createLabStream(recorded,'recorded-stream',40000,recording);
 const chunk=stream.process(batch.sampleCount);
 for(const key of ['x','u','d','a','e'] as const)for(let c=0;c<4;c++)assert.deepEqual(chunk.signals[key][c],batch.signals[key][c]);
 const frame=sampleField(batch,4,[...labLayout(recorded).microphones]);assert.ok(frame.valid);
 for(let c=0;c<4;c++){
  let power=0;for(let i=7000;i<8000;i++)power+=batch.signals.e[c][i]**2/1000;
  assert.ok(Math.abs(frame.residualSpl[c]-10*Math.log10(power/(20e-6)**2))<1e-4);
 }
});
