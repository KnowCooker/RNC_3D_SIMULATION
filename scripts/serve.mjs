import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, relative, isAbsolute } from 'node:path';

const root = resolve('dist'), port = Number(process.env.PORT ?? 4173);
try { await stat(resolve(root, 'index.html')); } catch { throw new Error('缺少 dist/index.html，请先执行 pnpm build，或使用包含 dist 的演示包。'); }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const rel = relative(root, file);
    if (rel.startsWith('..') || isAbsolute(rel)) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`RNC 演示：http://127.0.0.1:${port} · Ctrl+C 退出`));
