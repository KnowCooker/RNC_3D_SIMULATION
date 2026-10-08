import { createFieldDisplay } from '../../../../src/team-a/viewer/field-display';
import { createFieldPoints } from '../../../../src/team-a/viewer/field-slices';
import type { FieldFrame } from '../../../../src/shared/lab-contracts';
const points = createFieldPoints();
const frame = (time: number, db: number): FieldFrame => ({ time, valid: true, layoutId: 'test', weighting: 'A', points,
  primarySpl: new Float32Array(points.length).fill(db), residualSpl: new Float32Array(points.length).fill(db - 4), reductionDb: new Float32Array(points.length).fill(4) });
const view = createFieldDisplay(points, true);
view.advance(1, true); view.update(frame(1, 60), 'residual', 'volume', [45, 85], true);
view.advance(2, true); view.update(frame(2, 75), 'residual', 'volume', [45, 85], true);
const samples = [.1, .35, .5, .75, .99].map(elapsed => { view.advance(2 + elapsed, true); return {elapsed, blend: view.blend}; });
console.log(JSON.stringify({samples, sliceHasTransition: 'temporalMix' in view.slices.get('y')!.mesh.material.uniforms}, null, 2));
view.dispose();
