import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
mkdirSync('docs/evidence/A2/A2-DRIVE-008', { recursive: true });
const result=spawnSync(process.execPath,['test-results/a2-tools/node-v22.14.0-win-x64/node_modules/corepack/dist/pnpm.js','check'],{env:{...process.env,PATH:`${dirname(process.execPath)};${process.env.PATH}`},encoding:'utf8',maxBuffer:20*1024*1024});
writeFileSync('docs/evidence/A2/A2-DRIVE-008/check.log',`${result.stdout}\n${result.stderr}\nExit code: ${result.status}\n`);
console.log(JSON.stringify({exitCode:result.status,error:result.error?.message,testSummary:result.stdout.match(/# tests[\s\S]*?# duration_ms[^\n]+/)?.[0]}));process.exit(result.status??1);
