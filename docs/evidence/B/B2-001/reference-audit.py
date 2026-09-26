"""Read the frozen demo-v2 oracle; print compact source/path evidence to stdout.

Role: B2; Task: B2-001; Identity-Source: user-declared; Executor: Codex.
Run from any directory. Requires NumPy. Never writes into fixtures/reference.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import numpy as np

sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[4]
reference_path = root / "fixtures/reference/reference_mimo.py"
spec = importlib.util.spec_from_file_location("frozen_reference", reference_path)
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)


def channel_summary(signal):
    spectrum = np.abs(np.fft.rfft(signal)) ** 2
    spectrum[1:-1] *= 2
    frequencies = np.fft.rfftfreq(len(signal), 1 / reference.FS)
    return {
        "float32LeSha256": hashlib.sha256(signal.astype("<f4").tobytes()).hexdigest(),
        "rms": float(np.sqrt(np.mean(signal ** 2))),
        "fraction40To350Hz": float(spectrum[(frequencies >= 40) & (frequencies <= 350)].sum() / spectrum.sum()),
    }


cases = []
for seed in (11, 29, 47):
    x, d, primary, secondary = reference.data(seed)
    repeat = reference.data(seed)
    assert all(np.array_equal(a, b) for a, b in zip((x, d, primary, secondary), repeat))
    cases.append({"seed": seed, "x": [channel_summary(s) for s in x], "d": [channel_summary(s) for s in d]})


def sparse_paths(paths):
    return [[[ [int(t), float(path[t])] for t in np.flatnonzero(path)] for path in row] for row in paths]


t = np.arange(65) - 32
shape = (0.35 * np.sinc(0.35 * t) - 0.04 * np.sinc(0.04 * t)) * np.hamming(65)
shape /= np.sqrt(np.sum(shape ** 2) / 3)
response = {str(f): float(abs(np.sum(shape * np.exp(-2j * np.pi * f * np.arange(65) / reference.FS))))
            for f in (0, 20, 40, 100, 200, 350, 500, 1000)}
print(json.dumps({
    "schema": "b2-source-path-audit-v1",
    "role": "B2", "task": "B2-001", "identitySource": "user-declared", "executor": "Codex",
    "codeBaseline": "a300d1631bc502c76ee6dd4f0b16990b071175dd",
    "referenceSha256": hashlib.sha256(reference_path.read_bytes()).hexdigest(),
    "sampleRateHz": reference.FS, "sampleCount": reference.FS * reference.DURATION,
    "spectralMethod": "full 32000-sample rectangular DFT, one-sided power including transients; not the UI Welch PSD",
    "shapeTapCount": len(shape), "shapeSquaredSum": float(np.sum(shape ** 2)),
    "shapeMagnitude": response, "primaryNonzeroTaps": sparse_paths(primary),
    "secondaryNonzeroTaps": sparse_paths(secondary), "cases": cases,
}, ensure_ascii=False, indent=2))
