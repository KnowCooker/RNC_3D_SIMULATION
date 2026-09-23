import { execFileSync } from 'node:child_process';
execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
console.log('已启用仓库本地 pre-commit：源码边界 + 开发记录。GitHub CI 将重复检查。');
