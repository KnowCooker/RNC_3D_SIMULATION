import fs from 'node:fs';
import crypto from 'node:crypto';
const manifest = JSON.parse(fs.readFileSync('docs/evidence/full-lab/iteration-02/integration/version.json','utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const errors = [];
for (const [file,expected] of Object.entries(manifest.source)) {
  if (sha(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'))!==expected) errors.push(file);
}
for (const [file,expected] of Object.entries(manifest.dist)) {
  if (sha(fs.readFileSync(file))!==expected) errors.push(file);
}
console.log(JSON.stringify({sourceDigest:manifest.sourceDigest,sourceFiles:Object.keys(manifest.source).length,distFiles:Object.keys(manifest.dist).length,changed:errors}));
if (errors.length) process.exitCode=1;
