import {defaultLabConfig} from '../../../../src/shared/lab-contracts';
import {calculateLab, createLabStream} from '../../../../src/team-b/lab';
for(const stepSize of [.5,2,10,100,1e308]){
 const cfg={...defaultLabConfig(),durationSeconds:4,stepSize};
 const stream=createLabStream(cfg,'probe',2048);const chunk=stream.process(8000); const snap=stream.snapshot();
 let peak=0;for(const c of chunk.signals.u)for(const v of c)peak=Math.max(peak,Math.abs(v));
 const batch=calculateLab(cfg,'batch');
 console.log(JSON.stringify({stepSize,count:chunk.sampleCount,div:chunk.divergence,peak,batchCount:batch.sampleCount,batchDiv:batch.divergence,finite:snap.result.signals.e.every(c=>c.every(Number.isFinite))}));
}
