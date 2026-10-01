"""Verify the repository's immutable approved design snapshot and local document links."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
from urllib.parse import unquote
root=Path(__file__).resolve().parents[4]
design=root/'docs/design/champagne-final'
sha=lambda data:hashlib.sha256(data).hexdigest()
manifest=json.loads((design/'MANIFEST.json').read_text(encoding='utf-8'))
files=manifest['files']
errors=[]
for item in files:
    path=design/item['path']
    if not path.is_file() or sha(path.read_bytes())!=item['sha256']:
        errors.append('File/hash mismatch: '+item['path'])
approved=design/'screens/01-overview-approved.png'
if sha(approved.read_bytes())!=manifest['approvedHomepageSHA256']:
    errors.append('Approved homepage mismatch')
docs=[root/p for p in [
'README.md','docs/coordination/README.md','docs/coordination/A1.md',
'docs/coordination/A_FINAL_DELIVERY.md','docs/plan/10_FULL_GOAL.md',
'docs/plan/11_PRODUCT_FORM_REFERENCE.md','docs/plan/12_CHAMPAGNE_IMPLEMENTATION.md',
'docs/design/FINAL_PRESENTATION.md']]
links=0
for path in docs:
    content=path.read_text(encoding='utf-8-sig')
    for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',content):
        target=target.strip().strip('<>')
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:',target) or target.startswith('#'):continue
        target=unquote(target.split('#')[0])
        if not target:continue
        links+=1
        if not (path.parent/target).exists():errors.append('Missing link '+str(path.relative_to(root))+': '+target)
if '--index' in sys.argv:
    for item in files:
        rel=(design/item['path']).relative_to(root).as_posix()
        result=subprocess.run(['git','show',':'+rel],cwd=root,capture_output=True)
        if result.returncode or sha(result.stdout)!=item['sha256']:errors.append('Git index byte mismatch: '+rel)
result={'task':'A1-FULL-019','designVersion':'E-FINAL-1.0','snapshotFiles':len(files),'localLinksChecked':links,'approvedHomepageSHA256':sha(approved.read_bytes()),'indexChecked':'--index' in sys.argv,'errors':errors}
print(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(bool(errors))
