"""B1-001: call the immutable demo-v2 Python oracle, never rewrite it.

Role: B1; Identity-Source: local-config; Executor: Codex; 2026-09-30.
Requires NumPy. --out must be a NEW directory outside fixtures/reference.
The stored arrays are Float32 LE, signal/channel/sample order, gzip mtime=0.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import subprocess
import sys

import numpy as np

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
FROZEN = ROOT / "fixtures/reference"
KINDS = ("x", "u", "d", "a", "e")
CASES = (("default", 11, 64, .08), ("seed29", 29, 64, .08),
         ("seed47", 47, 64, .08), ("taps32", 11, 32, .08), ("mu0", 11, 64, 0))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def frozen_hashes():
    return {p.relative_to(ROOT).as_posix(): sha(p.read_bytes())
            for p in sorted(FROZEN.rglob("*")) if p.is_file() and "__pycache__" not in p.parts}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    out = parser.parse_args().out.resolve()
    if out == FROZEN or FROZEN in out.parents or out.exists():
        parser.error("Output must be a new directory outside frozen fixtures; no overwrite allowed")
    before = frozen_hashes()
    spec = importlib.util.spec_from_file_location("frozen_reference", FROZEN / "reference_mimo.py")
    reference = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    out.mkdir(parents=True)
    manifest = {
        "schema": "b1-numeric-oracle-v1", "role": "B1", "task": "B1-001",
        "identitySource": "local-config", "executor": "Codex", "date": "2026-09-30",
        "codeBaseline": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "python": platform.python_version(), "numpy": np.__version__,
        "referenceSha256": before["fixtures/reference/reference_mimo.py"],
        "format": "gzip of IEEE754 Float32 little-endian; signal, channel, sample",
        "signals": KINDS, "channels": ["fl", "fr", "rl", "rr"], "sampleCount": 32000,
        "thresholds": {"relativeRms": 1e-3, "nearZeroRms": 1e-12, "nearZeroMaxAbs": 1e-6, "metricDb": .2},
        "cases": [],
    }
    for name, seed, taps, mu in CASES:
        report, arrays = reference.simulate(seed=seed, taps=taps, mu=mu)
        _, repeat = reference.simulate(seed=seed, taps=taps, mu=mu)
        assert all(np.array_equal(arrays[k], repeat[k]) for k in (*KINDS, "primary", "secondary"))
        packed = np.stack([arrays[k] for k in KINDS]).astype("<f4")
        assert packed.shape == (5, 4, 32000) and np.isfinite(packed).all()
        raw = packed.tobytes(order="C")
        compressed = gzip.compress(raw, mtime=0)
        filename = name + ".f32.gz"
        (out / filename).write_bytes(compressed)
        manifest["cases"].append({
            "name": name, "seed": seed, "taps": taps, "stepSize": mu, "file": filename,
            "rawBytes": len(raw), "rawSha256": sha(raw), "gzipSha256": sha(compressed),
            "pythonFloat64RepeatExact": True,
            "report": {k: v for k, v in report.items() if k != "referencePythonComputeSeconds"},
            "pythonComputeSeconds": report["referencePythonComputeSeconds"],
        })
        print(f"{name}: 640000 finite samples; Python Float64 repeat exact", flush=True)
    after = frozen_hashes()
    assert before == after, "Frozen reference files changed"
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "fixture-integrity.json").write_text(json.dumps({"before": before, "after": after, "unchanged": True}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
