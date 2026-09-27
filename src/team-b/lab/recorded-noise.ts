import type { Four } from '../../shared/contracts';

export const RECORDED_NOISE_CHANNELS = [49, 53, 51, 55] as const;
export const RECORDED_NOISE_SAMPLES = 80000;
export const RECORDED_NOISE_CROSSFADE = 400;
export const RECORDED_NOISE_PERIOD = RECORDED_NOISE_SAMPLES - RECORDED_NOISE_CROSSFADE;
export interface RecordedNoise { sampleRateHz: 2000; channels: Four<Float32Array> }

/** Portable little-endian asset; only the integration layer performs I/O. */
export function decodeRecordedNoise(buffer: ArrayBuffer): RecordedNoise {
  const view = new DataView(buffer);
  if (buffer.byteLength !== 16 + 4 * RECORDED_NOISE_SAMPLES * 4 ||
      view.getUint32(0, true) !== 0x31514e52 || view.getUint32(4, true) !== 2000 ||
      view.getUint32(8, true) !== RECORDED_NOISE_SAMPLES || view.getUint32(12, true) !== 4) {
    throw new Error('实录初级噪声资源格式不匹配');
  }
  const channels = Array.from({ length: 4 }, (_, channel) => Float32Array.from({ length: RECORDED_NOISE_SAMPLES },
    (_, sample) => view.getFloat32(16 + (channel * RECORDED_NOISE_SAMPLES + sample) * 4, true))) as unknown as Four<Float32Array>;
  if (channels.some(values => !values.every(Number.isFinite))) throw new Error('实录初级噪声含无效样本');
  return { sampleRateHz: 2000, channels };
}

/** Synchronized fixed-size recording, not a store of generated simulation history. */
export function createRecordedNoiseReader(recording?: RecordedNoise) {
  if (!recording || recording.sampleRateHz !== 2000 || recording.channels.length !== 4 ||
      recording.channels.some(values => values.length !== RECORDED_NOISE_SAMPLES || !values.every(Number.isFinite))) {
    throw new Error('请先加载四路实录初级噪声');
  }
  // Owned copies prevent mutation by callers after the processor starts.
  const channels = recording.channels.map(values => values.slice());
  const overlap = RECORDED_NOISE_CROSSFADE, period = RECORDED_NOISE_PERIOD;
  const fades = Float64Array.from({ length: overlap }, (_, i) => (1 - Math.cos(Math.PI * i / (overlap - 1))) / 2);
  return {
    storageBytes: channels.reduce((bytes, values) => bytes + values.byteLength, fades.byteLength),
    sample(channel: number, absoluteSample: number) {
      const phase = absoluteSample % period, values = channels[channel];
      if (phase < period - overlap) return values[phase + overlap];
      const at = phase - (period - overlap), mix = fades[at];
      return values[phase + overlap] * (1 - mix) + values[at] * mix;
    },
  };
}
