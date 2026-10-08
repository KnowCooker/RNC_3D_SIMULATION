"""Prepare local third-party review inputs. No source meshes are redistributed."""
from pathlib import Path
import zipfile, json

root = Path(__file__).resolve().parents[3]
work = root / 'output/passenger-v2'
def unzip(archive, destination, encoding=None):
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            name = item.filename
            if encoding and not item.flag_bits & 0x800:
                name = name.encode('cp437').decode(encoding)
            target = (destination / name).resolve()
            if destination.resolve() not in target.parents:
                raise ValueError('Archive path leaves destination')
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(item))

unzip(work / 'ayaka-official.zip', work / 'ayaka-source', 'gb18030')
unzip(work / 'mmd-tools.zip', work / 'addons/mmd_tools')
for wheel in (work / 'addons/mmd_tools/wheels').glob('*.whl'):
    unzip(wheel, work / 'addons/deps')
print('Prepared local model and MMD importer; source license retained.')
