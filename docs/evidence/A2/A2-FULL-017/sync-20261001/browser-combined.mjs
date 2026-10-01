import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] ?? 'http://127.0.0.1:5185/';
const output = new URL('./', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(15000);
const report = { date: new Date().toISOString(), browser: browser.version(),
  a2: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  a1: execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim(),
  checks: [], errors: [], external: [], experiments: [] };
page.on('pageerror', e => report.errors.push(e.message));
page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(base).origin) report.external.push(r.url()); });
const check = (name, value) => { assert.ok(value, name); report.checks.push(name); };
const shot = async name => page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)) });
await page.addInitScript(() => {
  const Original = window.Worker;
  window.audit = { configs: [], results: [], fields: [], terminations: 0 };
  window.Worker = class extends Original {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', ({ data }) => {
        if (data.type === 'result') {
          const q = data.result.sources[0];
          window.audit.results.push({ runId: data.runId, config: data.result.config,
            rms: Math.sqrt(q.reduce((s, v) => s + v*v, 0) / q.length) });
        }
        if (data.type === 'field') window.audit.fields.push({ time: data.frame.time, points: data.frame.points.length, valid: data.frame.valid, runId: data.runId });
      });
    }
    postMessage(message, ...rest) {
      if (message.type === 'calculate' || message.type === 'live-start') window.audit.configs.push(structuredClone(message));
      return super.postMessage(message, ...rest);
    }
    terminate() { window.audit.terminations++; return super.terminate(); }
  };
});
const seek = async () => page.locator('#lab-seek').evaluate(input => { input.value = '5'; input.dispatchEvent(new Event('input', { bubbles: true })); });
try {
  await page.goto(base);
  await page.locator('#lab-viewer canvas').waitFor();
  check('current recorded-source disclosure survives composition', (await page.locator('.lab-disclosure').innerText()).includes('未校准V'));
  check('variable duration input survives composition', await page.locator('#lab-duration').count() === 1);
  check('desktop controls initially collapsed', !await page.locator('#lab-controls').isVisible());
  await page.locator('#lab-controls-toggle').click();
  await page.locator('#lab-mode').selectOption('replay');
  await page.locator('#lab-source-mode').selectOption('shaped-noise');
  for (const kind of ['ice', 'bev', 'hev', 'erev']) {
    await page.locator('#lab-vehicle').selectOption(kind);
    const rows = [];
    for (const [name, roughness] of [['平整沥青', .6], ['粗糙沥青', 1.2], ['碎石路', 2.2]]) {
      await page.getByRole('button', { name: '切换三维路面为' + name }).click();
      check(kind + name + ' updates physical form', Number(await page.locator('#lab-road').inputValue()) === roughness);
      check(kind + name + ' invalidates previous playback', await page.locator('#lab-play').isDisabled());
      await page.locator('#lab-calculate').click();
      await page.waitForFunction(() => document.querySelector('#lab-status').textContent.includes('实验就绪'));
      const row = await page.evaluate(() => window.audit.results.at(-1));
      check(kind + name + ' reaches actual Worker', row.config.vehicle === kind && row.config.roadRoughness === roughness);
      rows.push(row); report.experiments.push(row);
    }
    check(kind + ' source RMS follows roughness', rows[0].rms < rows[1].rms && rows[1].rms < rows[2].rms);
    await seek();
    for (const field of ['primary', 'residual']) {
      const count = await page.evaluate(() => window.audit.fields.length);
      await page.locator('#lab-field').selectOption(field);
      await page.waitForFunction(n => window.audit.fields.length > n && window.audit.fields.at(-1).valid, count);
      check(kind + field + ' shows 280 computed points', (await page.evaluate(() => window.audit.fields.at(-1))).points === 280);
      await page.locator('.lab-field-hud:not([hidden])').waitFor();
    }
    await shot(kind + '-field');
    await page.locator('#lab-field').selectOption('off');
    await page.locator('#lab-section').selectOption('y');
    await page.locator('.lab-underfloor-note').waitFor();
    await page.locator('#lab-section').selectOption('none');
    await page.locator('.lab-underfloor-note').waitFor({ state: 'hidden' });
    check(kind + ' section returns from underfloor in combined UI', true);
  }
  await page.locator('#lab-vehicle').selectOption('ice');
  await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
  const back = page.getByRole('button', { name: '返回四类动力教学模型和声学实验' });
  await back.waitFor();
  await page.getByRole('button', { name: '车间三维场景' }).click();
  await page.locator('.lab-asset-inspection summary').click();
  await page.getByRole('combobox', { name: '选择写实车部件' }).selectOption('seat-front-left');
  await page.getByRole('button', { name: '拆出所选部件', exact: true }).click();
  await page.waitForTimeout(900);
  check('ICE same-asset seat disassembly in combined UI', (await page.locator('.lab-showroom-assembly p').textContent()).startsWith('已拆 1'));
  await shot('ice-inspection-desktop');
  await page.setViewportSize({ width: 360, height: 800 });
  if (await page.locator('#lab-controls').isVisible()) await page.locator('#lab-controls-close').click();
  check('narrow controls are collapsed for inspection', !await page.locator('#lab-controls').isVisible());
  await page.locator('.lab-asset-inspection summary').click();
  await page.locator('.lab-showroom-panel').evaluate(panel => { panel.scrollTop = 0; });
  const summaryVisible = await page.locator('.lab-asset-inspection summary').evaluate(summary => {
    const s = summary.getBoundingClientRect(), p = summary.closest('.lab-showroom-panel').getBoundingClientRect();
    return s.top >= p.top && s.bottom <= p.bottom;
  });
  check('narrow collapsed inspection entry visible without scrolling', summaryVisible);
  check('narrow assembly list returns when inspection closes', await page.locator('.lab-showroom-assembly').isVisible());
  await page.locator('.lab-asset-inspection summary').click();
  check('narrow expanded inspector has usable height', (await page.locator('.lab-showroom-panel').boundingBox()).height > 250);
  check('narrow assembly list does not cover open inspection', !await page.locator('.lab-showroom-assembly').isVisible());
  await page.getByRole('combobox', { name: '写实车剖面', exact: true }).selectOption('y');
  await page.locator('.lab-underfloor-note').waitFor();
  check('narrow same-asset inspector remains operable', await back.isVisible());
  check('narrow document has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#lab-viewer').evaluate(viewer => viewer.scrollIntoView({ block: 'start' }));
  await shot('ice-inspection-narrow');
  await page.getByRole('button', { name: '恢复同车视图与回装' }).click();
  await back.click();
  await page.locator('#lab-controls-toggle').click();
  check('mobile control drawer opens', await page.locator('#lab-controls').isVisible());
  await page.locator('#lab-controls-close').click();
  check('mobile control drawer closes', !await page.locator('#lab-controls').isVisible());
  await page.reload();
  check('fresh mobile page starts collapsed', !await page.locator('#lab-controls').isVisible());
  check('no uncaught browser errors', report.errors.length === 0);
  check('no external runtime requests', report.external.length === 0);
  report.passed = true;
} catch (error) { report.passed = false; report.failure = error.stack; await shot('failure').catch(() => {}); process.exitCode = 1; }
finally {
  report.audit = await page.evaluate(() => window.audit).catch(() => null);
  report.sourceSha256 = {};
  for (const file of ['src/team-a/lab/index.ts', 'src/team-a/lab/game-ui.css', 'src/team-a/viewer/lab-viewer.ts', 'src/team-a/viewer/viewer.css']) report.sourceSha256[file] = createHash('sha256').update(await readFile(file)).digest('hex');
  report.buildSha256 = {};
  for (const file of ['index.html', ...(await readdir('dist/assets')).filter(n => /\.(js|css)$/.test(n)).map(n => 'assets/' + n)]) report.buildSha256[file] = createHash('sha256').update(await readFile('dist/' + file)).digest('hex');
  await writeFile(new URL('result.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failure: report.failure }));
  await browser.close();
}
