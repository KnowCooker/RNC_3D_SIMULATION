"""Run at repository root with fontTools[woff] available. Original TTFs stay in output/.
Official input: google/fonts main, ofl/notosanssc and ofl/notoserifsc; SIL OFL 1.1.
Rebuild when adding UI characters; browser fallback covers characters outside this subset.
"""
from pathlib import Path
import hashlib, json, sys
sys.path.insert(0, str(Path('output/font-tools').resolve()))
from fontTools import subset
from fontTools.ttLib import TTFont

out = Path('src/team-a/lab/assets/fonts')
ui = ''.join(p.read_text(encoding='utf-8') for p in Path('src').rglob('*') if p.suffix in {'.ts','.html','.css'})
ui += ''.join(chr(c) for c in range(32,127))
hero = '让每一段旅程，都更安静以数字孪生洞察声音的本质探索更安静的旅程结构与布置方案对比结论沿声音的来处寻找答案'
manifest = []
for name, family, text, output in [('NotoSansSC','RNC Sans',ui,'rnc-sans.woff2'),('NotoSerifSC','RNC Serif',hero,'rnc-serif.woff2')]:
    source = Path('output/font-source') / (name+'.ttf')
    font = TTFont(source)
    opts = subset.Options()
    opts.name_IDs = ['*']; opts.name_legacy = True; opts.name_languages = ['*']
    sub = subset.Subsetter(options=opts); sub.populate(text=text); sub.subset(font)
    # Rename modified subsets; preserve upstream copyright/license metadata.
    for record in font['name'].names:
        if record.nameID in {1,4,6,16,17}:
            value = 'Regular' if record.nameID == 17 else family.replace(' ','') if record.nameID == 6 else family
            record.string = value.encode(record.getEncoding())
    font.flavor='woff2';font.save(out/output)
    manifest.append({'file':output,'source':f'https://raw.githubusercontent.com/google/fonts/main/ofl/{name.lower()}/{name}%5Bwght%5D.ttf','upstream_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256((out/output).read_bytes()).hexdigest(),'bytes':(out/output).stat().st_size,'glyphs':len(font.getGlyphOrder()),'unicode_count':len(font.getBestCmap()),'family':family,'license':'SIL Open Font License 1.1','tool':'fontTools 4.60.2, brotli 1.2.0'})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,indent=2))
