import { chromium } from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'docs/evidence/A2/A2-XPENG-001';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
const errors = [], checks = [];
page.on('pageerror', e => errors.push(String(e)));
const check = (condition, description) => { assert.ok(condition, description); checks.push(description); };
try {
  await page.goto('http://127.0.0.1:5197/#xpeng');
  const panel = page.locator('.lab-showroom-panel'), viewer = page.locator('#lab-viewer');
  await page.locator('.lab-xpeng-picker:not([hidden])').waitFor();
  await viewer.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '车间三维场景', exact: true }).click();
  for (const [id, name] of [['x9', '小鹏 X9'], ['p7plus', '小鹏 P7+'], ['l03', '小鹏 MONA L03'], ['m03', '小鹏 MONA M03'], ['gx', '小鹏 GX']]) {
    await page.getByLabel('选择小鹏车型', { exact: true }).selectOption(id);
    await page.waitForFunction(name => document.querySelector('.lab-showroom-panel > strong')?.textContent.startsWith(name), name);
    await page.waitForTimeout(400);
    check((await panel.innerText()).includes('官网照片参考重建'), `${id}: scope disclosed`);
    check((await panel.locator('a').getAttribute('href')).startsWith('https://www.xiaopeng.com/'), `${id}: official source`);
    await viewer.screenshot({ path: `${out}/${id}-exterior.png` });
    await panel.getByRole('button', { name: '查看座舱', exact: true }).click();
    check(await page.getByLabel('写实车外壳', { exact: true }).inputValue() === 'hidden', `${id}: cabin mode`);
    await viewer.screenshot({ path: `${out}/${id}-cabin.png` });
    await panel.getByRole('button', { name: '全部复位', exact: true }).click();
    await panel.locator('summary').click();
    await page.getByLabel('写实车外壳', { exact: true }).selectOption('transparent');
    check(await page.getByLabel('写实车外壳', { exact: true }).inputValue() === 'transparent', `${id}: transparent shell`);
    for (const axis of ['x', 'y', 'z']) {
      await page.getByLabel('写实车剖面', { exact: true }).selectOption(axis);
      check((await panel.locator('output').innerText()).startsWith(axis.toUpperCase()), `${id}: ${axis} section`);
    }
    await page.getByLabel('写实车剖面', { exact: true }).selectOption('none');
    await page.getByLabel('选择写实车部件', { exact: true }).selectOption('hood');
    await panel.locator('.lab-asset-part-action').click();
    await page.waitForTimeout(1000);
    check((await panel.locator('.lab-asset-part-action').innerText()).includes('回装'), `${id}: semantic hood detach`);
    await panel.locator('.lab-asset-part-action').click();
    await panel.getByRole('button', { name: '全部复位', exact: true }).click();
    check(await page.getByLabel('写实车外壳', { exact: true }).inputValue() === 'solid', `${id}: solid restored`);
    check(await page.getByLabel('选择写实车部件', { exact: true }).inputValue() === '', `${id}: selection restored`);
    await panel.locator('summary').click();
    await panel.getByRole('button', { name: '展开全部', exact: true }).click();
    await page.waitForTimeout(1600);
    const status = await page.locator('.lab-showroom-assembly p').innerText();
    const numbers = status.match(/\d+/g).map(Number);
    check(numbers[0] === numbers[1] && numbers[0] > 25, `${id}: all semantic parts detached`);
    await viewer.screenshot({ path: `${out}/${id}-exploded.png` });
    await panel.getByRole('button', { name: '全部复位', exact: true }).click();
    await page.waitForTimeout(1600);
    check((await page.locator('.lab-showroom-assembly p').innerText()).startsWith('已拆 0'), `${id}: all parts restored`);
  }
  // Reload entry and narrow-layout operability; renderer remains a real WebGL canvas.
  await page.reload(); await page.locator('.lab-xpeng-picker:not([hidden])').waitFor();
  check(await page.getByLabel('选择小鹏车型', { exact: true }).inputValue() === 'x9', 'reload deterministic X9');
  await page.setViewportSize({ width: 740, height: 1000 }); await viewer.scrollIntoViewIfNeeded();
  await page.getByLabel('选择小鹏车型', { exact: true }).selectOption('m03');
  await page.waitForFunction(() => document.querySelector('.lab-showroom-panel > strong')?.textContent.includes('M03'));
  await viewer.screenshot({ path: `${out}/narrow.png` });
  check(await panel.getByRole('button', { name: '全部复位', exact: true }).isVisible(), 'narrow controls available');
  await page.locator('.lab-showroom-toggle').click();
  check(await panel.isHidden(), 'return to acoustic teaching viewer');
  check(errors.length === 0, 'no JavaScript runtime errors');
  await writeFile(`${out}/browser-results.json`, JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
  console.log(`${checks.length} browser checks passed`);
} catch (error) {
  await writeFile(`${out}/browser-failure.json`, JSON.stringify({ checks, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
