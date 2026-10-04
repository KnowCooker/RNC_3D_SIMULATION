import test from 'node:test';
import assert from 'node:assert/strict';
import type { LabAnalysis } from '../src/shared/lab-contracts';
import { overviewReading } from '../src/team-a/lab/overview-reading';

const analysis = (): LabAnalysis => ({
  valid: true, time: 2.5, levelWeighting: 'A', primarySpl: [70,71,72,73],
  residualSpl: [65,69,74,70], reductionDb: [5,2,-2,3], waveform: new Float32Array(),
  spectrum: null, spectrumDb: null, unit: 'Pa',
});
test('A1 overview: paused microphone levels survive display-only page and field changes', () => {
  const paused = analysis(), expected = overviewReading(paused, 2, 100);
  // No field cache/mesh is supplied: hiding or recreating it cannot clear the experiment reading.
  for (const page of ['structure','compare','overview']) {
    assert.deepEqual(overviewReading(paused,2,100), expected, page);
  }
  assert.deepEqual(expected,{primary:72,residual:74,reduction:-2,time:102.5,unit:'dBA'});
  assert.equal(overviewReading(paused,0)?.reduction,5);
});
test('A1 overview: invalidated experiment, warm-up and unavailable microphone never show stale levels', () => {
  assert.equal(overviewReading(null,0),null);
  const a=analysis();a.valid=false;assert.equal(overviewReading(a,0),null);
  a.valid=true;a.time=.49;assert.equal(overviewReading(a,0),null);
  a.time=2.5;a.residualSpl=[null,69,74,70];assert.equal(overviewReading(a,0),null);
  assert.equal(overviewReading(a,4),null);
  a.levelWeighting='Z';assert.equal(overviewReading(a,1)?.unit,'dBZ');
});
