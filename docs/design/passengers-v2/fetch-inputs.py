"""Verify pinned local review inputs; --fetch retrieves missing files from their original hosts.
Review README.md and original source terms before use. This grants no asset license.
"""
import argparse, hashlib, json, subprocess, urllib.request
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--fetch',action='store_true');args=parser.parse_args()
base=Path(__file__).resolve().parent;root=base.parents[2];work=root/'output/passenger-v2';work.mkdir(parents=True,exist_ok=True)
# Model outputs must stay outside Git on every clone, not just the author machine.
git_path=subprocess.check_output(['git','rev-parse','--git-path','info/exclude'],cwd=root,text=True).strip()
exclude=Path(git_path) if Path(git_path).is_absolute() else root/git_path
old=exclude.read_text(encoding='utf-8') if exclude.exists() else ''
if 'public/passengers-local/' not in old.splitlines():
    exclude.parent.mkdir(parents=True,exist_ok=True);exclude.write_text(old.rstrip()+'\npublic/passengers-local/\n',encoding='utf-8')
for item in json.loads((base/'inputs.json').read_text(encoding='utf-8')):
    path=work/item['file']
    if not path.exists():
        if not args.fetch:raise FileNotFoundError(f'{path.name}: missing; --fetch explicitly downloads local review inputs')
        with urllib.request.urlopen(item['url'],timeout=90) as response:data=response.read()
        if hashlib.sha256(data).hexdigest()!=item['sha256']:raise ValueError(f'{path.name}: download hash mismatch')
        path.write_bytes(data)
    if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise ValueError(f'{path.name}: local hash mismatch; original file retained')
    print('VERIFIED',path.name)
