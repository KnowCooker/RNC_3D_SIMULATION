import assert from 'node:assert/strict';
import test from 'node:test';
import { drawConvergence, drawWaveform } from '../src/team-a/charts';
import type { RunResult } from '../src/shared/contracts';

function canvasRecorder() {
  const lines: { color: string; path: string[] }[] = [], text: string[] = [];
  let path: string[] = [];
  const ctx = {
    strokeStyle: '', fillStyle: '', font: '', textAlign: '', lineWidth: 1,
    scale() {}, beginPath() { path = []; },
    moveTo() { path.push('move'); }, lineTo() { path.push('line'); },
    stroke() { lines.push({ color: this.strokeStyle, path: [...path] }); },
    fillText(value: string) { text.push(value); },
  };
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
  return { canvas: { clientWidth: 400, clientHeight: 160, getContext: () => ctx } as unknown as HTMLCanvasElement, lines, text };
}

test('A1: unavailable convergence values leave gaps rather than zero gain or connecting across missing data', () => {
  const r = canvasRecorder();
  drawConvergence(r.canvas, [[null, 3, 4, null, 6, 7], [null, null]]);
  assert.deepEqual(r.lines.find(line => line.color === '#58d8b4')?.path, ['move','line','move','line']);
  assert.deepEqual(r.lines.find(line => line.color === '#78b8fd')?.path, []);
});

test('A1: original noise draws once in grey, residual compares against the same original channel', () => {
  const signal = Float32Array.of(0.003, -0.002, 0.001);
  const result = { signals: { d: [signal,signal,signal,signal], e: [signal,signal,signal,signal] } } as unknown as RunResult;
  const original = canvasRecorder(); drawWaveform(original.canvas, result, 3, { signal: 'd', channel: 'rr' });
  assert.equal(original.lines.filter(line => line.color === '#617984').length, 1);
  assert.equal(original.lines.filter(line => line.color === '#58d8b4').length, 0);
  const residual = canvasRecorder(); drawWaveform(residual.canvas, result, 3, { signal: 'e', channel: 'rr' });
  assert.equal(residual.lines.filter(line => line.color === '#617984').length, 1);
  assert.equal(residual.lines.filter(line => line.color === '#58d8b4').length, 1);
  assert.ok(original.text.slice(0,4).every(label => Number(label) !== 0), 'small pressure ticks must not all round to 0.0');
});
