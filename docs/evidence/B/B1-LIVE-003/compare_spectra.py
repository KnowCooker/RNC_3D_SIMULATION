"""Independent NumPy PSD audit: measured primary noise versus actual TS output."""
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = Path(__file__).parent
ROOT = HERE.parents[3]
BANDS = [(1,20),(20,50),(50,100),(100,200),(200,350),(350,600),(600,900)]


def psd(signals, fs):
    window = .5 - .5*np.cos(2*np.pi*np.arange(fs)/fs)
    pieces = []
    for start in range(fs, len(signals)-fs, fs//2):
        values = signals[start:start+fs]
        transform = np.fft.rfft((values-values.mean(axis=0))*window[:,None], axis=0)
        p = abs(transform)**2/(fs*np.sum(window**2)); p[1:-1] *= 2
        pieces.append(p)
    return np.mean(pieces, axis=0)


def fractions(spectrum):
    denominator = spectrum[1:900].sum(axis=0)
    return np.array([spectrum[low:high].sum(axis=0)/denominator for low,high in BANDS])


def audit():
    with np.load(ROOT.parent/'实测数据分析/recordings-original.npz') as data:
        measured = psd(data['primary_ears'][:,[0,4,2,6]],4000)[:1001]
    recorded = psd(np.fromfile(HERE/'recorded-primary.f32',dtype='<f4').reshape(4,-1).T,2000)
    synthetic = psd(np.fromfile(HERE/'synthetic-primary.f32',dtype='<f4').reshape(4,-1).T,2000)
    target, new, old = map(fractions,[measured,recorded,synthetic])
    error_new = abs(10*np.log10(new/target)); error_old = abs(10*np.log10(old/target))
    pooled = {name: fractions(values.mean(axis=1)) for name,values in [('measured',measured),('recorded',recorded),('synthetic',synthetic)]}
    report = {'method':'1s Hann Welch, 50% overlap; ignore first/last second, per-window mean removal; 1-900Hz normalized band powers',
        'channels':[49,53,51,55], 'bandsHz':BANDS, 'targetFractionsBySeat':target.tolist(),
        'recordedFractionsBySeat':new.tolist(), 'syntheticFractionsBySeat':old.tolist(),
        'recordedMeanAbsoluteBandErrorDbBySeat':error_new.mean(axis=0).tolist(),
        'syntheticMeanAbsoluteBandErrorDbBySeat':error_old.mean(axis=0).tolist(),
        'pooledFractions':{key:val.tolist() for key,val in pooled.items()},
        'recordedPooledMeanAbsoluteBandErrorDb':float(abs(10*np.log10(pooled['recorded']/pooled['measured'])).mean()),
        'syntheticPooledMeanAbsoluteBandErrorDb':float(abs(10*np.log10(pooled['synthetic']/pooled['measured'])).mean()),
        'limitation':'Spectral comparison of teaching synthesis; not reconstructed original phase, measured paths, calibrated SPL, or real ANC performance.'}
    (HERE/'spectral-comparison.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    fig, axes = plt.subplots(2,2,figsize=(11,6.5),constrained_layout=True)
    for ch,(axis,seat) in enumerate(zip(axes.flat,['FL','FR','RL','RR'])):
        for label,power,color in [('Measured primary noise',measured,'#526175'),('Recorded sources + spatial H',recorded,'#168570'),('Previous shaped random source',synthetic,'#c27b39')]:
            smooth = np.convolve(power[:,ch],np.ones(5)/5,mode='same')
            axis.plot(np.arange(1001),10*np.log10(np.maximum(smooth/smooth[1:900].sum(),1e-15)),label=label,color=color,lw=1.15)
        axis.set(xlim=(10,800),ylim=(-65,-5),title=seat,xlabel='Frequency (Hz)',ylabel='Normalized PSD (dB/Hz)')
        axis.grid(alpha=.2)
    axes[0,0].legend(fontsize=8)
    fig.suptitle('Four recorded primary-noise tracks as equivalent wheel sources\nMatched single-ear targets; common recording gain, no extra cabin-noise coloration')
    fig.savefig(HERE/'spectral-comparison.png',dpi=160)
    plt.close(fig)
    print(json.dumps({k:v for k,v in report.items() if 'Error' in k},indent=2))


if __name__ == '__main__': audit()
