import { ORDER, type Four, type RunResult, type SignalKind } from './contracts';

/** Data conversion only. The supplied Python golden remains immutable. */
export function decodeFixture(packet: {
  encoding: string;
  metadata: Omit<RunResult, 'signals'>;
  signals: Record<SignalKind, string[]>;
}): RunResult {
  if (packet.encoding !== 'base64-f32le' || packet.metadata.sampleCount !== 32000 ||
      packet.metadata.order.join(',') !== ORDER.join(',')) throw new Error('参考数据格式不兼容');
  const signals = {} as RunResult['signals'];
  for (const kind of ['x', 'u', 'd', 'a', 'e'] as const) {
    if (packet.signals[kind].length !== 4) throw new Error('参考数据通道数错误');
    signals[kind] = packet.signals[kind].map(text => {
      const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
      if (bytes.length !== 32000 * 4) throw new Error('参考数据长度错误');
      const view = new DataView(bytes.buffer);
      return Float32Array.from({ length: 32000 }, (_, i) => {
        const value = view.getFloat32(i * 4, true);
        if (!Number.isFinite(value)) throw new Error('参考数据包含非有限数值');
        return value;
      });
    }) as unknown as Four<Float32Array>;
  }
  return { ...packet.metadata, source: 'reference-replay', signals };
}
