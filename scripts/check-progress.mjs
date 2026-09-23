import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
let diffArgs;
if (baseIndex >= 0) {
  let base = args[baseIndex + 1];
  if (!/^[a-f0-9]{40}$/i.test(base ?? '')) throw new Error('--base 需要完整的 Git SHA');
  if (/^0+$/.test(base)) base = execFileSync('git', ['hash-object', '-t', 'tree', '--stdin'], { input: '', encoding: 'utf8' }).trim();
  diffArgs = [base, 'HEAD'];
} else diffArgs = ['--cached'];
const changed = git('diff', ...diffArgs, '--name-only', '-z', '--diff-filter=ACDMRT').split('\0').filter(Boolean);
const needsLog = changed.some(file => /^(src\/|tests\/|scripts\/|fixtures\/|\.github\/|\.githooks\/)|\.(?:json|ya?ml|html|css|ts|mjs)$/.test(file));
if (!needsLog) console.log('没有需要登记的代码/配置变更。');
else {
  if (!changed.includes('开发记录.md')) {
    console.error('拒绝提交：代码/测试/配置变更必须同时更新并暂存 开发记录.md。请登记改动、验证、下一步和跨组影响。');
    process.exit(1);
  }
  const record = git('show', baseIndex >= 0 ? 'HEAD:开发记录.md' : ':开发记录.md');
  for (const field of ['当前状态', '验证', '下一步', '跨组影响']) {
    if (!record.includes(field)) throw new Error(`开发记录.md 缺少字段：${field}`);
  }
  console.log('开发记录检查通过；真实性与完整性仍需评审。');
}
