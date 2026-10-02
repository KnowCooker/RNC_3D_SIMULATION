import { labLayout, type LabConfig, type LabPathAnalysis, type LabPathSelection } from '../../shared/lab-contracts';
import { primaryPath, secondaryPath, type SparsePath } from './paths';

/** Complex FIR response and its analytic derivative, not a finite-difference phase estimate. */
export function analyzeSparsePath(path: SparsePath, sampleRateHz: number): LabPathAnalysis {
  if (!(sampleRateHz > 0) || !Number.isFinite(sampleRateHz) || path.delays.length !== path.gains.length
    || path.delays.some(n => !Number.isInteger(n) || n < 0 || n > 100000)
    || path.gains.some(v => !Number.isFinite(v))) throw new RangeError('无效路径');
  const impulse = new Float64Array(Math.max(0, ...path.delays) + 1);
  path.delays.forEach((n,i) => { impulse[n] += path.gains[i]; });
  const frequencyHz: number[] = [], magnitudeDb: (number|null)[] = [], phaseDegrees: (number|null)[] = [], groupDelayMs: (number|null)[] = [];
  const scale = path.gains.reduce((sum,v) => sum + Math.abs(v),0);
  let previous: number | null = null, unwrapped = 0;
  for (let bin = 0; bin <= 512; bin++) {
    const w = Math.PI * bin / 512;
    let re=0, im=0, dre=0, dim=0;
    for (let i=0; i<path.delays.length; i++) {
      const n=path.delays[i], g=path.gains[i], c=Math.cos(w*n), s=Math.sin(w*n);
      re+=g*c; im-=g*s; dre-=n*g*s; dim-=n*g*c;
    }
    frequencyHz.push(bin*sampleRateHz/1024);
    const power=re*re+im*im;
    if (power <= Math.max(1e-30,scale*scale*1e-20)) {
      magnitudeDb.push(null); phaseDegrees.push(null); groupDelayMs.push(null); previous=null; continue;
    }
    magnitudeDb.push(10*Math.log10(power));
    const phase=Math.atan2(im,re);
    if (previous === null) unwrapped=phase;
    else unwrapped+=Math.atan2(Math.sin(phase-previous),Math.cos(phase-previous));
    previous=phase; phaseDegrees.push(unwrapped*180/Math.PI);
    groupDelayMs.push(-(re*dim-im*dre)/power/sampleRateHz*1000);
  }
  return { impulse, frequencyHz, magnitudeDb, phaseDegrees, groupDelayMs, sampleRateHz };
}

export function analyzeLabPath(config: LabConfig, selection: LabPathSelection): LabPathAnalysis {
  if (!['H','S','Shat'].includes(selection.kind) || !Number.isInteger(selection.input) || selection.input<0 || selection.input>3
    || !Number.isInteger(selection.output) || selection.output<0 || selection.output>3) throw new RangeError('无效路径通道');
  // The present controller uses the same S for filtered-x (ideal identification).
  const path = selection.kind === 'H' ? primaryPath(config,selection.input,labLayout(config).microphones[selection.output])
    : secondaryPath(config,selection.input,labLayout(config).microphones[selection.output]);
  return analyzeSparsePath(path, config.sampleRateHz);
}
