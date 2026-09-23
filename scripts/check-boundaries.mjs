import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import ts from 'typescript';

const root = resolve('src');
const errors = [];
function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) { scan(file); continue; }
    if (!file.endsWith('.ts')) continue;
    const local = relative(root, file).replaceAll('\\', '/');
    const owner = local.split('/')[0];
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      let specifier;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
      if (specifier) {
        const target = specifier.startsWith('.') ? relative(root, resolve(dirname(file), specifier)).replaceAll('\\', '/').split('/')[0] : specifier;
        const forbidden = owner === 'team-a' ? ['team-b', 'integration'] : owner === 'team-b' ? ['team-a', 'integration', 'three', 'three/addons'] : owner === 'shared' ? ['team-a', 'team-b', 'integration'] : [];
        if (forbidden.some(name => target === name || target.startsWith(`${name}/`))) errors.push(`${local}: 禁止从 ${owner} 导入 ${specifier}`);
      }
      if (owner === 'team-b' && ts.isPropertyAccessExpression(node) && ['document', 'window'].includes(node.expression.getText(source))) errors.push(`${local}: B 组禁止依赖 DOM 对象 ${node.expression.getText(source)}`);
      if (owner === 'team-b' && ts.isNewExpression(node) && ['AudioContext', 'WebGLRenderer'].includes(node.expression.getText(source))) errors.push(`${local}: B 组禁止创建展示对象 ${node.expression.getText(source)}`);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
scan(root);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('源码边界通过：A/B 互不导入；shared 独立；integration 负责装配。');
