import { readFile, writeFile, readdir, mkdir, cp, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, join } from 'node:path';

const root = process.cwd();
const expectedDigest = 'c2e43d7994ac8941ca7f820546010e1d28a23dc3d2590d5cd90fecb9ca7f90f1';
const versionPath = 'docs/evidence/full-lab/iteration-02/integration/version.json';
const frozen = JSON.parse(await readFile(resolve(root, versionPath), 'utf8'));
if (frozen.sourceDigest !== expectedDigest) throw new Error('Unexpected frozen source digest');
const sha256 = data => createHash('sha256').update(data).digest('hex');
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    result.push(...entry.isDirectory() ? await files(path) : [path]);
  }
  return result.sort();
}
const actualFiles = (await files(resolve(root, 'dist'))).map(path => relative(root, path).replaceAll('\\', '/'));
if (JSON.stringify(actualFiles) !== JSON.stringify(Object.keys(frozen.dist).sort())) throw new Error('Frozen dist file list differs');
for (const [path, hash] of Object.entries(frozen.dist)) {
  if (sha256(await readFile(resolve(root, path))) !== hash) throw new Error(`Frozen dist mismatch: ${path}`);
}
const destination = resolve(root, 'release/lab-v3-c2e43d7994ac');
try { await stat(destination); throw new Error('Refusing to overwrite an existing candidate'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(resolve(destination, 'scripts'), { recursive: true });
await cp(resolve(root, 'dist'), resolve(destination, 'dist'), { recursive: true, errorOnExist: true, force: false });
await cp(resolve(root, 'scripts/serve.mjs'), resolve(destination, 'scripts/serve.mjs'));
await cp(resolve(root, '启动演示.cmd'), resolve(destination, '启动演示.cmd'));
await cp(resolve(root, versionPath), resolve(destination, 'frozen-version.json'));
await writeFile(resolve(destination, '使用说明.md'), `# RNC lab-v3 本机离线候选包\n\n本包是完整目标的开发候选版本，不是最终验收交付。它包含四类 SUV、结构/剖面、参考改制、参数化 MIMO FxLMS、真实空间采样、16 秒预计算回放及有状态持续仿真。数据为教学合成模型，不是实车预测。最终视觉精细度、指定核显、实物听感/同步及第二台 Windows 真实断网验收仍需单独完成。\n\n## 启动\n\n1. 预装 Node.js 22.12.0 或更高版本；本包不内置 Node 或安装器。启动时不需 npm/pnpm 安装依赖。\n2. 完整解压保留 dist 和 scripts 目录，双击“启动演示.cmd”。\n3. 用支持 WebGL/Web Audio 的现代 Chromium 浏览器打开 http://127.0.0.1:4173/ 。不要直接双击 dist/index.html。\n4. 关闭时在服务器窗口按 Ctrl+C。页面的音频首次播放需点击按钮授权。\n\n若端口占用，可在 PowerShell 进入解压目录，执行：\n\n\`\`\`powershell\n$env:PORT = '5182'\nnode scripts/serve.mjs\n\`\`\`\n\n页面初始运行 16 秒预计算实验。改工况后点击“计算当前实验”；连续模式选择“实时连续仿真”，点击“启动 / 重启实时实验”。暂停保留学习状态，参数改变或重新开始会新建实验；连续模式不支持回放定位。四座位原噪声/残余声共用安全增益，物理数据不受试听衰减改变。\n\n## 版本和范围\n\n冻结 sourceDigest：\`${expectedDigest}\`。冻结前基线为 79df17b；此包包含该基线后的未提交冻结源码，不将基线 SHA 冒充最终源码提交。\n\n\`frozen-version.json\` 保存原始源码文件哈希和全部 dist 哈希，\`candidate-manifest.json\` 保存本包内容哈希。包只复制已构建 dist，未重新构建。无运行时 CDN/在线模型/AI API 依赖；仍须有本机 Node 静态服务器和浏览器。\n\n同机浏览器网络隔离验证与真实断网、第二台 Windows 验收不同；此候选身份不因本机验证通过而改变。后续证据可在仓库 docs/evidence/full-lab/iteration-02/offline/ 查看。\n`, 'utf8');
const contents = {};
for (const path of await files(destination)) contents[relative(destination, path).replaceAll('\\', '/')] = sha256(await readFile(path));
const manifest = {
  candidate: 'lab-v3-c2e43d7994ac', finalDelivery: false, packagedAt: new Date().toISOString(),
  sourceDigest: expectedDigest, frozenVersion: versionPath, baselineCommit: frozen.base,
  sourceCommit: null, sourceCommitNote: 'Frozen working tree digest identifies this candidate; baseline commit is not its completed source commit.',
  minimumNodeVersion: '22.12.0', bundledNode: false, buildPerformed: false,
  contents, distVerifiedAgainstFrozenVersion: true,
};
await writeFile(resolve(destination, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ candidateDirectory: destination, sourceDigest: expectedDigest, distFiles: actualFiles.length, packageFiles: Object.keys(contents).length + 1, manifestSha256: sha256(await readFile(resolve(destination, 'candidate-manifest.json'))) }, null, 2));
