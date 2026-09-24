// playwright-cli run-code --filename docs/evidence/A1/A1-FULL-009/qa-road-ui.playwright-cli.js
async (page) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith('http://127.0.0.1:5184/') && !url.startsWith('blob:http://127.0.0.1:5184/')) external.push(url);
  });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__rncWorkerConfigs = [];
    window.__rncSourceRms = [];
    window.__rncWorkerTerminations = 0;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', event => {
          if (event.data?.type !== 'result') return;
          const q = event.data.result.sources[0];
          const rms = Math.sqrt(q.reduce((power, sample) => power + sample * sample, 0) / q.length);
          window.__rncSourceRms.push({ runId: event.data.runId, rms });
        });
      }
      postMessage(message, ...transfer) {
        if (message?.type === 'calculate' || message?.type === 'live-start') {
          window.__rncWorkerConfigs.push({ type: message.type, roadRoughness: message.config.roadRoughness, runId: message.runId });
        }
        return super.postMessage(message, ...transfer);
      }
      terminate() { window.__rncWorkerTerminations++; return super.terminate(); }
    };
  });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5184/');
  await page.locator('#lab-viewer canvas').waitFor();
  const initial = { road: await page.locator('#lab-road').inputValue(), note: await page.locator('#lab-road-acoustic-note').innerText() };
  const toggle = page.locator('#lab-controls-toggle');
  await toggle.click();
  const collapsed = !await page.locator('#lab-controls').isVisible() && await toggle.getAttribute('aria-expanded') === 'false';
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A1/A1-FULL-009/immersive-road.png' });
  await toggle.click();
  const expanded = await page.locator('#lab-controls').isVisible() && await toggle.getAttribute('aria-expanded') === 'true';
  await page.getByRole('button', { name: '道路三维场景' }).click();
  await page.getByRole('button', { name: '切换三维路面为粗糙沥青' }).click();
  const coarse = { road: await page.locator('#lab-road').inputValue(), note: await page.locator('#lab-road-acoustic-note').innerText() };
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  const coarseConfig = await page.evaluate(() => window.__rncWorkerConfigs.at(-1));
  const coarseRms = await page.evaluate(() => window.__rncSourceRms.at(-1)?.rms);
  const coarseResult = await page.locator('#lab-status').innerText();
  await page.locator('#lab-seek').evaluate(input => { input.value = '5'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#lab-field').selectOption('primary');
  await page.locator('.lab-field-hud:not([hidden])').waitFor({ timeout: 30000 });
  await page.locator('#lab-field').selectOption('off');
  await page.getByRole('button', { name: '切换三维路面为碎石路' }).click();
  const gravel = {
    road: await page.locator('#lab-road').inputValue(),
    status: await page.locator('#lab-status').innerText(),
    playDisabled: await page.locator('#lab-play').isDisabled(),
    run: await page.locator('#lab-run').innerText(),
    note: await page.locator('#lab-road-acoustic-note').innerText(),
  };
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  const gravelConfig = await page.evaluate(() => window.__rncWorkerConfigs.at(-1));
  const gravelRms = await page.evaluate(() => window.__rncSourceRms.at(-1)?.rms);
  await page.locator('#lab-road').evaluate(input => { input.value = '0.9'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  const manual = { road: await page.locator('#lab-road').inputValue(), note: await page.locator('#lab-road-acoustic-note').innerText() };
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  const manualConfig = await page.evaluate(() => window.__rncWorkerConfigs.at(-1));
  const manualRms = await page.evaluate(() => window.__rncSourceRms.at(-1)?.rms);
  await page.locator('#lab-seek').evaluate(input => { input.value = '5'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('.lab-field-hud:not([hidden])').waitFor({ timeout: 30000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#lab-controls').evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: 'docs/evidence/A1/A1-FULL-009/desktop-stage.png' });
  await page.screenshot({ path: 'docs/evidence/A1/A1-FULL-009/desktop-field.png', fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('#lab-controls-close').click();
  await page.screenshot({ path: 'docs/evidence/A1/A1-FULL-009/narrow-field.png', fullPage: true });
  const narrow = {
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    viewer: await page.locator('#lab-viewer').isVisible(),
    controlsClosed: !await page.locator('#lab-controls').isVisible(),
    toggle: await toggle.isVisible(),
  };
  await toggle.click();
  const mobileOpen = await page.locator('#lab-controls').isVisible() && await page.locator('#lab-controls-close').isVisible();
  await page.screenshot({ path: 'docs/evidence/A1/A1-FULL-009/narrow-controls.png' });
  await page.locator('#lab-controls-close').click();
  const mobileClosed = !await page.locator('#lab-controls').isVisible();
  const terminations = await page.evaluate(() => window.__rncWorkerTerminations);
  await page.reload();
  const initialMobileCollapsed = !await page.locator('#lab-controls').isVisible() && await toggle.getAttribute('aria-expanded') === 'false';
  if (errors.length || external.length || initial.road !== '0.6' || !initial.note.includes('平整沥青') || !collapsed || !expanded ||
      coarse.road !== '1.2' || !coarse.note.includes('粗糙沥青') || coarseConfig?.roadRoughness !== 1.2 || !coarseResult.includes('实验就绪') ||
      gravel.road !== '2.2' || !gravel.status.includes('重新计算') || !gravel.playDisabled || gravel.run !== '待计算配置' ||
      gravelConfig?.roadRoughness !== 2.2 || !(gravelRms > coarseRms && coarseRms > manualRms) ||
      manual.road !== '0.9' || !manual.note.includes('三维路面仍显示碎石路') ||
      manualConfig?.roadRoughness !== 0.9 || terminations < 2 || narrow.overflow || !narrow.viewer || !narrow.controlsClosed || !narrow.toggle ||
      !mobileOpen || !mobileClosed || !initialMobileCollapsed) {
    throw new Error(JSON.stringify({ errors, external, initial, collapsed, expanded, coarse, coarseConfig, coarseRms, gravel, gravelConfig, gravelRms, manual, manualConfig, manualRms, narrow, mobileOpen, mobileClosed, initialMobileCollapsed, terminations }));
  }
  return { errors, external, initial, collapsed, expanded, coarse, coarseConfig, coarseRms, gravel, gravelConfig, gravelRms, manual, manualConfig, manualRms, narrow, mobileOpen, mobileClosed, initialMobileCollapsed, terminations };
}
