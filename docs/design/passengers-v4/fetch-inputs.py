"""Fetch public source files through their published links; stop on changed bytes or website challenges."""
import argparse, hashlib, http.cookiejar, json, re, urllib.request, zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[3];work=root/'output/passenger-v4';work.mkdir(parents=True,exist_ok=True)
args=argparse.ArgumentParser();args.add_argument('--fetch',action='store_true');fetch=args.parse_args().fetch
items=json.loads(Path(__file__).with_name('inputs.json').read_text(encoding='utf8'))
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders=[('User-Agent','Mozilla/5.0')]
for item in items:
    file=work/item['file']
    if not file.exists():
        if not fetch:raise SystemExit(f'Missing {file}; pass --fetch or supply the pinned local source.')
        url=item.get('url');headers={}
        if not url:
            page=item['downloadPage'];html=opener.open(page,timeout=40).read().decode('utf8')
            matches=re.findall(r'href=[\"\']([^\"\']*uhash=[^\"\']+)',html)
            if not matches:raise SystemExit('Published download link unavailable. Complete the website flow manually; no challenge bypass.')
            url=matches[0].replace('&amp;','&');headers['Referer']=page
        data=opener.open(urllib.request.Request(url,headers=headers),timeout=60).read()
        if hashlib.sha256(data).hexdigest()!=item['sha256']:raise SystemExit(f'Unexpected source bytes for {item["file"]}; no file installed.')
        file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(data)
    if hashlib.sha256(file.read_bytes()).hexdigest()!=item['sha256']:raise SystemExit(f'Source checksum mismatch: {file}')
    print('VERIFIED',item['file'])
destination=(work/'robin').resolve();destination.mkdir(exist_ok=True)
with zipfile.ZipFile(work/'robin-source.zip') as archive:
    for name in archive.namelist():
        if not (destination/name).resolve().is_relative_to(destination):raise SystemExit('Unsafe archive path')
    archive.extractall(destination)
