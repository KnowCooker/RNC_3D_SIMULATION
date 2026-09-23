import { ORDER, type AnalysisFrame, type RunResult, type SignalKind, type Corner } from '../../shared/contracts';

const colors = ['#58d8b4', '#78b8fd', '#f1bb68', '#c094e7'];
function plot(canvas: HTMLCanvasElement, series: { values: (number | null)[]; color: string }[], min: number, max: number, left: string, right: string) {
  const ratio = Math.min(devicePixelRatio, 2), width = canvas.clientWidth, height = canvas.clientHeight;
  canvas.width = width * ratio; canvas.height = height * ratio;
  const ctx = canvas.getContext('2d')!; ctx.scale(ratio, ratio);
  const x0 = 42, y0 = 13, w = width - 55, h = height - 36;
  ctx.font = '10px ui-monospace, monospace';
  for (let i = 0; i < 4; i++) {
    const y = y0 + h * i / 3;
    ctx.strokeStyle = '#263943'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
    const value = max - (max - min) * i / 3;
    ctx.fillStyle = '#819aa7'; ctx.fillText(Math.abs(value) < 1 && value !== 0 ? value.toPrecision(2) : value.toFixed(1), 1, y + 3);
  }
  ctx.fillStyle = '#819aa7'; ctx.fillText(left, x0, height - 3); ctx.textAlign = 'right'; ctx.fillText(right, width - 10, height - 3); ctx.textAlign = 'left';
  for (const s of series) {
    ctx.strokeStyle = s.color; ctx.lineWidth = 1.4; ctx.beginPath();
    let connected = false;
    s.values.forEach((value, i) => {
      if (value === null) { connected = false; return; }
      const x = x0 + i / Math.max(1, s.values.length - 1) * w;
      const y = y0 + (1 - (value - min) / (max - min)) * h;
      if (!connected) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      connected = true;
    }); ctx.stroke();
  }
}

export function drawWaveform(canvas: HTMLCanvasElement, result: RunResult, end: number, selected: { signal: SignalKind; channel: Corner }) {
  const start = Math.max(0, end - 500), index = ORDER.indexOf(selected.channel);
  const signal = result.signals[selected.signal][index];
  const series = [{ values: Array.from(signal.subarray(start, end)), color: selected.signal === 'd' ? '#617984' : colors[0] }];
  if (selected.signal === 'e') series.unshift({ values: Array.from(result.signals.d[index].subarray(start, end)), color: '#617984' });
  let peak = 0.001;
  for (const s of series) for (const v of s.values) peak = Math.max(peak, Math.abs(v));
  plot(canvas, series, -peak, peak, `${(start / 2000).toFixed(2)} s`, `${(end / 2000).toFixed(2)} s`);
}

export function drawSpectrum(canvas: HTMLCanvasElement, frame: AnalysisFrame) {
  const values = frame.spectrum ? Array.from(frame.spectrum.psd, v => 10 * Math.log10(Math.max(v, 1e-14))) : [];
  plot(canvas, [{ values, color: colors[1] }], -140, 0, '0 Hz', '1000 Hz');
}

export function drawConvergence(canvas: HTMLCanvasElement, curves: (number | null)[][]) {
  plot(canvas, curves.map((values, i) => ({ values, color: colors[i] })), -5, 35, '0.5 s', '16 s');
}
