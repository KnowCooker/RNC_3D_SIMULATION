import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const verifier = fileURLToPath(new URL('../scripts/verify-package.mjs', import.meta.url));
const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

test('offline package verifier accepts the exact build and rejects changed, extra or missing files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rnc-offline-'));
  const tempRoot = resolve(tmpdir());
  assert.ok(resolve(directory).startsWith(`${tempRoot}${sep}`));
  try {
    await mkdir(join(directory, 'dist'), { recursive: true });
    await mkdir(join(directory, 'scripts'), { recursive: true });
    const contents = {
      'dist/index.html': sha256('<main>verified</main>'),
      'scripts/serve.mjs': sha256('export {}'),
      'scripts/verify-package.mjs': sha256(await readFile(verifier)),
    };
    await writeFile(join(directory, 'dist', 'index.html'), '<main>verified</main>');
    await writeFile(join(directory, 'scripts', 'serve.mjs'), 'export {}');
    await writeFile(join(directory, 'scripts', 'verify-package.mjs'), await readFile(verifier));
    const distDigest = sha256(Buffer.from(`dist/index.html ${contents['dist/index.html']}`));
    const manifest = { sourceCommit: 'a'.repeat(40), minimumNodeVersion: '22.12.0', distFiles: 1, distDigest, contents };
    await writeFile(join(directory, 'candidate-manifest.json'), JSON.stringify(manifest));
    const run = () => spawnSync(process.execPath, [verifier], { cwd: directory, encoding: 'utf8' });

    assert.equal(run().status, 0);
    await writeFile(join(directory, 'dist', 'index.html'), '<main>changed</main>');
    assert.match(run().stderr, /Package hash mismatch/);
    await writeFile(join(directory, 'dist', 'index.html'), '<main>verified</main>');
    await writeFile(join(directory, 'dist', 'extra.txt'), 'unexpected');
    assert.match(run().stderr, /file list differs/);
    await rm(join(directory, 'dist', 'extra.txt'));
    await rm(join(directory, 'scripts', 'serve.mjs'));
    assert.match(run().stderr, /file list differs/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
