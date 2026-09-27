"""Prepare four measured primary-noise tracks as equivalent wheel sound sources.

Read-only input: the previously verified original extraction. No vibration inputs,
phase randomization, per-channel gain equalization, MATLAB execution, or ANC fitting.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path
import numpy as np

HERE = Path(__file__).parent
ROOT = HERE.parents[3]
CHANNELS = [49, 53, 51, 55]  # Left ear of FL, FR, RL, RR; placed at virtual wheel positions.


def prepare(source):
    with np.load(source) as original:
        assert int(original['sample_rate_hz']) == 4000
        recorded = original['primary_ears'][:, [0, 4, 2, 6]].copy()
    assert recorded.shape == (160000, 4) and np.isfinite(recorded).all()
    centered = recorded - recorded.mean(axis=0)
    # Identical zero-phase anti-alias filtering across channels preserves relative timing.
    offsets = np.arange(-128, 129)
    kernel = 2 * 900 / 4000 * np.sinc(2 * 900 / 4000 * offsets) * np.kaiser(257, 8.6)
    kernel /= kernel.sum()
    downsampled = np.column_stack([
        np.convolve(np.pad(centered[:, ch], 128, mode='reflect'), kernel, 'valid')[::2]
        for ch in range(4)
    ])
    downsampled -= downsampled.mean(axis=0)
    common_rms = float(np.sqrt(np.mean(downsampled ** 2)))
    normalized = downsampled / common_rms
    asset = ROOT / 'src/team-b/lab/data/recorded-primary.f32'
    asset.parent.mkdir(parents=True, exist_ok=True)
    payload = struct.pack('<4sIII', b'RNQ1', 2000, len(normalized), 4) + normalized.T.astype('<f4').tobytes()
    asset.write_bytes(payload)
    f = np.fft.rfftfreq(65536, 1/4000)
    response = np.abs(np.fft.rfft(kernel, 65536))
    report = {
        'source': str(source), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'originalChannelsOneBased': CHANNELS, 'originalKind': 'primary noise / left ear, not vibration',
        'virtualPlacements': ['FL wheel', 'FR wheel', 'RL wheel', 'RR wheel'],
        'physicalMappingMeasured': False, 'originalUnit': 'V', 'calibrated': False,
        'originalSampleRateHz': 4000, 'sampleRateHz': 2000, 'samplesPerChannel': len(normalized),
        'durationSeconds': 40, 'antiAlias': {'taps': 257, 'cutoffHz': 900, 'window': 'Kaiser beta=8.6',
            'stopbandAbove1000HzMaxDb': float(20*np.log10(response[f >= 1000].max())),
            'passbandThrough800HzMinDb': float(20*np.log10(response[f <= 800].min()))},
        'normalization': 'one common RMS across four channels; relative gains and timing retained',
        'commonRmsVolts': common_rms, 'rmsByChannelVolts': np.sqrt(np.mean(downsampled**2, axis=0)).tolist(),
        'normalizedCrossCorrelation': np.corrcoef(normalized.T).tolist(),
        'asset': str(asset.relative_to(ROOT)), 'assetBytes': len(payload),
        'assetSha256': hashlib.sha256(payload).hexdigest(),
        'loop': {'crossfadeSamples': 400, 'periodSamples': 79600, 'periodSeconds': 39.8,
                 'method': 'all four channels share the same raised-cosine overlap weights'},
    }
    (HERE / 'recording-preparation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: report[k] for k in ['originalChannelsOneBased','assetBytes','assetSha256','antiAlias']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    prepare(parser.parse_args().source)
