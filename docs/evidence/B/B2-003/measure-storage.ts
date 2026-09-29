/** B2 / Codex / B2-003 design-only byte audit. No fixture or runtime writes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { calculateSync } from '../../../../src/team-b/engine/core';
import { calculateLab } from '../../../../src/team-b/lab';
import { DEFAULT_CONFIG } from '../../../../src/shared/defaults';
import { defaultLabConfig } from '../../../../src/shared/lab-contracts';

function measure(name: string, groups: Record<string, readonly Float32Array[]>) {
  let samples = 0, bytes = 0;
  for (const channels of Object.values(groups)) for (const signal of channels) {
    const encoded = new Uint8Array(signal.byteLength);
    const view = new DataView(encoded.buffer);
    signal.forEach((value, i) => view.setFloat32(i * 4, value, true));
    const decoded = Float32Array.from(signal, (_, i) => view.getFloat32(i * 4, true));
    assert.deepEqual(new Uint8Array(decoded.buffer), new Uint8Array(signal.buffer, signal.byteOffset, signal.byteLength));
    samples += signal.length; bytes += signal.byteLength;
  }
  const json = JSON.stringify(Object.fromEntries(Object.entries(groups).map(([kind, channels]) =>
    [kind, channels.map(signal => Array.from(signal))])));
  return { name, totalScalarSamples: samples, payloadBytes: bytes,
    jsonArrayUtf8Bytes: Buffer.byteLength(json), base64Characters: 4 * Math.ceil(bytes / 3),
    inputPlusEncodedPayloadLowerBoundBytes: 2 * bytes, finiteFloat32Roundtrip: 'bit-identical' };
}
const edge = Float32Array.of(-0, 0, Math.fround(1e-40), -3.4028234663852886e38, 3.4028234663852886e38);
const demo = calculateSync(DEFAULT_CONFIG, 'design-storage-demo');
const config = defaultLabConfig();
const lab = calculateLab(config, 'design-storage-lab');
const asset = readFileSync(new URL('../../../../src/team-b/lab/data/recorded-primary.f32', import.meta.url));
console.log(JSON.stringify({ role: 'B2', executor: 'Codex', task: 'B2-003',
  baseline: '842bec8197a61df9d849e60e86504292de7846d0',
  scope: 'Design byte-strategy experiment; no product codec, no peak memory or independent numerical acceptance',
  measured: [measure('demo-v2/default/16s', demo.signals),
    measure('lab-v3/default/shaped-noise/16s/4refs', { q: lab.sources, ...lab.signals }),
    measure('Float32 edge values', { edge: [edge] })],
  estimatedOnly: { name: 'lab-v3/90s/8refs', payloadBytes: (20 + 8) * 90 * 2000 * 4 },
  recording: { path: 'src/team-b/lab/data/recorded-primary.f32', bytes: asset.byteLength,
    sha256: createHash('sha256').update(asset).digest('hex') }
}, null, 2));
