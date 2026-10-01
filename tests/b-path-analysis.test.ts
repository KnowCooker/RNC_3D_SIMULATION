import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSparsePath, analyzeLabPath } from '../src/team-b/lab/path-analysis';
import { defaultLabConfig } from '../src/shared/lab-contracts';

test('a pure delayed gain has constant magnitude and exact analytic group delay',()=>{
  const a=analyzeSparsePath({delays:[7],gains:[2]},2000);
  assert.equal(a.impulse[7],2); assert.equal(a.frequencyHz.at(-1),1000);
  for (const value of a.magnitudeDb) assert.ok(Math.abs(value!-20*Math.log10(2))<1e-12);
  for (const value of a.groupDelayMs) assert.ok(Math.abs(value!-3.5)<1e-12);
  assert.ok(Math.abs(a.phaseDegrees.at(-1)!+1260)<1e-9);
});
test('response zeros are undefined rather than false finite phase/delay; all sixteen paths remain selectable',()=>{
  const zero=analyzeSparsePath({delays:[0,1],gains:[1,-1]},2000);
  assert.equal(zero.groupDelayMs[0],null); assert.equal(zero.phaseDegrees[0],null); assert.equal(zero.magnitudeDb[0],null);
  const config={...defaultLabConfig(),sourceMode:'recorded-noise' as const};
  for(let input=0;input<4;input++) for(let output=0;output<4;output++) {
    const H=analyzeLabPath(config,{kind:'H',input,output});
    assert.ok(H.impulse.some(v=>v!==0));
    const S=analyzeLabPath(config,{kind:'S',input,output});
    assert.deepEqual(S,analyzeLabPath(config,{kind:'Shat',input,output}));
    const dc=Array.from(S.impulse).reduce((s,v)=>s+v,0);
    assert.ok(Math.abs(S.magnitudeDb[0]!-20*Math.log10(Math.abs(dc)))<1e-10);
  }
  assert.throws(()=>analyzeLabPath(config,{kind:'S',input:4,output:0}));
});
