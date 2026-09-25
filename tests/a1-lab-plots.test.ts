import assert from 'node:assert/strict';
import test from 'node:test';
import { drawSignalComparison, plot, splFrame, visibleSplFrames, ORIGINAL_COLOR, RESULT_COLOR } from '../src/team-a/lab/plots';
import type { LabAnalysis } from '../src/shared/lab-contracts';

function recorder() {
  type Point = { move: boolean; x: number; y: number };
  let path: Point[] = [];
  const lines: {color:string; points:Point[]}[] = [], labels: string[] = [], dots: number[][] = [];
  const ctx = {
    strokeStyle:'', fillStyle:'', font:'', textAlign:'', lineWidth:1,
    scale() {}, beginPath() { path=[]; },
    moveTo(x:number,y:number) { path.push({move:true,x,y}); }, lineTo(x:number,y:number) { path.push({move:false,x,y}); },
    stroke() { lines.push({color:this.strokeStyle,points:[...path]}); },
    fillText(text:string) { labels.push(text); }, fillRect(...args:number[]) { dots.push(args); },
  };
  return { canvas:{clientWidth:480,clientHeight:220,getContext:()=>ctx} as unknown as HTMLCanvasElement, lines, labels, dots };
}
const frame = (patch: Partial<LabAnalysis> = {}): LabAnalysis => ({time:1, valid:true,
  primarySpl:[62,63,64,65], residualSpl:[52,51,50,49], reductionDb:[10,12,14,16],
  waveform:Float32Array.of(1,-1,0.5,-0.5), spectrum:Float32Array.of(1,0.1,0.01), unit:'Pa', ...patch });

test('seat curves use supplied SPL, preserve missing values and exclude future or expired frames', () => {
  const values = [splFrame(0.5,frame()),splFrame(1,frame({residualSpl:[null,50,49,48]})),splFrame(2,frame())];
  assert.equal(visibleSplFrames(values,0,0.5).length,0);
  assert.deepEqual(visibleSplFrames(values,1,0.5).map(v=>v.time),[0.5,1]);
  assert.deepEqual(visibleSplFrames(values,0.5,0.5)[0].residual,[52,51,50,49]);
  assert.equal(visibleSplFrames(values,1,0.5)[1].residual[0],null);
  assert.equal(visibleSplFrames(values,123,0.5).length,0);
  assert.deepEqual(values[0].primary,[62,63,64,65]);
});

test('physical traces share Pa scale, show original and use absolute sample time after a live history wrap', () => {
  const r=recorder();
  drawSignalComparison(r.canvas,frame({waveform:Float32Array.of(0.5,-0.5,0.25,-0.25)}),frame(),2000,120,false,false);
  const raw=r.lines.find(l=>l.color===ORIGINAL_COLOR)!.points, residual=r.lines.find(l=>l.color===RESULT_COLOR)!.points;
  assert.equal(raw.length,4); assert.equal(residual.length,4);
  assert.deepEqual(raw.map(p=>p.x),residual.map(p=>p.x));
  const middle=(26+172)/2;
  assert.ok(Math.abs((middle-residual[0].y)/(middle-raw[0].y)-0.5)<1e-6,'curves must not be independently normalized');
  assert.ok(r.labels.includes('120.8')); assert.ok(r.labels.includes('121')); assert.ok(r.labels.includes('实验时间 / s'));
});

test('PSD comparisons use actual FFT bin positions and original selection is not drawn twice', () => {
  const r=recorder(); drawSignalComparison(r.canvas,frame(),frame(),2000,0,true,false);
  assert.ok(r.labels.includes('250')); assert.ok(r.labels.includes('500')); assert.ok(r.labels.includes('1000'));
  const points=r.lines.find(l=>l.color===ORIGINAL_COLOR)!.points;
  assert.ok(Math.abs(points[1].x-points[0].x-408/512)<1e-9);
  const single=recorder(); drawSignalComparison(single.canvas,frame(),frame(),2000,0,false,true);
  assert.equal(single.lines.filter(l=>l.color===ORIGINAL_COLOR).length,1);
  assert.equal(single.lines.filter(l=>l.color===RESULT_COLOR).length,0);
});

test('first valid point is visible and null SPL gaps never create fake zero levels', () => {
  const r=recorder();
  plot(r.canvas,[{x:[0.5,0.6,0.7,0.8],values:[60,null,50,49],color:RESULT_COLOR}],
    {x:[0.5,1],y:[30,90],xLabel:'实验时间 / s',yLabel:'总声压级 / dB SPL'});
  assert.deepEqual(r.lines.find(l=>l.color===RESULT_COLOR)!.points.map(p=>p.move),[true,true,false]);
  assert.equal(r.dots.length,2);
});

test('acceleration and speaker drive never masquerade as pressure on a common axis', () => {
  const r=recorder(); drawSignalComparison(r.canvas,frame({unit:'m/s²'}),frame(),2000,0,false,false);
  assert.ok(r.labels.includes('原声 / Pa')); assert.ok(r.labels.includes('m/s²'));
});
