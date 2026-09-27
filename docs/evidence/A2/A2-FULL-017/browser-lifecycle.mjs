import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] ?? 'http://127.0.0.1:5184/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const result = { date: new Date().toISOString(), browser: browser.version(), checks: [], errors: [], intentionalHttpFailures: [] };
page.on('pageerror', e => result.errors.push(e.message));
const check = (name, value) => { assert.ok(value, name); result.checks.push(name); };
const waitForRoute = async read => {
  const deadline = Date.now() + 15000;
  while (!read()) { if (Date.now() >= deadline) throw new Error('GLB route did not start'); await page.waitForTimeout(50); }
};
try {
  let iceRoute, bevRoute;
  await page.route('**/*.glb', route => {
    if (route.request().url().includes('range-rover')) iceRoute = route; else bevRoute = route;
  });
  await page.goto(url);
  const vehicle = page.getByRole('combobox', { name: '动力类型' });
  const toggle = page.locator('.lab-showroom-toggle');
  await vehicle.selectOption('ice'); await toggle.click();
  await waitForRoute(() => iceRoute);
  await vehicle.selectOption('bev'); await toggle.click();
  await waitForRoute(() => bevRoute);
  result.intentionalHttpFailures.push({ asset: 'stale ICE request', status: 503 });
  await iceRoute.fulfill({ status: 503, body: 'deliberate stale load failure' });
  await page.waitForTimeout(500);
  result.afterStaleFailure = { disabled: await toggle.isDisabled(), text: await toggle.innerText() };
  check('stale failure cannot enable or replace current loading state', result.afterStaleFailure.disabled && result.afterStaleFailure.text === '加载外观…');
  await bevRoute.continue();
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).waitFor();
  check('newer BEV asset wins over stale ICE', (await page.locator('.lab-showroom-panel strong').innerText()).includes('Tesla'));
  await toggle.click(); await page.unroute('**/*.glb');
  await vehicle.selectOption('ice'); await toggle.click();
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).waitFor();
  await page.getByRole('button', { name: '车间三维场景' }).click();
  const assembly = page.locator('.lab-showroom-assembly');
  await assembly.getByRole('button', { name: '自动拆解', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.lab-showroom-assembly p').textContent.startsWith('已拆 2'));
  await assembly.getByRole('button', { name: '暂停自动拆解', exact: true }).click();
  const paused = await assembly.locator('p').textContent(); await page.waitForTimeout(1200);
  check('automatic disassembly pauses', paused === await assembly.locator('p').textContent());
  await assembly.getByRole('button', { name: '自动回装', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.lab-showroom-assembly p').textContent.startsWith('已拆 0'));
  check('automatic reverse restoration reaches zero', true);
  await page.locator('[data-speaker="0"]').uncheck();
  check('hardware rebuild keeps same asset active', await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).isVisible());
  check('hardware rebuild keeps unmatched markers hidden', await page.locator('.lab-marker:not([hidden])').count() === 0);
  check('no uncaught errors during lifecycle scenarios', result.errors.length === 0);
  result.passed = true;
} catch (error) { result.passed = false; result.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(new URL('./browser/lifecycle.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2)); await browser.close();
}
