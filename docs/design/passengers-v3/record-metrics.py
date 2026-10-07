"""Record actual installed GLB sizes/hashes and Blender Z-up pose bounds."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
data = json.loads((ROOT / 'output/passenger-v3/posed-audit.json').read_text())
for item in data:
    name = f"{item['id']}-{'driver' if item['driver'] else 'seated'}.glb"
    raw = (ROOT / 'public/passengers-local' / name).read_bytes()
    assert raw[:4] == b'glTF' and len(raw) == item['bytes'], name
    item['file'] = name
    item['sha256'] = hashlib.sha256(raw).hexdigest()
Path(__file__).with_name('asset-metrics.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
print('MEASURED_INSTALLED_GLB_COUNT', len(data))
