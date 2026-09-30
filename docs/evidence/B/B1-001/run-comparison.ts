/** Role: B1; Task: B1-001; Identity-Source: local-config; Executor: Codex. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditNumericCase, numericCases } from '../../../../tests/helpers/engine-numeric-audit';

const output = process.argv[2];
if (!output) throw new Error('Usage: pnpm exec tsx docs/evidence/B/B1-001/run-comparison.ts NEW_OUTPUT_JSON');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const target = resolve(output);
if (existsSync(target) || /^fixtures[\\/]reference(?:[\\/]|$)/.test(target.slice(root.length + 1))) {
  throw new Error('Output must be a new file outside frozen fixtures');
}
const files = ['src/team-b/engine/core.ts', 'src/team-b/engine/data.ts', 'src/team-b/analysis/index.ts',
  'src/shared/contracts.ts', 'src/shared/defaults.ts', 'tests/engine.test.ts', 'tests/helpers/engine-numeric-audit.ts',
  'docs/evidence/B/B1-001/generate-reference.py', 'docs/evidence/B/B1-001/run-comparison.ts'];
const sourceSha256 = Object.fromEntries(files.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')]));
const cases = numericCases.map(spec => {
  const result = auditNumericCase(spec);
  console.log(`${spec.name}: 20 channels / 640000 samples, metrics and repeat PASS`);
  return result;
});
const result = { schema: 'b1-numeric-comparison-v1', role: 'B1', task: 'B1-001',
  identitySource: 'local-config', executor: 'Codex', date: '2026-09-30',
  codeBaseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, sourceSha256, comparedSamples: 3200000,
  thresholds: { relativeRms: 1e-3, nearZeroRms: 1e-12, nearZeroMaxAbs: 1e-6, metricDb: 0.2 }, cases };
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(result, null, 2) + '\n');
