import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../../src/shared/defaults';
import { createPaths, uniform } from '../../src/team-b/engine/data';
import type { RunResult } from '../../src/shared/contracts';
import { loadCore, loadData, replaceOnce, type Data, type Edit } from './engine-harness';

/** Deliberately asymmetric signed coefficients and distinct causal delays. */
export function asymmetricPaths() {
  const primary = Array.from({ length: 4 }, (_, m) => Array.from({ length: 4 }, (_, k) => {
    const p = new Float64Array(24); p[8 + m + 2 * k] = (1 + m * 4 + k) / 512;
    p[19 + k] = (m % 2 ? -1 : 1) * (k + 1) / 2048; return p;
  }));
  const secondary = Array.from({ length: 4 }, (_, m) => Array.from({ length: 4 }, (_, l) => {
    const s = new Float64Array(16); s[4 + m + l] = (1 + m * 4 + l) / 128;
    s[12 + l] = (m % 2 ? -1 : 1) * (l + 1) / 512; return s;
  }));
  return { primary, secondary };
}

export function timingData(onlyReference?: number): Data {
  const x = Array.from({ length: 4 }, (_, k) => Float64Array.from({ length: 32000 }, (_, n) =>
    n >= 3900 && n < 4070 && (onlyReference === undefined || onlyReference === k)
      ? (((n * (2 * k + 3) + k * 11) % 31) - 15) / 64 : 0));
  const d = Array.from({ length: 4 }, (_, m) => Float64Array.from({ length: 32000 }, (_, n) =>
    n < 4070 ? (m + 1) / 128 + ((n + m * 3) % 7) / 1024 : 0.001));
  return { x, d, ...asymmetricPaths() };
}

/** Independent direct recurrence: W[reference][tap][output], no production
 * convolution, no padded/filtered buffers, time-ordered secondary history.
 * Samples before 4000 have zero W, so only the active prefix needs recursion.
 */
export function directPrefix(input: Data, taps: number, end = 4050) {
  const w = Array.from({ length: 4 }, () => Array.from({ length: taps }, () => new Float64Array(4)));
  const blank = () => Array.from({ length: 4 }, () => new Float64Array(end));
  const u = blank(), a = blank(), e = input.d.map(row => row.slice(0, end));
  for (let n = 4000; n < end; n++) {
    for (let k = 0; k < 4; k++) for (let j = 0; j < taps; j++) for (let l = 0; l < 4; l++) {
      u[l][n] += w[k][j][l] * input.x[k][n - j];
    }
    for (let m = 0; m < 4; m++) {
      for (let delay = 0; delay < 16; delay++) for (let l = 0; l < 4; l++) {
        a[m][n] += input.secondary[m][l][delay] * u[l][n - delay];
      }
      e[m][n] += a[m][n];
    }
    for (let k = 0; k < 4; k++) for (let j = 0; j < taps; j++) for (let l = 0; l < 4; l++) {
      let gradient = 0;
      for (let m = 0; m < 4; m++) for (let delay = 0; delay < 16; delay++) {
        gradient += e[m][n] * input.secondary[m][l][delay] * input.x[k][n - j - delay];
      }
      w[k][j][l] -= 0.02 * gradient;
    }
  }
  return { u, a, e };
}
export function checkTiming(result: RunResult, input: Data, taps: number) {
  const expected = directPrefix(input, taps);
  let maxAbsError = 0;
  for (const key of ['u', 'a', 'e'] as const) for (let c = 0; c < 4; c++) for (let n = 0; n < 4050; n++) {
    const ref = Math.fround(expected[key][c][n]);
    const error = Math.abs(result.signals[key][c][n] - ref);
    maxAbsError = Math.max(maxAbsError, error);
    assert.ok(Number.isFinite(error) && error <= Math.max(1e-10, Math.abs(ref) * 2e-6), `${key}/${c}/${n}: ${error}`);
  }
  for (let c = 0; c < 4; c++) {
    assert.ok(result.signals.u[c].subarray(0, 4001).every(v => v === 0));
    assert.notEqual(result.signals.u[c][4001], 0); // first update at 4000, used at 4001
    assert.ok(result.signals.a[c].subarray(0, 4005 + c).every(v => v === 0));
    assert.notEqual(result.signals.a[c][4005 + c], 0);
  }
  let superpositionMax = 0;
  for (let c = 0; c < 4; c++) for (let n = 0; n < 32000; n++) {
    superpositionMax = Math.max(superpositionMax,
      Math.abs(result.signals.e[c][n] - result.signals.d[c][n] - result.signals.a[c][n]));
  }
  assert.ok(superpositionMax <= 1e-5);
  return { maxAbsError, superpositionMax, firstDriveSample: 4001, firstSecondaryByMic: [4005, 4006, 4007, 4008] };
}

export function checkPrimary(edit?: Edit) {
  const input = loadData(asymmetricPaths, edit).createData(11);
  const paths = asymmetricPaths().primary;
  let maxAbsError = 0;
  for (let m = 0; m < 4; m++) {
    const noise = uniform(5012 + 101 * m, 32000);
    for (let n = 0; n < 32000; n++) {
      let expected = 0.001 * Math.sqrt(3) * noise[n];
      for (let delay = 0; delay < 24 && delay <= n; delay++) for (let k = 0; k < 4; k++) {
        expected += paths[m][k][delay] * input.x[k][n - delay];
      }
      maxAbsError = Math.max(maxAbsError, Math.abs(input.d[m][n] - expected));
    }
  }
  assert.ok(maxAbsError < 1e-14, `P[error][source] mismatch: ${maxAbsError}`);
  return { maxAbsError, samples: 128000 };
}

export const timingMutations: { name: string; edit: Edit }[] = [
  { name: 'gradient-sign', edit: s => replaceOnce(s, 'w[j] -= config.stepSize', 'w[j] += config.stepSize') },
  { name: 'missing-error-contribution', edit: s => replaceOnce(s, 'e3 * f3[i]', '0 * f3[i]') },
  { name: 'diagonal-only-filtered-x', edit: s => replaceOnce(s, 'const filtered = secondary.map(row => row.map(path => x.map(signal => {', 'const filtered = secondary.map((row, m) => row.map((path, l) => x.map(signal => { if (m !== l) path = new Float64Array(path.length);') },
  { name: 'secondary-transpose', edit: s => replaceOnce(s, 'secondary[m][l][j] * u[l][n - j]', 'secondary[l][m][j] * u[l][n - j]') },
  { name: 'control-reference-transpose', edit: s => replaceOnce(s, 'const w = weights[l][k], input', 'const w = weights[k][l], input') },
  { name: 'secondary-one-sample-early', edit: s => replaceOnce(s, 'u[l][n - j]', 'u[l][Math.min(n, n - j + 1)]') },
  { name: 'filtered-x-one-sample-late', edit: s => replaceOnce(s, 'const i = end - j;', 'const i = Math.max(0, end - j - 1);') },
  { name: 'adaptation-one-sample-early', edit: s => replaceOnce(s, 'n >= 4000', 'n >= 3999') },
  { name: 'adaptation-one-sample-late', edit: s => replaceOnce(s, 'n >= 4000', 'n >= 4001') },
  { name: 'superposition-sign', edit: s => replaceOnce(s, 'd[m][n] + anti', 'd[m][n] - anti') },
];

export function runTimingAudit() {
  const timing = [32, 64].map(taps => {
    const input = timingData();
    const result = loadCore(() => input).calculateSync({ ...DEFAULT_CONFIG, taps: taps as 32 | 64 }, `timing-${taps}`);
    return { taps, ...checkTiming(result, input, taps) };
  });
  const primary = checkPrimary();
  const paths = createPaths();
  assert.equal(paths.secondary.flat().filter(p => p.some(v => v !== 0)).length, 16);
  const mutations = timingMutations.map(({ name, edit }) => {
    const input = timingData();
    const engine = loadCore(() => input, edit); // A compile/injection failure is NOT a caught mutation.
    let detected = false;
    try { checkTiming(engine.calculateSync(DEFAULT_CONFIG, name), input, 64); }
    catch (error) {
      if (!(error instanceof assert.AssertionError) && !(error instanceof engine.EngineError)) throw error;
      detected = true;
    }
    assert.ok(detected, `${name}: survived verification`);
    return { name, detected };
  });
  assert.throws(() => checkPrimary(s => replaceOnce(s, 'convolve(x[k], primary[m][k])', 'convolve(x[k], primary[k][m])')), assert.AssertionError);
  mutations.push({ name: 'primary-transpose', detected: true });
  return { timing, primary, mutations };
}
