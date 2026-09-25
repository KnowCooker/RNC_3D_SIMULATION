import { writeFileSync } from 'node:fs';
import { calculateLab } from '../../../../src/team-b/lab';
import { weightedPower } from '../../../../src/team-b/lab/weighting';
import { TEACHING_PRESSURE_GAIN } from '../../../../src/team-b/lab/pressure-calibration';
import { defaultLabConfig } from '../../../../src/shared/lab-contracts';

const run = calculateLab({ ...defaultLabConfig(), speedKph: 40, rncEnabled: false, levelOffsetDb: 0 }, 'teaching-anchor');
const power = run.signals.d.reduce((sum, d) => sum + weightedPower(d, 24000, 32000, 'A'), 0) / 4;
const before = 10 * Math.log10(power / (20e-6) ** 2);
const gain = TEACHING_PRESSURE_GAIN * 10 ** ((60 - before) / 20);
writeFileSync(new URL('../../../../src/team-b/lab/pressure-calibration.ts', import.meta.url),
  `/** Teaching anchor: BEV,40km/h,roughness1,240kPa,20C,seed11; 4-mic pooled last4s =60dBA. Not measured DSP calibration. */\nexport const TEACHING_PRESSURE_GAIN = ${gain};\nexport const TEACHING_BASELINE_DBA = 60;\n`);
writeFileSync(new URL('./calibration.json', import.meta.url), JSON.stringify({ beforeDba: before, targetDba: 60, gain,
  scope: '0-1000Hz synthetic road-noise component; illustrative level, not calibrated measurement' }, null, 2));
console.log({ before, gain, target: 60 });
