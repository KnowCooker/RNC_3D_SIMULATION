import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve('.');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const candidate = `rnc-lab-${sourceCommit.slice(0, 12)}`;
const destination = resolve(root, 'release', candidate);

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

try { await stat(destination); throw new Error(`Refusing to overwrite ${destination}`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await stat(resolve(root, 'dist', 'index.html'));
await mkdir(join(destination, 'scripts'), { recursive: true });
await cp(resolve(root, 'dist'), join(destination, 'dist'), { recursive: true, force: false, errorOnExist: true });
await cp(resolve(root, 'scripts', 'serve.mjs'), join(destination, 'scripts', 'serve.mjs'));
await cp(resolve(root, '启动演示.cmd'), join(destination, '启动演示.cmd'));
await writeFile(join(destination, '使用说明.md'), `# RNC 离线候选包\n\n运行源码提交：\`${sourceCommit}\`。本包是开发候选，不是完整目标最终交付或第二台 Windows 真实断网验收。车辆、路噪与控制均为教学模型，非实车标定。\n\n1. 在 Windows 上预装 Node.js 22.12.0 或更新版本，并准备支持 WebGL 和 Web Audio 的现代 Chromium 浏览器。本包无需运行时安装依赖。\n2. 完整解压，双击“启动演示.cmd”，打开 http://127.0.0.1:4173/ 。不要直接打开 dist/index.html。\n3. 页面提供四类 SUV、结构/剖面、RNC 改制与参数、预计算及持续运行、空间声场和四座位试听。首次播放声音需要点击按钮授权；关闭时在服务窗口按 Ctrl+C。\n4. 如果 4173 端口被占用，在解压目录运行 PowerShell：\`$env:PORT='5188'; node scripts/serve.mjs\`，然后打开 http://127.0.0.1:5188/ 。\n\n改工况/参数后重新计算；实时模式暂停保留当前学习状态，重启/调参/改制建立新实验。控制收益可能为负，不应解释为每个位置必然降噪。图上 d/e 为耳旁压力，q/x/u 是其它物理信号。此包只含运行产物及启动服务；源码、依据、测试和证据在对应仓库提交。\n`, 'utf8');

const contents = {};
for (const path of await files(destination)) {
  contents[relative(destination, path).replaceAll('\\', '/')] = sha256(await readFile(path));
}
const distEntries = Object.entries(contents).filter(([path]) => path.startsWith('dist/'));
const manifest = {
  candidate, finalDelivery: false, sourceCommit,
  packagedAt: new Date().toISOString(),
  nodeVersionAtPackaging: process.version,
  minimumNodeVersion: '22.12.0', bundledNode: false,
  buildProvenance: 'Run pnpm check at sourceCommit immediately before packaging; package copies dist without rebuilding.',
  distDigest: sha256(Buffer.from(distEntries.map(([path, hash]) => `${path} ${hash}`).join('\n'))),
  distFiles: distEntries.length,
  contents,
};
const manifestPath = join(destination, 'candidate-manifest.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ destination, sourceCommit, distDigest: manifest.distDigest,
  distFiles: manifest.distFiles, packageFiles: Object.keys(contents).length + 1,
  manifestSha256: sha256(await readFile(manifestPath)) }, null, 2));
