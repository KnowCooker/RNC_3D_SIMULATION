import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url)), prefix = process.argv[2] ?? '';
const json = async name => JSON.parse((await readFile(join(dir, prefix + name), 'utf8')).replace(/^\uFEFF/, ''));
const samples = (await readFile(join(dir, prefix + 'stability-samples.jsonl'), 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line.replace(/^\uFEFF/, '')));
const progress = await json('stability-progress.json'), config = await json('run-config.json'), last = samples.at(-1), end = last.state;
const stats = values => {
  values = values.filter(Number.isFinite);
  return values.length ? { count: values.length, min: Math.min(...values), max: Math.max(...values), mean: values.reduce((sum,n)=>sum+n,0)/values.length, first: values[0], last: values.at(-1) } : null;
};
const runs = end.runs;
const firstLive = runs.find(run=>run.mode==='live');
const continuous = samples.filter(sample=>sample.state.currentRun===firstLive?.runId&&sample.state.mode==='live');
const warm = continuous.filter(sample=>sample.state.elapsedSeconds>=60&&sample.state.elapsedSeconds<130);
const later = continuous.filter(sample=>sample.state.elapsedSeconds>=260&&sample.state.elapsedSeconds<335);
const warmHeap = stats(warm.map(sample=>sample.heap.usedSize)), laterHeap = stats(later.map(sample=>sample.heap.usedSize));
const heapGrowthNeedsInvestigation = warmHeap&&laterHeap ? laterHeap.min > warmHeap.min + 32*1024*1024 && laterHeap.mean > warmHeap.mean * 1.5 : null;
const actions = samples.flatMap(sample=>sample.actions);
let previousSeat='0', previousMode='e', actualSeatChanges=0, actualComparisonChanges=0;
for(const action of actions.filter(action=>action.type==='seat-and-mode-switch')){
  if(action.seat!==previousSeat) actualSeatChanges++;
  if(action.comparison!==previousMode) actualComparisonChanges++;
  previousSeat=action.seat;previousMode=action.comparison;
}
const continuousTime = Math.max(0,...continuous.map(sample=>sample.state.timeSeconds));
const gates = {
  completed:progress.status==='completed', frozenBuild:progress.buildUnchanged===true,
  realWallAtLeast1200:progress.actualElapsedSeconds>=1200&&end.elapsedSeconds>=1200,
  realWorkerRunsAtLeast10:runs.filter(run=>run.ready).length>=10,
  actualSeatChangesAtLeast20:actualSeatChanges>=20, actualComparisonChangesAtLeast20:actualComparisonChanges>=20,
  playsOrResumesAtLeast20:end.playActions>=20,
  oneContinuousRunOver300:continuousTime>300&&firstLive.endSample/2000>300,
  newSamplesBeyond16Seconds:firstLive?.new16Blocks>100&&firstLive?.repeated16Blocks===0,
  boundedSnapshots:end.maximumSnapshotSamples<=4096,
  boundedAudio:samples.every(sample=>sample.state.audio.activeSources<=16&&(sample.state.queuedSeconds===null||sample.state.queuedSeconds<=2.01)),
  oneActiveWorker:samples.every(sample=>sample.state.activeWorkers<=1),
  noRuntimeErrors:!end.errors.length&&!end.rejections.length&&!end.violations.length&&!end.glLosses.length&&runs.every(run=>!run.errors.length),
  noObservedContextLoss:samples.every(sample=>!sample.state.webglContextLost),
  noObviousSteadyHeapGrowth:heapGrowthNeedsInvestigation===false,
};
const report={
  config,status:progress.status,start:progress.startedAt,end:progress.endedAt,actualElapsedSeconds:progress.actualElapsedSeconds,browserElapsedSeconds:end.elapsedSeconds,samples:samples.length,gates,
  counts:{readyRuns:runs.filter(run=>run.ready).length,batchRuns:runs.filter(run=>run.mode==='batch'&&run.ready).length,liveRuns:runs.filter(run=>run.mode==='live'&&run.ready).length,actualSeatChanges,actualComparisonChanges,playActions:end.playActions,workerMessages:end.workerMessages},
  continuous:{runId:firstLive?.runId,maximumDisplayedSeconds:continuousTime,generatedSeconds:firstLive?.endSample/2000,chunks:firstLive?.chunks,new16Blocks:firstLive?.new16Blocks,repeated16Blocks:firstLive?.repeated16Blocks,firstChunkAt:firstLive?.firstChunkAt,lastChunkAt:firstLive?.lastChunkAt},
  background:end.backgroundTest,visibilityEvents:end.visibilityEvents,runs,errors:end.errors,rejections:end.rejections,violations:end.violations,glLosses:end.glLosses,
  environment:{renderer:end.renderer,viewport:end.viewport,drawingBuffer:end.drawingBuffer},
  sampled:{heapBytes:stats(samples.map(s=>s.heap.usedSize)),backingStorageBytes:stats(samples.map(s=>s.heap.backingStorageSize)),audioSources:stats(samples.map(s=>s.state.audio.activeSources)),audioBufferBytes:stats(samples.map(s=>s.state.audio.activeBufferBytes)),queueSeconds:stats(samples.map(s=>s.state.queuedSeconds)),underruns:stats(samples.map(s=>s.state.underruns)),domNodes:stats(samples.map(s=>s.dom.nodes)),liveElements:stats(samples.map(s=>s.state.liveElements)),rendererGeometries:stats(samples.map(s=>s.state.rendererMemory?.geometries)),rendererTextures:stats(samples.map(s=>s.state.rendererMemory?.textures)),recentFps:stats(samples.map(s=>s.state.recentFrames.averageFps))},
  steadyMemory:{warm60to130Seconds:warmHeap,later260to335Seconds:laterHeap,heapGrowthNeedsInvestigation},
  limitations:['This headless browser run is not target integrated-GPU acceptance, physical audio listening, or measured audiovisual latency.','Audio is muted through the normal UI; transport scheduling and buffers remain active.','Read-only wrappers observe real Worker messages and Web Audio node lifecycles; they do not inject results, change DSP gains, force GC, or accelerate time.','Heap measurements include transient allocations; bounded snapshots/audio and steady windows are evidence against obvious growth, not a formal absence-of-leaks proof.','Background behavior is proven only if the actual document visibility changed; headless tab behavior is reported explicitly.'],
};
report.minimumExercisePassed = Object.values(gates).every(Boolean);
report.smokeOnly = config.smokeOnly;
await writeFile(join(dir,prefix+'stability-summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,actualElapsedSeconds:report.actualElapsedSeconds,counts:report.counts,gates:report.gates,minimumExercisePassed:report.minimumExercisePassed,smokeOnly:report.smokeOnly,summaryFile:join(dir,prefix+'stability-summary.json')},null,2));
if(!config.smokeOnly&&!report.minimumExercisePassed) process.exitCode=1;
