"""Read-only DAT extraction and independent spectral audit; never executes MATLAB.

MATLAB supplies file layout/fs/channel labels only. No EHRF, channel zeroing,
Wiener solver, control weights or MATLAB evaluation rules are imported.
Requires numpy, matplotlib. Raw extracted data goes outside the repository.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

FS = 4000
SEATS = {'FL': [49, 50], 'FR': [53, 54], 'RL': [51, 52], 'RR': [55, 56]}
BANDS = [(0, 20), (20, 50), (50, 100), (100, 200), (200, 350),
         (350, 600), (600, 1000), (1000, 2001)]


def read_dat(path):
    with path.open('r', encoding='ascii') as handle:
        header = handle.readline().strip()
        values = np.fromstring(handle.read(), sep=' ')
    if not values.size or not np.isfinite(values).all():
        raise ValueError(f'Empty/nonfinite data: {path}')
    return header, values


def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def audit(input_dir, output_dir, extraction_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    extraction_dir.mkdir(parents=True, exist_ok=True)
    ph, values = read_dat(input_dir / 'pri.dat')
    if values.size % 56:
        raise ValueError('pri.dat body is not divisible by 56 channels')
    data = values.reshape(-1, 56)  # MATLAB reshape(v,56,[]).' equivalence
    sh, sec = read_dat(input_dir / 'secpath.dat')
    if sec.size != 256 * 8 * 8:
        raise ValueError(f'Expected 256 x 64 secondary-path samples; got {sec.size}')
    secondary = sec.reshape(8, 8, 256)  # [speaker, ear, tap], 1-based labels in manifest
    np.savez_compressed(extraction_dir / 'recordings-original.npz',
                        reference=data[:, :48], primary_ears=data[:, 48:],
                        secondary_speaker_ear_tap=secondary, sample_rate_hz=FS)
    # Periodic Hann, one-second windows, 50% overlap; same normalization as a
    # conventional one-sided Welch estimator, implemented locally with NumPy.
    window = .5 - .5 * np.cos(2 * np.pi * np.arange(FS) / FS)
    transforms = np.stack([np.fft.rfft((data[n:n+FS] - data[n:n+FS].mean(axis=0)) * window[:, None], axis=0)
                           for n in range(0, len(data)-FS+1, FS//2)])
    f = np.fft.rfftfreq(FS, 1/FS)
    scale = np.ones(len(f)) / (FS * np.sum(window ** 2))
    scale[1:-1] *= 2
    psd = np.mean(np.abs(transforms) ** 2, axis=0) * scale[:, None]
    df = f[1] - f[0]
    band = (f >= 20) & (f < 1000)
    channels = []
    for i in range(56):
        ac = data[:, i] - data[:, i].mean()
        peaks = np.where((psd[1:-1, i] > psd[:-2, i]) & (psd[1:-1, i] > psd[2:, i]))[0] + 1
        peaks = sorted((p for p in peaks if 20 <= f[p] < 1000), key=lambda p: psd[p, i], reverse=True)[:6]
        total = float(psd[:, i].sum() * df)
        channels.append(dict(channel=i + 1, kind='reference' if i < 48 else 'primary_ear',
                             mean=float(data[:, i].mean()), rms_ac=float(np.sqrt(np.mean(ac ** 2))),
                             peak_abs=float(np.max(np.abs(data[:, i]))),
                             crest_factor=float(np.max(np.abs(ac)) / max(np.sqrt(np.mean(ac ** 2)), 1e-30)),
                             unique=int(np.unique(data[:, i]).size),
                             strongest_peaks_hz=[float(f[p]) for p in peaks],
                             band_power_fraction=[float(psd[(f >= a) & (f < b), i].sum() * df / max(total, 1e-30)) for a, b in BANDS]))
    # Independent per-reference, per-ear magnitude-squared coherence. Descriptive,
    # not a multichannel causal prediction bound or a controller selection rule.
    scores = np.zeros((48, 8))
    for r in range(48):
        for m in range(8):
            pxy = np.mean(np.conj(transforms[:, :, r]) * transforms[:, :, 48 + m], axis=0) * scale
            coh = np.abs(pxy) ** 2 / np.maximum(psd[:, r] * psd[:, 48 + m], 1e-60)
            scores[r, m] = np.sum(coh[band] * psd[band, 48 + m]) / max(np.sum(psd[band, 48 + m]), 1e-60)
    ranking = np.argsort(-scores.mean(axis=1))
    seat_psd = np.column_stack([psd[:, np.array(ch) - 1].mean(axis=1) for ch in SEATS.values()])
    # Pair powers, never average left/right waveforms (which could phase-cancel).
    np.savez_compressed(output_dir / 'spectral-audit.npz', frequency_hz=f,
                        psd_raw_units=psd, seat_power_psd=seat_psd,
                        reference_ear_coherence_score=scores)
    np.savetxt(output_dir / 'psd.csv', np.column_stack([f, psd]), delimiter=',',
               header='frequency_hz,' + ','.join(f'channel_{i+1}_raw_unit2_per_hz' for i in range(56)), comments='')
    sec_energy = (secondary ** 2).sum(axis=2)
    report = dict(sample_rate_hz=FS, samples=data.shape[0], duration_seconds=data.shape[0] / FS,
                  primary_header=ph, secondary_header=sh,
                  headers_interpretation='opaque vendor header; fs/layout from MATLAB metadata, dimensions cross-checked',
                  reference_channels=list(range(1, 49)), primary_channels=list(range(49, 57)),
                  seat_ear_channels=SEATS, units='V: all DSP channels uncalibrated, confirmed by user; no Pa/SPL conversion',
                  operating_condition=dict(vehicle='BEV', speed_kph=40, road='rough', provenance='user-confirmed'),
                  secondary_shape=list(secondary.shape), secondary_layout='speaker-major, then ear, then 256 taps',
                  secondary_layout_status='user confirmed 8 headrest speakers; no mapping onto the 4 simulated door speakers; do not use for runtime control',
                  source_sha256={name: digest(input_dir / name) for name in ['pri.dat', 'secpath.dat', 'filter_cal_couple.m']},
                  bands_hz=BANDS, channels=channels,
                  reference_ranking=[dict(channel=int(r+1), mean_score=float(scores[r].mean()), by_ear=scores[r].tolist()) for r in ranking],
                  secondary_peak_sample=np.argmax(np.abs(secondary), axis=2).tolist(),
                  secondary_energy=sec_energy.tolist(),
                  method='Full recording, Hann 1s, 50% overlap, per-window mean removal for PSD only; extraction unchanged')
    (output_dir / 'audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(2, 2, figsize=(13, 8), constrained_layout=True)
    for r in range(48):
        p = psd[:, r] / max(psd[band, r].sum() * df, 1e-60)
        axes[0, 0].plot(f, 10 * np.log10(np.maximum(p, 1e-30)), alpha=.4, lw=.6)
    axes[0, 0].set(title='48 references: normalized spectral shape', ylabel='dB / Hz (20-1000 Hz power = 1)', xlim=(0, 1000), ylim=(-85, -5))
    for m, seat in enumerate(SEATS):
        p = seat_psd[:, m] / seat_psd[band, m].sum()
        axes[0, 1].plot(f, 10 * np.log10(np.maximum(p, 1e-30)), label=seat)
    axes[0, 1].set(title='Primary noise: left/right ear power average', ylabel='dB / Hz (20-1000 Hz power = 1)', xlim=(0, 1000), ylim=(-75, -5))
    axes[0, 1].legend()
    image = axes[1, 0].imshow(scores.T, aspect='auto', origin='lower', extent=(.5, 48.5, .5, 8.5), vmin=0, vmax=1)
    axes[1, 0].set(title='20-1000 Hz noise-weighted pairwise coherence', xlabel='Reference channel', ylabel='Ear index (raw channel minus 48)')
    fig.colorbar(image, ax=axes[1, 0])
    for path in secondary.reshape(-1, 256):
        h = np.abs(np.fft.rfft(path, n=4000)) ** 2
        axes[1, 1].plot(f, 10 * np.log10(np.maximum(h / max(h[band].mean(), 1e-30), 1e-30)), alpha=.25, lw=.6)
    axes[1, 1].set(title='64 secondary paths: normalized responses', ylabel='Relative power / dB', xlim=(0, 1000))
    for ax in [axes[0, 0], axes[0, 1], axes[1, 1]]:
        ax.set_xlabel('Frequency / Hz')
        ax.grid(alpha=.25)
    fig.savefig(output_dir / 'recorded-spectra.png', dpi=160)
    plt.close(fig)
    print(json.dumps({k: report[k] for k in ['samples','duration_seconds','secondary_shape','seat_ear_channels']}, ensure_ascii=False))
    print('Top references:', [(int(r+1), round(float(scores[r].mean()), 3)) for r in ranking[:12]])
    print('AC RMS:', [round(c['rms_ac'], 7) for c in channels])
    print('Ear peaks:', [c['strongest_peaks_hz'] for c in channels[48:]])
    print('Ear band power fractions:', np.round([c['band_power_fraction'] for c in channels[48:]], 3))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).parent)
    parser.add_argument('--extraction', type=Path, required=True)
    args = parser.parse_args()
    audit(args.input, args.output, args.extraction)
