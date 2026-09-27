"""Independently reload original text and extracted arrays; no signal processing."""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np

source, extraction = map(Path, sys.argv[1:3])
here = Path(__file__).parent
audit = json.loads((here/'audit.json').read_text('utf-8'))
with (source/'pri.dat').open('r') as f:
    f.readline()
    original = np.loadtxt(f).reshape(-1, 56)
with (source/'secpath.dat').open('r') as f:
    f.readline()
    secondary = np.loadtxt(f).reshape(8, 8, 256)
with np.load(extraction/'recordings-original.npz') as extracted:
    assert np.array_equal(extracted['reference'], original[:, :48])
    assert np.array_equal(extracted['primary_ears'], original[:, 48:])
    assert np.array_equal(extracted['secondary_speaker_ear_tap'], secondary)
    assert int(extracted['sample_rate_hz']) == 4000
hashes = {}
for name, expected in audit['source_sha256'].items():
    with (source/name).open('rb') as f:
        actual = hashlib.file_digest(f, 'sha256').hexdigest()
    assert actual == expected, f'Input changed: {name}'
    hashes[name] = actual
result = dict(extraction_exact=True, input_files_unchanged=True, source_sha256=hashes,
              reference_shape=[160000,48], primary_shape=[160000,8], original_units='V',
              secondary_layout='8 speakers x 8 ears x 256 taps', matlab_executed=False)
(here/'extraction-check.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
