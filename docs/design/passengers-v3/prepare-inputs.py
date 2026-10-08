"""Validate/extract local, pinned review assets. --fetch obtains missing archives.

Keep third-party originals/derivatives out of Git. This script grants no asset license.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / 'output/passenger-v3'
WORK.mkdir(parents=True, exist_ok=True)
manifest = json.loads(Path(__file__).with_name('inputs.json').read_text(encoding='utf-8'))
exclude = Path(subprocess.check_output(['git', 'rev-parse', '--git-path', 'info/exclude'], cwd=ROOT, text=True).strip())
if not exclude.is_absolute():
    exclude = ROOT / exclude
current = exclude.read_text(encoding='utf-8') if exclude.exists() else ''
if 'public/passengers-local/' not in current.splitlines():
    exclude.parent.mkdir(parents=True, exist_ok=True)
    exclude.write_text(current.rstrip() + '\npublic/passengers-local/\n', encoding='utf-8')

for item in manifest:
    archive = WORK / item['file']
    if not archive.exists() and '--fetch' in sys.argv:
        request = urllib.request.Request(item['url'], headers={'User-Agent': 'RNC-local-asset-review/1.0'})
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError(f"Upstream changed: {item['id']}; inspect before updating pin")
        archive.write_bytes(data)
    if not archive.exists():
        raise FileNotFoundError(f"Prepare {archive} from the recorded source, or use --fetch")
    if hashlib.sha256(archive.read_bytes()).hexdigest() != item['sha256']:
        raise ValueError(f"Input hash mismatch: {item['id']}")
    destination = (WORK / item['id']).resolve()
    with zipfile.ZipFile(archive) as package:
        # Validate every member before any extraction; never escape the asset directory.
        for entry in package.infolist():
            target = (destination / entry.filename).resolve()
            if not target.is_relative_to(destination):
                raise ValueError(f"Unsafe archive path in {item['id']}")
        package.extractall(destination)
    print(f"VALIDATED_AND_PREPARED {item['id']}")
