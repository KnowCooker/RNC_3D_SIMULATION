import type { LabAnalysis } from '../../shared/lab-contracts';

export const ORIGINAL_COLOR = '#a7b5c8';
export const RESULT_COLOR = '#73e4bc';
export interface PlotSeries { x: number[]; values: (number | null)[]; color: string; secondary?: boolean }
export interface SplFrame { time: number; primary: (number | null)[]; residual: (number | null)[] }
export function splFrame(time: number, analysis: LabAnalysis): SplFrame {
  return { time, primary: [...analysis.primarySpl], residual: [...analysis.residualSpl] };
}
/** The plot follows the audio clock even for precomputed experiments and seeks. */
export function visibleSplFrames(frames: SplFrame[], time: number, start: number): SplFrame[] {
  return frames.filter(frame => frame.time >= Math.max(start, time - 120) && frame.time <= time + 1e-9);
}
export function splRange(frames: SplFrame[]): [number, number] {
  let min = 30, max = 90;
  for (const frame of frames) for (const value of [...frame.primary, ...frame.residual]) {
    if (value !== null && Number.isFinite(value)) { min = Math.min(min, Math.floor(value / 10) * 10); max = Math.max(max, Math.ceil(value / 10) * 10); }
  }
  return [min, max];
}
const finite = (v: number | null): v is number => v !== null && Number.isFinite(v);
const tick = (v: number) => Math.abs(v) > 0 && Math.abs(v) < 0.01 ? v.toExponential(1) : Number(v.toFixed(2)).toString();

/** Rendering only: SPL/PSD values are supplied by B's analysis, never recomputed here. */
export function plot(canvas: HTMLCanvasElement, series: PlotSeries[], options: {
  x: [number, number]; y: [number, number]; xLabel: string; yLabel: string;
  right?: { range: [number, number]; label: string }; empty?: string;
}) {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d')!; ctx.scale(ratio, ratio);
  const left = 54, top = 26, w = Math.max(1, width - left - (options.right ? 62 : 18)), h = Math.max(1, height - top - 48);
  ctx.font = '11px ui-monospace, monospace'; ctx.lineWidth = 1;
  const grid = (x1: number, y1: number, x2: number, y2: number) => { ctx.strokeStyle = '#304357'; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); };
  for (let i = 0; i <= 4; i++) {
    const y = top + h * i / 4; grid(left,y,left+w,y);
    ctx.fillStyle = '#bfd0e2'; ctx.textAlign = 'right'; ctx.fillText(tick(options.y[1] - (options.y[1] - options.y[0]) * i / 4), left - 8,y+4);
    if (options.right) {
      ctx.textAlign = 'left'; ctx.fillStyle = ORIGINAL_COLOR;
      ctx.fillText(tick(options.right.range[1] - (options.right.range[1] - options.right.range[0]) * i / 4), left+w+7,y+4);
    }
  }
  const steps = w < 260 ? 2 : 4;
  for (let i = 0; i <= steps; i++) {
    const x = left + w * i / steps; grid(x,top,x,top+h);
    ctx.fillStyle = '#bfd0e2'; ctx.textAlign = i === 0 ? 'left' : i === steps ? 'right' : 'center';
    ctx.fillText(tick(options.x[0] + (options.x[1] - options.x[0]) * i / steps),x,top+h+18);
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#bfd0e2'; ctx.fillText(options.yLabel,left,13);
  if (options.right) { ctx.textAlign = 'right'; ctx.fillStyle = ORIGINAL_COLOR; ctx.fillText(options.right.label,left+w,13); }
  ctx.textAlign = 'center'; ctx.fillStyle = '#bfd0e2'; ctx.fillText(options.xLabel,left+w/2,height-4);
  for (const line of series) {
    const range = line.secondary && options.right ? options.right.range : options.y;
    ctx.strokeStyle = line.color; ctx.fillStyle = line.color; ctx.lineWidth = 1.6; ctx.beginPath();
    let connected = false;
    line.values.forEach((value,i) => {
      const time = line.x[i];
      if (!finite(value) || !Number.isFinite(time) || time < options.x[0] || time > options.x[1]) { connected = false; return; }
      const x = left + (time-options.x[0]) / (options.x[1]-options.x[0]) * w;
      const y = top + (range[1]-value) / (range[1]-range[0]) * h;
      if (connected) ctx.lineTo(x,y); else { ctx.moveTo(x,y); ctx.fillRect(x-1.5,y-1.5,3,3); }
      connected = true;
    }); ctx.stroke();
  }
  if (!series.some(line => line.values.some(finite))) {
    ctx.fillStyle = '#93a8c0'; ctx.textAlign = 'center'; ctx.fillText(options.empty ?? '等待有效数据',left+w/2,top+h/2);
  }
  ctx.textAlign = 'left';
}

export function drawSignalComparison(canvas: HTMLCanvasElement, analysis: LabAnalysis, original: LabAnalysis,
  sampleRate: number, offset: number, spectrum: boolean, originalOnly: boolean, frequencyRange?: [number, number]) {
  const values = (a: LabAnalysis) => spectrum
    ? Array.from(a.spectrum ?? [], value => 10*Math.log10(Math.max(value,1e-14))) : Array.from(a.waveform);
  const coordinates = (a: LabAnalysis, length: number) => Array.from({length},(_,i)=>spectrum
    ? i*sampleRate/1024 : offset+a.time-(a.waveform.length-i)/sampleRate);
  const raw = values(original), selected = values(analysis), mixedUnits = analysis.unit !== 'Pa';
  const peak = (values: number[]) => values.reduce((p,v)=>Math.max(p,Math.abs(v)),0.001)*1.05;
  const maximum = peak(mixedUnits ? selected : [...raw,...selected]);
  const rightPeak = peak(raw);
  const series: PlotSeries[] = [{ x: coordinates(original,raw.length), values: raw, color: ORIGINAL_COLOR, secondary: mixedUnits }];
  if (!originalOnly) series.push({ x: coordinates(analysis,selected.length), values:selected, color:RESULT_COLOR });
  const end = offset+analysis.time, start = Math.max(offset,end-0.2);
  plot(canvas,series,{
    x:spectrum ? frequencyRange ?? [0,sampleRate/2] : [start,Math.max(start+1/sampleRate,end)],
    y:spectrum ? [-140,20] : [-maximum,maximum], xLabel:spectrum ? '频率 / Hz' : '实验时间 / s',
    yLabel:spectrum ? `PSD ${analysis.spectrumWeighting === 'A' ? '(A)' : '(Z)'} / dB` : analysis.unit.startsWith('m/s') ? 'm/s²' : analysis.unit,
    right:mixedUnits ? { range:spectrum ? [-140,20] : [-rightPeak,rightPeak], label:spectrum ? '原声 PSD / dB' : '原声 / Pa' } : undefined,
    empty:spectrum ? '频谱准备中 · 需 0.512 秒' : '从首个样本开始显示',
  });
}
