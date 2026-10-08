import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = ['champagne-gallery.ts', 'gallery-platform.ts', 'gallery-landscape.ts', 'landscape-height.ts', 'scenic-terrain.ts', 'scene-stage.ts', 'lab-viewer.ts'];
const maps = await Promise.all((await readdir('dist/assets')).filter(name => name.endsWith('.js.map')).map(async name => JSON.parse(await readFile(`dist/assets/${name}`, 'utf8'))));
const normalize = text => text.replace(/\r\n/g, '\n');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const sources = [];
for (const file of files) {
  const source = await readFile(`src/team-a/viewer/${file}`, 'utf8');
  const matches = maps.flatMap(map => map.sources.flatMap((path, index) => path.endsWith(`/src/team-a/viewer/${file}`) ? [map.sourcesContent[index]] : []));
  sources.push({ file, rawSha256: sha256(source), normalizedSha256: sha256(normalize(source)), builtCopies: matches.length, pass: matches.length > 0 && matches.every(match => normalize(match) === normalize(source)) });
}
const assetPath = 'src/team-a/viewer/assets/qwantani_sunset_8k.jpg';
const asset = await readFile(assetPath);
const result = { role: 'A2', task: 'A2-ENV-011', sources, asset: { path: assetPath, bytes: asset.length, sha256: sha256(asset), expectedSha256: '6a84e7a3e4a93dc4afaca022f3d8b4aeffb478a6611191e92d679370424878f2' } };
await writeFile('docs/evidence/A2/A2-ENV-011/build-manifest.json', JSON.stringify(result, null, 2) + '\n');
if (sources.some(source => !source.pass) || result.asset.sha256 !== result.asset.expectedSha256) throw Error('Built source or original asset mismatch');
console.log(`Verified ${sources.length} built sources and original panorama SHA-256`);
