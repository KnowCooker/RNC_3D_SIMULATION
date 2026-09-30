/** Test-only module loading for controlled inputs/faults; never edits runtime files.
 * Transpiles the actual checked-out TypeScript, with an explicit import allowlist.
 * No production injection API or changes to frozen source/path fixtures are needed.
 */
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';
import * as contracts from '../../src/shared/contracts';
import * as defaults from '../../src/shared/defaults';
import * as data from '../../src/team-b/engine/data';
import * as analysis from '../../src/team-b/analysis';
import type * as Core from '../../src/team-b/engine/core';

export type Data = ReturnType<typeof data.createData>;
export type Edit = (source: string) => string;
export function replaceOnce(source: string, before: string, after: string) {
  if (source.split(before).length !== 2) throw new Error(`Fault injection target is not unique: ${before}`);
  return source.replace(before, after);
}
function evaluate<T>(source: string, imports: Record<string, unknown>, testPaths?: () => ReturnType<typeof data.createPaths>): T {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  const factory = runInThisContext(`(function(require, module, exports, __testPaths) {\n${compiled}\n})`, { filename: 'engine-test-harness.cjs' });
  factory((name: string) => {
    if (!Object.hasOwn(imports, name)) throw new Error(`Unexpected runtime dependency: ${name}`);
    return imports[name];
  }, module, module.exports, testPaths);
  return module.exports as T;
}
export function loadCore(createData: typeof data.createData = data.createData, edit: Edit = source => source) {
  return evaluate<typeof Core>(edit(readFileSync(new URL('../../src/team-b/engine/core.ts', import.meta.url), 'utf8')), {
    '../../shared/contracts': contracts, '../../shared/defaults': defaults,
    './data': { ...data, createData }, '../analysis': analysis,
  });
}
export function loadData(paths: () => ReturnType<typeof data.createPaths>, edit: Edit = source => source) {
  const source = replaceOnce(readFileSync(new URL('../../src/team-b/engine/data.ts', import.meta.url), 'utf8'),
    'const { primary, secondary } = createPaths();', 'const { primary, secondary } = __testPaths();');
  return evaluate<typeof data>(edit(source), {}, paths);
}
