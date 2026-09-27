// Run with Node >=22 and an independently installed playwright-core module:
// node browser-check.mjs <absolute playwright-core/index.mjs> [preview URL]
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const baseURL = process.argv[3] ?? 'http://127.0.0.1:5184/';
const output = new URL('./browser/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(15000);
const result = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceChanges: execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }).trim(),
  browser: browser.version(), baseURL, date: new Date().toISOString(), headless: true,
  checks: [], errors: [], failedRequests: [], externalRequests: [], assets: [], assetRequests: [] };
page.on('pageerror', e => result.errors.push(e.message));
page.on('requestfailed', r => result.failedRequests.push({ url: r.url(), failure: r.failure(), type: r.resourceType(), phase: result.phase, time: Date.now() }));
for (const event of ['request', 'requestfinished', 'requestfailed']) page.on(event, r => {
  if (r.url().endsWith('.glb')) result.assetRequests.push({ event, url: r.url(), type: r.resourceType(), phase: result.phase, time: Date.now() });
});
page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(baseURL).origin) result.externalRequests.push(r.url()); });
page.on('response', r => { if (r.url().endsWith('.glb')) result.assets.push({ url: r.url(), status: r.status(), phase: result.phase }); });
const check = (name, value) => { assert.ok(value, name); result.checks.push(name); };
const screenshot = async name => page.locator('#lab-viewer').screenshot({ path: fileURLToPath(new URL(name + '.png', output)) });
try {
  await page.goto(baseURL);
  result.graphics = await page.locator('#lab-viewer canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return { width: canvas.width, height: canvas.height, renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
  });
  await page.getByRole('combobox', { name: '动力类型' }).selectOption('ice');
  await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
  const back = page.getByRole('button', { name: '返回四类动力教学模型和声学实验' });
  await back.waitFor();
  await page.getByRole('button', { name: '车间三维场景' }).click();
  const panel = page.locator('.lab-asset-inspection');
  await panel.locator('summary').click();
  const body = page.getByRole('combobox', { name: '写实车外壳' });
  const axis = page.getByRole('combobox', { name: '写实车剖面', exact: true });
  const part = page.getByRole('combobox', { name: '选择写实车部件' });
  check('30 asset groups plus unselected option', await part.locator('option').count() === 31);
  check('physical markers absent in unmatched asset mode', await page.locator('.lab-marker:not([hidden])').count() === 0);
  await screenshot('assembled');
  await body.selectOption('transparent'); await screenshot('transparent');
  await body.selectOption('hidden'); await screenshot('hidden-shell');
  await body.selectOption('solid');
  for (const value of ['x', 'y', 'z']) {
    await axis.selectOption(value);
    check('same asset after section ' + value, await back.isVisible());
    check('underfloor explanation matches section ' + value, await page.locator('.lab-underfloor-note').isVisible() === (value === 'y'));
    await screenshot('section-' + value);
    if (value === 'y') {
      await page.getByRole('button', { name: '道路三维场景' }).click();
      await screenshot('section-y-road');
      await page.getByRole('button', { name: '车间三维场景' }).click();
    }
  }
  await axis.selectOption('none');
  await part.selectOption('seat-front-left');
  await page.getByRole('button', { name: '拆出所选部件', exact: true }).click();
  await page.waitForTimeout(800);
  check('selected seat detached', (await page.locator('.lab-showroom-assembly p').innerText()).startsWith('已拆 1'));
  await screenshot('seat-detached');
  await page.getByRole('button', { name: '道路三维场景' }).click();
  await page.getByRole('button', { name: '车间三维场景' }).click();
  check('detached seat preserved across stages', (await page.locator('.lab-showroom-assembly p').innerText()).startsWith('已拆 1'));
  await page.getByRole('button', { name: '回装所选部件', exact: true }).click();
  await page.getByRole('button', { name: '恢复同车视图与回装' }).click();
  check('reset restores body, section and selection', await body.inputValue() === 'solid' && await axis.inputValue() === 'none' && await part.inputValue() === '');
  await page.locator('#lab-body').selectOption('hidden');
  check('host body control stays on same asset', await back.isVisible() && await body.inputValue() === 'hidden');
  await page.locator('#lab-section').selectOption('z');
  check('host section control stays on same asset', await back.isVisible() && await axis.inputValue() === 'z');
  await page.locator('#lab-reset').click();
  await page.locator('#lab-section').selectOption('none');
  await page.locator('#lab-body').selectOption('solid');
  await page.locator('#lab-explode').click();
  check('host explode controls all 30 groups on same asset', await back.isVisible() && (await page.locator('.lab-showroom-assembly p').textContent()).startsWith('已拆 30'));
  await page.waitForTimeout(1100);
  await screenshot('all-detached');
  await page.locator('#lab-reset').click();
  check('reset clears all detached groups', (await page.locator('.lab-showroom-assembly p').textContent()).startsWith('已拆 0'));
  await page.waitForTimeout(1100);
  await screenshot('restored');
  const canvas = page.locator('#lab-viewer canvas');
  const rect = await canvas.boundingBox();
  await page.mouse.click(rect.x + rect.width * 0.48, rect.y + rect.height * 0.55);
  check('actual canvas hit selects an asset part', (await part.inputValue()).length > 0);
  result.pickedPart = await part.inputValue();
  await screenshot('pointer-selection');
  await page.setViewportSize({ width: 360, height: 800 });
  await body.selectOption('transparent');
  await part.selectOption('hood');
  await page.getByRole('button', { name: '拆出所选部件', exact: true }).click();
  result.narrowStatus = await page.locator('.lab-showroom-assembly p').textContent();
  result.narrowSelection = await part.inputValue();
  check('narrow inspection controls operable', result.narrowStatus.startsWith('已拆 1'));
  check('no document horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await screenshot('narrow');
  await page.getByRole('button', { name: '恢复同车视图与回装' }).click();
  await back.click();
  check('teaching markers restored', await page.locator('.lab-marker:not([hidden])').count() === 16);
  await page.setViewportSize({ width: 1600, height: 900 });
  for (const kind of ['bev', 'hev', 'erev']) {
    result.phase = kind;
    await page.getByRole('combobox', { name: '动力类型' }).selectOption(kind);
    await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click(); await back.waitFor();
    check(kind + ' does not expose unverified ICE inspection', await panel.isHidden());
    await screenshot(kind + '-asset');
    await back.click();
  }
  for (const kind of ['ice', 'bev', 'hev', 'erev']) {
    await page.getByRole('combobox', { name: '动力类型' }).selectOption(kind);
    await page.locator('#lab-section').selectOption('y');
    await page.locator('.lab-underfloor-note').waitFor();
    check(kind + ' teaching Y section supports underfloor inspection', true);
    await screenshot(kind + '-teaching-y');
    await page.locator('#lab-section').selectOption('none');
    await page.locator('.lab-underfloor-note').waitFor({ state: 'hidden' });
    check(kind + ' teaching view restores floor presentation', true);
  }
  check('no browser exceptions', result.errors.length === 0);
  check('no failed resource requests', result.failedRequests.length === 0);
  check('no external runtime requests', result.externalRequests.length === 0);
  result.passed = true;
} catch (error) {
  result.passed = false; result.failure = error.stack;
  await screenshot('failure-viewer').catch(() => {});
  await page.screenshot({ path: fileURLToPath(new URL('failure.png', output)), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  result.buildSha256 = {};
  result.sourceFileSha256 = {};
  for (const file of ['src/team-a/viewer/lab-viewer.ts', 'src/team-a/viewer/scene-stage.ts', 'src/team-a/viewer/viewer.css']) {
    result.sourceFileSha256[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
  for (const file of ['index.html', ...(await readdir('dist/assets')).filter(name => /\.(js|css|glb)$/.test(name)).map(name => 'assets/' + name)]) {
    result.buildSha256[file] = createHash('sha256').update(await readFile('dist/' + file)).digest('hex');
  }
  await writeFile(new URL('result.json', output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
