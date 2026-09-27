import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLab, createLabStream, sampleField, LAB_STREAM_CABIN_PREROLL_SAMPLES } from '../src/team-b/lab';
import { welchPsd } from '../src/team-b/analysis';
import { primaryPath } from '../src/team-b/lab/paths';
import { createSourceShape } from '../src/team-b/lab/sources';
import { RECORDED_PROFILE } from '../src/team-b/lab/recorded-profile';
import { defaultLabConfig, MIC_POSITIONS, type LabConfig } from '../src/shared/lab-contracts';

function spectralFraction(channels: readonly Float32Array[], low: number, high: number) {
  let total = 0, band = 0;
  for (const channel of channels) for (let end = 4000; end <= channel.length; end += 2000) {
    const psd = welchPsd(channel, end, 2000)!;
    for (let i = 1; i < psd.length; i++) {
      const f = i * 2000 / 1024;
      total += psd[i]; if (f >= low && f < high) band += psd[i];
    }
  }
  return band / total;
}

test('recording-derived data keeps all references and uncalibrated provenance; spectra distinguish vibration and cabin noise', () => {
  assert.equal(RECORDED_PROFILE.originalUnit, 'V');
  assert.equal(RECORDED_PROFILE.calibrated, false);
  assert.deepEqual([...RECORDED_PROFILE.includedReferenceChannels], Array.from({ length: 48 }, (_, i) => i+1));
  assert.deepEqual([...RECORDED_PROFILE.primaryChannels], [49,50,51,52,53,54,55,56]);
  // Data-grounded broad-band checks across new random realizations. The recorded
  // pooled ear power is predominantly <100Hz; references retain >350Hz energy.
  for (const seed of [11, 29, 47]) {
    const result = calculateLab({ ...defaultLabConfig(), speedKph: 40, seed, rncEnabled: false }, 'spectrum');
    assert.ok(spectralFraction(result.signals.d, 1, 100) > .7);
    assert.ok(spectralFraction(result.signals.d, 350, 1000) < .025);
    assert.ok(spectralFraction(result.signals.x, 350, 1000) > .2);
  }
});

test('spectral stretch remains causal, normalized and exactly shared by batch/stream at temperature-pressure limits', () => {
  for (const patch of [{ pressureKpa: 160, temperatureC: -20 }, { pressureKpa: 320, temperatureC: 50 }]) {
    const config: LabConfig = { ...defaultLabConfig(), ...patch };
    const shape = createSourceShape(config);
    assert.ok(shape.length <= 512 && shape.every(Number.isFinite));
    assert.ok(Math.abs(shape.reduce((sum, v) => sum+v*v, 0)/3 - 1) < 1e-12);
    assert.notDeepEqual(shape, createSourceShape(defaultLabConfig()));
    const batch = calculateLab(config, 'stretch-batch'), stream = createLabStream(config, 'stretch-stream');
    stream.process(1); stream.process(599); const chunk = stream.process(4000);
    for (const key of ['x','d','u','a','e'] as const) for (let ch = 0; ch < batch.signals[key].length; ch++) {
      assert.deepEqual(chunk.signals[key][ch], batch.signals[key][ch].slice(600, 4600));
    }
    for (const point of [...MIC_POSITIONS, [1.3, 2.3, -2.6] as const]) for (let q = 0; q < 4; q++) {
      const path = primaryPath(config, q, point);
      assert.ok(path.delays.every(d => d >= 1 && d < LAB_STREAM_CABIN_PREROLL_SAMPLES));
    }
    const frame = sampleField(batch, 16, [...MIC_POSITIONS]);
    assert.equal(frame.valid, true);
  }
});
