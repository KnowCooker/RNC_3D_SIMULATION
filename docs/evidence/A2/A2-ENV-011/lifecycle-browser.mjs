import { chromium } from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const output = 'test-results/env011', name = 'lifecycle-final';
await mkdir(output, { recursive: true });
const sourceFiles = ['champagne-gallery.ts', 'gallery-platform.ts', 'scenic-terrain.ts', 'gallery-landscape.ts', 'landscape-height.ts', 'panorama-sky.ts'];
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await readFile(`src/team-a/viewer/${file}`)).digest('hex')])));
const before = await hashes(), browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } }), errors = [], failed = [], responses = [];
page.on('pageerror', error => errors.push({ type: 'pageerror', message: String(error) }));
page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', message: message.text() }); });
page.on('requestfailed', request => failed.push({ url: request.url(), failure: request.failure() }));
page.on('response', response => { if (response.status() >= 400) responses.push({ url: response.url(), status: response.status() }); });
const result = { role: 'A2', executor: 'Codex代A2', task: 'A2-ENV-011', identitySource: 'user-declared', sourceBefore: before, checks: [], errors, failed, responses };
try {
  await page.goto('http://127.0.0.1:5198/docs/evidence/A2/A2-ENV-011/lifecycle.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.fixtureReady === true, null, { timeout: 60000 });
  const run = page.evaluate(() => window.runLifecycle());
  // Attach rejection immediately while waiting for the screenshot handoff.
  let runFailure; const guardedRun = run.catch(error => { runFailure = error; return null; });
  await Promise.race([page.waitForFunction(() => window.lifecyclePreviewReady === true, null, { timeout: 180000 }), run.then(() => {}, error => { throw error; })]);
  await page.screenshot({ path: `${output}/${name}-actual-webgl-snow.png` });
  await page.evaluate(() => { window.lifecycleContinue = true; });
  result.main = await guardedRun; if (runFailure) throw runFailure;
  // This delays real local HTTP resources; it does not synthesize any texture or renderer.
  await page.route('**/src/team-a/viewer/assets/**', async route => { await new Promise(resolve => setTimeout(resolve, 1000)); await route.continue(); });
  result.late = await page.evaluate(() => window.runLateDispose());
  result.sourceAfter = await hashes();
  result.checks = [
    { name: 'zero real browser/GLSL errors', pass: errors.length === 0 },
    { name: 'zero resource request failures', pass: failed.length === 0 && responses.length === 0 },
    { name: 'production source unchanged throughout fixture', pass: JSON.stringify(before) === JSON.stringify(result.sourceAfter) },
  ];
  result.passed = result.checks.every(check => check.pass) && result.main.checks.every(check => check.pass) && result.late.checks.every(check => check.pass);
} catch (error) { result.failure = String(error.stack ?? error); result.passed = false; result.pageState = await page.evaluate(() => ({ ready: window.fixtureReady, html: document.documentElement.outerHTML.slice(0, 2500), resources: performance.getEntriesByType('resource').map(row => ({ name: row.name, duration: row.duration })) })); }
await writeFile(`${output}/${name}-results.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, checks: result.checks, errors, failed, failure: result.failure, mainChecks: result.main?.checks.length, lateChecks: result.late?.checks.length }, null, 2));
await browser.close();
if (!result.passed) process.exitCode = 1;
