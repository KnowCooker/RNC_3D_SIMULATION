import {defaultP7Config} from '../../../../../src/shared/lab-contracts';
import {calculateLab,sampleField,decodeRecordedNoise} from '../../../../../src/team-b/lab';
import {readFileSync} from 'node:fs';
import {candidate} from './candidate-field';
import {createFieldPoints} from '../../../../../src/team-a/viewer/field-slices';
import {DENSE_FIELD_GRID} from '../../../../../src/team-a/viewer/field-grid';
const b=readFileSync('src/team-b/lab/data/recorded-primary.f32');const rec=decodeRecordedNoise(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));const points=createFieldPoints(DENSE_FIELD_GRID).map(([x,y,z])=>[x,.68+(y-.85)*.72,z*.90] as const);
for(const sourceMode of ['shaped-noise','recorded-noise'] as const){const c={...defaultP7Config(),sourceMode,durationSeconds:10};const result=calculateLab(c,'performance-prototype',rec);for(const weighting of ['A','Z'] as const){let t=performance.now();const old=sampleField(result,8,points,weighting),oldMs=performance.now()-t;t=performance.now();const fast=candidate(result,8,points,weighting),firstMs=performance.now()-t;t=performance.now();candidate(result,8.1,points,weighting);const cachedMs=performance.now()-t;let maxDb=0;for(const channel of ['primarySpl','residualSpl','reductionDb'] as const)for(let i=0;i<points.length;i++)maxDb=Math.max(maxDb,Math.abs(old[channel][i]-fast[channel][i]));console.log(JSON.stringify({sourceMode,weighting,points:points.length,oldMs,firstMs,cachedMs,maxDb}));}}
