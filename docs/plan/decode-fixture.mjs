/** Decode the supplied reference fixture in a browser or Node.js.
 * Format conversion only. This module is NOT a simulation engine.
 */
export function decodeFixture(packet) {
  if (packet.encoding !== 'base64-f32le') throw new Error('Unsupported fixture encoding');
  const signals = {};
  for (const kind of ['x','u','d','a','e']) {
    const encoded = packet.signals[kind];
    if (!Array.isArray(encoded) || encoded.length !== 4) throw new Error('Invalid channel count');
    signals[kind] = encoded.map(text => {
      const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
      if (bytes.length !== packet.metadata.sampleCount * 4) throw new Error('Invalid sample count');
      const view = new DataView(bytes.buffer);
      const samples = new Float32Array(packet.metadata.sampleCount);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = view.getFloat32(i * 4, true);
        if (!Number.isFinite(samples[i])) throw new Error('Non-finite fixture data');
      }
      return samples;
    });
  }
  return { ...packet.metadata, signals };
}
