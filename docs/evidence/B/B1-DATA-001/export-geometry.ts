import { writeFileSync } from 'node:fs';
import { defaultLabConfig, MIC_POSITIONS } from '../../../../src/shared/lab-contracts';
import { geometricPrimaryPath, referencePath } from '../../../../src/team-b/lab/paths';

// Snapshot of the teaching geometry before spectral coloration. No measured
// transfer identification or MATLAB control logic is used here.
const config = { ...defaultLabConfig(), speedKph: 40 };
writeFileSync(new URL('./teaching-geometry.json', import.meta.url), JSON.stringify({
  config, primary: MIC_POSITIONS.map(point => [0, 1, 2, 3].map(i => geometricPrimaryPath(config, i, point))),
  reference: config.references.map(ref => [0, 1, 2, 3].map(i => referencePath(config, i, ref.position))),
}, null, 2));
