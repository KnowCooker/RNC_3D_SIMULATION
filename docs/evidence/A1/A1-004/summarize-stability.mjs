import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const samples = (await readFile(join(dir, 'stability-samples.jsonl'), 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line.replace(/^\uFEFF/, '')));
const progress = JSON.parse((await readFile(join(dir, 'stability-progress.json'), 'utf8')).replace(/^\uFEFF/, ''));
const end = samples.at(-1);
const summarize = values => ({ min: Math.min(...values), max: Math.max(...values), mean: values.reduce((a,b) => a+b,0)/values.length, first: values[0], last: values.at(-1) });
const warm = samples.filter(sample => sample.state.elapsedMs >= 120000 && sample.state.elapsedMs < 240000);
const late = samples.filter(sample => sample.state.elapsedMs >= end.state.elapsedMs - 120000);
const heapValues = rows => rows.map(sample => sample.heap.usedSize);
const selectionActions = samples.flatMap(sample => sample.actions.filter(action => action.type === 'seat-and-mode-switch'));
let previousSeat = 'fl', previousMode = 'e', actualSeatChanges = 0, actualModeChanges = 0;
for (const action of selectionActions) {
  if (action.seat !== previousSeat) ++actualSeatChanges;
  if (action.mode !== previousMode) ++actualModeChanges;
  previousSeat = action.seat; previousMode = action.mode;
}
const report = {
  status: progress.status,
  start: new Date(end.state.startedAt).toISOString(), end: end.sampledAt,
  actualElapsedSeconds: progress.actualElapsedSeconds,
  browserElapsedSeconds: end.state.elapsedMs / 1000,
  browserMonotonicElapsedSeconds: end.state.monotonicElapsedMs / 1000,
  samples: samples.length, computations: end.state.computations, switches: end.state.switches, replays: end.state.replays,
  actualSeatChanges, actualModeChanges,
  advancedPlaybackSamples: samples.filter(sample => Number.parseFloat(sample.state.time) > 0.5).length,
  maximumSampledPlaybackSeconds: Math.max(...samples.map(sample => Number.parseFloat(sample.state.time))),
  allComputations: samples.flatMap(sample => sample.actions.filter(action => action.type === 'real-worker-computation')),
  errors: end.state.errors, rejections: end.state.rejections,
  contextLostObserved: samples.some(sample => sample.state.webglContextLost),
  renderer: end.state.renderer,
  liveElements: summarize(samples.map(sample => sample.state.liveElements)),
  canvasCount: summarize(samples.map(sample => sample.state.canvasCount)),
  rendererGeometries: summarize(samples.map(sample => sample.state.rendererMemory?.geometries ?? 0)),
  rendererTextures: summarize(samples.map(sample => sample.state.rendererMemory?.textures ?? 0)),
  cdpDomNodes: summarize(samples.map(sample => sample.dom.nodes)),
  cdpDocuments: summarize(samples.map(sample => sample.dom.documents)),
  cdpEventListeners: summarize(samples.map(sample => sample.dom.jsEventListeners)),
  jsHeapBytes: summarize(heapValues(samples)),
  backingStorageBytes: summarize(samples.map(sample => sample.heap.backingStorageSize)),
  embedderHeapBytes: summarize(samples.map(sample => sample.heap.embedderHeapUsedSize)),
  warmWindowHeapBytes: summarize(heapValues(warm)),
  lastWindowHeapBytes: summarize(heapValues(late)),
  note: 'Heap and DOM CDP counters include transient, detached, and instrumentation allocations before GC. These are diagnostic samples, not a heap leak proof; compare warm/end windows and live DOM. No forced garbage collection, fake clock, mocked engine, or altered audio gain was used. Browser rendering and Web Audio transport do not verify physical audible output or audiovisual latency.',
};
report.minimumExercisePassed = progress.status === 'completed' && progress.actualElapsedSeconds >= 1200 && report.computations >= 10 && report.actualSeatChanges >= 20 && report.actualModeChanges >= 20 && report.replays >= 2 && !report.errors.length && !report.rejections.length && !report.contextLostObserved;
await writeFile(join(dir, 'stability-summary.json'), JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify(report, null, 2));
