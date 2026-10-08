import type { AcousticWeighting, FieldFrame, Vec3 } from '../../shared/lab-contracts';

type FieldRequest = (time: number, points: Vec3[], weighting: AcousticWeighting) => Promise<FieldFrame>;

/** Query a single physical window in bounded batches, yielding between them so
 * audio production/control messages are not trapped behind a dense field job.
 * Publish only the complete grid; never mix per-point windows on the screen. */
export async function queryFieldGrid(request: FieldRequest, time: number, points: Vec3[], weighting: AcousticWeighting,
  sampleRate: number, current: () => boolean, batchSize = 192): Promise<FieldFrame> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw Error('Invalid field query batch');
  const requestedTime = (Math.floor(time * sampleRate) + .25) / sampleRate;
  const primarySpl = new Float32Array(points.length), residualSpl = primarySpl.slice(), reductionDb = primarySpl.slice();
  let identity: FieldFrame | null = null, valid = false;
  for (let offset = 0; offset < points.length; offset += batchSize) {
    if (!current()) throw new Error('Field query superseded');
    const batch = points.slice(offset, offset + batchSize), frame = await request(requestedTime, batch, weighting);
    if (!current()) throw new Error('Field query superseded');
    if (frame.points.length !== batch.length || frame.primarySpl.length !== batch.length || frame.residualSpl.length !== batch.length || frame.reductionDb.length !== batch.length
      || frame.points.some((p, i) => p.length !== 3 || p.some((v, c) => !Number.isFinite(v) || Math.abs(v - batch[i][c]) > 1e-5))) throw Error('声场分批响应的采样位置不一致');
    if (frame.weighting !== weighting || identity && (frame.layoutId !== identity.layoutId || Math.abs(frame.time - identity.time) > 1e-8)) throw Error('声场分批响应不属于同一布局、计权或时间窗');
    identity ??= frame; valid ||= frame.valid;
    primarySpl.set(frame.primarySpl, offset); residualSpl.set(frame.residualSpl, offset); reductionDb.set(frame.reductionDb, offset);
    if (offset + batchSize < points.length) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  if (!identity) throw Error('Empty field grid');
  return {layoutId: identity.layoutId, weighting, time: identity.time, valid, points, primarySpl, residualSpl, reductionDb};
}
