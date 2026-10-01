import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = data => createHash('sha256').update(data).digest('hex');

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
    else throw new Error(`Unsupported package entry: ${path}`);
  }
  return result.sort();
}

function versionAtLeast(current, minimum) {
  const actual = current.split('.').map(Number), required = minimum.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (actual[index] !== required[index]) return actual[index] > required[index];
  }
  return true;
}

/** Verify the exact shipped file set before starting the local HTTP server. */
export async function verifyPackage(directory) {
  const root = resolve(directory);
  const manifest = JSON.parse(await readFile(join(root, 'candidate-manifest.json'), 'utf8'));
  if (!/^[0-9a-f]{40}$/.test(manifest.sourceCommit) || !manifest.contents || typeof manifest.contents !== 'object') throw new Error('Invalid package manifest identity');
  if (!versionAtLeast(process.versions.node, manifest.minimumNodeVersion)) throw new Error(`Node ${manifest.minimumNodeVersion}+ required`);
  const expected = [...Object.keys(manifest.contents), 'candidate-manifest.json'].sort();
  const actual = (await files(root)).map(path => relative(root, path).replaceAll('\\', '/')).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Package file list differs from manifest');
  for (const [path, hash] of Object.entries(manifest.contents)) {
    if (!/^[0-9a-f]{64}$/.test(hash) || sha256(await readFile(join(root, path))) !== hash) throw new Error(`Package hash mismatch: ${path}`);
  }
  const distEntries = Object.entries(manifest.contents).filter(([path]) => path.startsWith('dist/'));
  const distDigest = sha256(Buffer.from(distEntries.map(([path, hash]) => `${path} ${hash}`).join('\n')));
  if (manifest.distFiles !== distEntries.length || manifest.distDigest !== distDigest) throw new Error('Dist digest mismatch');
  return { sourceCommit: manifest.sourceCommit, distDigest, files: expected.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await verifyPackage(process.cwd()))); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
