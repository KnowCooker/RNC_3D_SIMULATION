// Unapplied performance experiment. Production B/integration code is untouched.
import {geometricPrimaryPath,primaryPath,secondaryPath,type SparsePath} from '../../../../../src/team-b/lab/paths';
import {RECORDED_PROFILE} from '../../../../../src/team-b/lab/recorded-profile';
import {TEACHING_PRESSURE_GAIN} from '../../../../../src/team-b/lab/pressure-calibration';
import {A_WEIGHTING_FIR} from '../../../../../src/team-b/lab/a-weighting-fir';
import type {LabResult,Vec3,AcousticWeighting,FieldFrame} from '../../../../../src/shared/lab-contracts';
let previousKey='',cached: {p:SparsePath[];s:SparsePath[]}[]=[],maxDelay=0;
function filter(input:Float64Array|Float32Array,fir:readonly number[]){const out=new Float64Array(input.length);for(let k=0;k<fir.length;k++){const gain=fir[k];for(let n=k;n<input.length;n++)out[n]+=gain*input[n-k];}return out;}
export function candidate(result:LabResult,time:number,points:Vec3[],weighting:AcousticWeighting='Z'):FieldFrame {
 const end=Math.min(result.sampleCount,Math.max(0,Math.floor(time*2000))),cfg=result.config;
 const key=JSON.stringify([cfg.layoutId,cfg.vehicle,cfg.sourceMode,cfg.temperatureC,cfg.levelOffsetDb,points]);
 if(key!==previousKey){maxDelay=0;cached=points.map(point=>{const p=[0,1,2,3].map(i=>cfg.sourceMode==='recorded-noise'?primaryPath(cfg,i,point):geometricPrimaryPath(cfg,i,point)),s=[0,1,2,3].map(i=>secondaryPath(cfg,i,point));for(const path of [...p,...s])maxDelay=Math.max(maxDelay,...path.delays);return{p,s};});previousKey=key;}
 const start=Math.max(0,end-1000-maxDelay-A_WEIGHTING_FIR.length-RECORDED_PROFILE.primaryColorFir.length),offset=end-1000-start;
 const shaped=cfg.sourceMode!=='recorded-noise',scale=shaped?TEACHING_PRESSURE_GAIN*10**((cfg.levelOffsetDb??0)/20):1;
 const q=result.sources.map(raw=>{let a:Float64Array|Float32Array=raw.slice(start,end);if(shaped)a=filter(a,RECORDED_PROFILE.primaryColorFir);if(weighting==='A')a=filter(a,A_WEIGHTING_FIR);return a;});
 const u=result.signals.u.map(raw=>weighting==='A'?filter(raw.slice(start,end),A_WEIGHTING_FIR):raw.slice(start,end));
 const primarySpl=new Float32Array(points.length),residualSpl=new Float32Array(points.length),reductionDb=new Float32Array(points.length);
 const d=new Float64Array(1000),a=new Float64Array(1000);
 const add=(input:Float32Array|Float64Array,path:SparsePath,out:Float64Array,gainScale:number)=>{for(let j=0;j<path.delays.length;j++){const base=offset-path.delays[j],g=path.gains[j]*gainScale;for(let n=Math.max(0,-base);n<1000;n++)out[n]+=input[base+n]*g;}};
 for(let p=0;p<points.length;p++){d.fill(0);a.fill(0);for(let i=0;i<4;i++){add(q[i],cached[p].p[i],d,scale);if(cfg.speakerEnabled[i])add(u[i],cached[p].s[i],a,1);}let dp=0,ep=0;for(let n=0;n<1000;n++){dp+=d[n]*d[n];ep+=(d[n]+a[n])**2;}dp/=1000;ep/=1000;primarySpl[p]=10*Math.log10(Math.max(1e-20,dp)/4e-10);residualSpl[p]=10*Math.log10(Math.max(1e-20,ep)/4e-10);reductionDb[p]=10*Math.log10(dp/Math.max(1e-20,ep));}
 return{time:end/2000,valid:true,weighting,points,primarySpl,residualSpl,reductionDb};
}
