"""Synthetic 4 reference / 4 output / 4 error FxLMS feasibility reference.
Not a measured vehicle model and not a product performance benchmark.
Only numpy is required. Run: python reference_mimo.py --out OUTPUT_DIR
"""
from pathlib import Path
import argparse, json, time, wave
import numpy as np

FS = 2000
DURATION = 16

def uniform(seed, count):
    s = int(seed) & 0xffffffff
    values = np.empty(count, dtype=np.float64)
    for i in range(count):
        s ^= (s << 13) & 0xffffffff
        s ^= s >> 17
        s ^= (s << 5) & 0xffffffff
        s &= 0xffffffff
        values[i] = (s + .5) / 4294967296
    return values * 2 - 1

def data(seed):
    n = FS * DURATION
    t = np.arange(65) - 32
    shape = (2*350/FS*np.sinc(2*350/FS*t) -
             2*40/FS*np.sinc(2*40/FS*t))*np.hamming(65)
    shape /= np.sqrt(np.sum(shape*shape)/3)
    x = np.array([np.convolve(uniform(seed+101*k, n), shape)[:n] for k in range(4)])
    primary = np.zeros((4, 4, 24))
    secondary = np.zeros((4, 4, 16))
    for m in range(4):
        for k in range(4):
            delay = 12 if m == k else 14+(m+k)%3
            primary[m, k, delay] = .032 if m == k else .006
            primary[m, k, delay+2] = .007 if m == k else .002
        for l in range(4):
            delay = 4 if m == l else 5+(m+l)%3
            secondary[m, l, delay] = .12 if m == l else .012
            secondary[m, l, delay+2] = .018 if m == l else .004
    d = np.zeros((4, n))
    for m in range(4):
        for k in range(4):
            d[m] += np.convolve(x[k], primary[m,k])[:n]
        d[m] += .001*np.sqrt(3)*uniform(seed+5001+101*m,n)
    return x, d, primary, secondary

def simulate(seed=11, taps=64, mu=.08, duration=DURATION, diagonal_update=False):
    x,d,p,s = data(seed)
    n = int(duration*FS)
    x,d = x[:,:n],d[:,:n]
    shat = s.copy()
    if diagonal_update:
        for m in range(4):
            for l in range(4):
                if m != l: shat[m,l] = 0
    filtered = np.zeros((4,4,4,n+taps-1))
    for m in range(4):
        for l in range(4):
            for k in range(4):
                filtered[m,l,k,taps-1:] = np.convolve(x[k],shat[m,l])[:n]
    # windows are past-to-current; reverse the tap axis to use newest first.
    xp = np.pad(x, ((0,0),(taps-1,0)))
    xwindows = np.lib.stride_tricks.sliding_window_view(xp,taps,axis=-1)
    fw = np.lib.stride_tricks.sliding_window_view(filtered,taps,axis=-1)
    weights = np.zeros((4,4,taps))
    uh = np.zeros((4,16)); u=np.zeros((4,n)); anti=np.zeros_like(u); e=np.zeros_like(u)
    begin = time.perf_counter()
    for i in range(n):
        u[:,i] = np.einsum('lkt,kt->l',weights,xwindows[:,i,::-1])
        uh[:,1:] = uh[:,:-1].copy(); uh[:,0] = u[:,i]
        anti[:,i] = np.einsum('mlt,lt->m',s,uh)
        e[:,i] = d[:,i] + anti[:,i]
        if i >= 2*FS:
            weights -= mu/4*np.einsum('m,mlkt->lkt',e[:,i],fw[:,:,:,i,::-1])
        if not np.isfinite(e[:,i]).all() or np.max(np.abs(u[:,i])) > 10:
            raise RuntimeError('Numeric failure or output out of reference bounds')
    seconds=time.perf_counter()-begin
    win=slice(-4*FS,None)
    pd=np.mean(d[:,win]**2,axis=1); pe=np.mean(e[:,win]**2,axis=1)
    reduction=10*np.log10(pd/pe)
    report={'seed':seed,'taps':taps,'mu':mu,'sampleRateHz':FS,'durationSeconds':duration,
        'adaptationStartsSeconds':2,'measurementWindowSeconds':[duration-4,duration],
        'measurement':'unweighted full sampled band RMS for this band-shaped fixture',
        'reductionDbByMic':reduction.tolist(),'aggregateReductionDb':float(10*np.log10(pd.mean()/pe.mean())),
        'maxAbsControlDrive':float(np.abs(u).max()),'maxAbsPressurePa':float(max(np.abs(d).max(),np.abs(e).max())),
        'superpositionMaxAbsErrorPa':float(np.abs(e-d-anti).max()),
        'referencePythonComputeSeconds':seconds,'secondaryNonzeroCrossPaths':12,
        'limitations':['Synthetic controllable FIR paths, not measured vehicle acoustics',
                      'Python elapsed time does not benchmark browser rendering or JavaScript',
                      'Controller has 16 filters; all 16 secondary paths are included']}
    return report,dict(x=x,d=d,u=u,a=anti,e=e,primary=p,secondary=s)

def write_wav(path, signal, gain):
    up=8
    dense=np.zeros(len(signal)*up);dense[::up]=signal
    t=np.arange(129)-64
    kernel=(2*700/(FS*up))*np.sinc(2*700/(FS*up)*t)*np.hamming(129)
    kernel*=up/kernel.sum()
    y=np.convolve(dense,kernel,mode='same')*gain
    if np.abs(y).max()>=.98: raise ValueError('Playback would clip')
    pcm=(y*32767).astype('<i2')
    with wave.open(str(path),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(FS*up);f.writeframes(pcm.tobytes())

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',required=True)
    args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    reports=[]; baseline=None
    for seed,taps,mu in [(11,64,.08),(29,64,.08),(47,64,.08),(11,32,.08),(11,64,0)]:
        report,arrays=simulate(seed,taps,mu)
        if mu:
            assert report['aggregateReductionDb']>=3
            assert min(report['reductionDbByMic'])>=0
        else:
            assert np.array_equal(arrays['d'],arrays['e'])
        assert report['superpositionMaxAbsErrorPa']<1e-12
        reports.append(report)
        print(json.dumps(report,ensure_ascii=False),flush=True)
        if seed==11 and taps==64 and mu==.08: baseline=arrays
    # A repeat run checks determinism, excluding elapsed-time metadata.
    _,repeat=simulate(11,64,.08)
    assert np.array_equal(baseline['e'],repeat['e'])
    np.savez_compressed(out/'golden_4x4x4.npz',**baseline)
    gain=2.0 # same fixed Pa-to-full-scale conversion for both files; never normalize separately
    write_wav(out/'driver_primary.wav',baseline['d'][0],gain)
    write_wav(out/'driver_residual.wav',baseline['e'][0],gain)
    with (out/'verification.json').open('w',encoding='utf-8') as f:
        json.dump({'cases':reports,'deterministicRepeatPassed':True,
                   'wavFullScalePerPa':gain,'wavOutputSampleRateHz':16000,
                   'audioDescription':'One synthetic driver microphone, mono, same gain; controller learning starts at 2s'},f,ensure_ascii=False,indent=2)
    np.savetxt(out/'initial_256_samples.csv',np.column_stack([np.arange(256)/FS]+[
        baseline[key][c,:256] for key in ['x','d','u','a','e'] for c in range(4)]),
        delimiter=',',header='time_s,'+','.join(f'{k}_{i}' for k in ['x','d','u','a','e'] for i in range(4)),comments='')

if __name__=='__main__':main()
