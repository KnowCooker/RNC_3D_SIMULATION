// Node >=22: node browser-load-audit.mjs <playwright-core/index.mjs> [URL] [output.json]
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const url = process.argv[3] ?? 'http://127.0.0.1:5186/';
const output = process.argv[4] ?? fileURLToPath(new URL('./load-result.json', import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(30000);
const result = { role: 'A2', executor: 'Codex', task: 'A2-FULL-017', identitySource: 'user-declared',
  mergedMain: execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim(), source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  date: new Date().toISOString(), browser: browser.version(), url, checks: [], requests: [], errors: [], failures: [] };
result.viewerSha256 = createHash('sha256').update(await readFile('src/team-a/viewer/lab-viewer.ts')).digest('hex');
result.buildIndexSha256 = createHash('sha256').update(await readFile('dist/index.html')).digest('hex');
const check = (name, value) => { assert.ok(value, name); result.checks.push(name); };
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
const requests = new Map();
cdp.on('Network.requestWillBeSent', event => {
  if (!event.request.url.includes('.glb')) return;
  const entry = { id: event.requestId, url: event.request.url, phase: result.phase, type: event.type,
    initiator: event.initiator, start: event.timestamp };
  requests.set(event.requestId, entry); result.requests.push(entry);
});
cdp.on('Network.responseReceived', event => {
  const entry = requests.get(event.requestId);
  if (entry) Object.assign(entry, { status: event.response.status, headers: event.response.headers });
});
cdp.on('Network.loadingFinished', event => {
  const entry = requests.get(event.requestId);
  if (entry) Object.assign(entry, { finished: event.timestamp, encodedDataLength: event.encodedDataLength });
});
cdp.on('Network.loadingFailed', event => {
  const entry = requests.get(event.requestId);
  if (entry) Object.assign(entry, { failed: event.timestamp, errorText: event.errorText, canceled: event.canceled });
});
page.on('pageerror', error => result.errors.push(error.message));
page.on('requestfailed', request => result.failures.push({ phase: result.phase, url: request.url(), error: request.failure() }));
try {
  await page.goto(url); await page.locator('#lab-controls-toggle').click();
  const vehicle = page.getByRole('combobox', { name: '动力类型' });
  const toggle = page.locator('.lab-showroom-toggle');
  const back = page.getByRole('button', { name: '返回四类动力教学模型和声学实验' });
  for (let round = 0; round < 4; round++) {
    for (const kind of ['ice', 'bev', 'hev', 'erev']) {
      result.phase = `normal-${round}-${kind}`;
      await vehicle.selectOption(kind); await toggle.click(); await back.waitFor();
      check(result.phase + ' correct asset', (await page.locator('.lab-showroom-panel strong').innerText()).includes(kind === 'bev' ? 'Tesla' : 'Range Rover'));
      await back.click();
      check(result.phase + ' teaching markers restored', await page.locator('.lab-marker:not([hidden])').count() === 16);
    }
  }
  check('normal switching has no failed requests', result.failures.length === 0);
  check('all normal GLB requests finished', result.requests.every(entry => entry.finished && !entry.failed));

  // A fresh document ensures the failure exercises a real load, not a retained model.
  await page.reload(); await page.locator('#lab-controls-toggle').click();
  result.phase = 'intentional-network-failure';
  await vehicle.selectOption('ice');
  await page.route('**/*range-rover*.glb', route => route.abort('failed'), { times: 1 });
  await toggle.click();
  await page.waitForFunction(() => document.querySelector('.lab-showroom-toggle')?.textContent.includes('加载失败'));
  check('current network failure permits explicit retry', await toggle.isEnabled());
  check('failed load keeps teaching model', await page.locator('.lab-marker:not([hidden])').count() === 16);
  result.phase = 'retry';
  await toggle.click(); await back.waitFor();
  check('retry succeeds with correct asset', (await page.locator('.lab-showroom-panel strong').innerText()).includes('Range Rover'));
  await back.click();
  result.retryTitle = await toggle.getAttribute('title');
  check('successful retry clears obsolete error tooltip', !result.retryTitle);
  await page.reload(); await page.locator('#lab-controls-toggle').click();
  result.phase = 'intentional-failure-before-switch';
  await vehicle.selectOption('ice');
  await page.route('**/*range-rover*.glb', route => route.abort('failed'), { times: 1 });
  await toggle.click();
  await page.waitForFunction(() => document.querySelector('.lab-showroom-toggle')?.textContent.includes('加载失败'));
  check('current failure exposes an error explanation', !!await toggle.getAttribute('title'));
  result.phase = 'switch-after-failure';
  await vehicle.selectOption('bev');
  check('vehicle change clears obsolete error explanation', !await toggle.getAttribute('title'));
  check('vehicle change restores action text', await toggle.innerText() === '写实外观' && await toggle.isEnabled());
  await toggle.click(); await back.waitFor();
  check('new vehicle loads after previous failure', (await page.locator('.lab-showroom-panel strong').innerText()).includes('Tesla'));
  await page.locator('#lab-viewer').screenshot({ path: String(output).replace(/\.json$/, '-recovered.png') });
  check('only the two deliberate network failures occurred', result.failures.length === 2
    && result.failures.every(failure => failure.phase.startsWith('intentional-') && failure.error.errorText === 'net::ERR_FAILED'));
  check('no uncaught page exceptions', result.errors.length === 0);
  result.passed = true;
} catch (error) { result.passed = false; result.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, checks: result.checks.length, requests: result.requests.length,
    failures: result.failures, failure: result.failure, output }, null, 2));
  await browser.close();
}
