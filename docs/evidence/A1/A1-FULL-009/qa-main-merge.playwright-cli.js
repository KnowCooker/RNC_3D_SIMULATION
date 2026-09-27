// pnpm dev; playwright-cli run-code --filename docs/evidence/A1/A1-FULL-009/qa-main-merge.playwright-cli.js
async (page) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith('http://127.0.0.1:5173/') && !url.startsWith('blob:http://127.0.0.1:5173/')) external.push(url);
  });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__a1RoadRuns = [];
    window.__a1RoadSamples = [];
    window.__a1ReplayRuns = [];
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', event => {
          if (event.data?.type !== 'chunk') return;
          const runId = event.data.runId;
          if (window.__a1RoadSamples.some(item => item.runId === runId)) return;
          const source = event.data.packet.snapshot.result.sources[0];
          const rms = Math.sqrt(source.reduce((power, sample) => power + sample * sample, 0) / source.length);
          window.__a1RoadSamples.push({ runId, rms, samples: source.length });
        });
      }
      postMessage(message, ...transfer) {
        if (message?.type === 'live-start') window.__a1RoadRuns.push({ runId: message.runId, roughness: message.config.roadRoughness, sourceMode: message.config.sourceMode });
        if (message?.type === 'calculate') window.__a1ReplayRuns.push({ runId: message.runId, roughness: message.config.roadRoughness, sourceMode: message.config.sourceMode, durationSeconds: message.config.durationSeconds });
        return super.postMessage(message, ...transfer);
      }
    };
  });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#lab-viewer canvas').waitFor();
  const initial = {
    road: await page.locator('#lab-road').inputValue(),
    mode: await page.locator('#lab-mode').inputValue(),
    source: await page.locator('#lab-source-mode').inputValue(),
    note: await page.locator('#lab-road-acoustic-note').innerText(),
  };
  await page.getByRole('button', { name: '道路三维场景' }).click();
  await page.getByRole('button', { name: '切换三维路面为粗糙沥青' }).click();
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => window.__a1RoadSamples.length === 1, undefined, { timeout: 30000 });
  const coarse = {
    road: await page.locator('#lab-road').inputValue(),
    note: await page.locator('#lab-road-acoustic-note').innerText(),
    status: await page.locator('#lab-status').innerText(),
  };
  await page.locator('#lab-field').selectOption('primary');
  await page.locator('.lab-field-hud:not([hidden])').waitFor({ timeout: 30000 });
  const fieldBeforeChange = await page.locator('#lab-field-status').innerText();
  await page.locator('#lab-field').selectOption('off');
  await page.getByRole('button', { name: '切换三维路面为碎石路' }).click();
  await page.locator('#lab-field').selectOption('primary');
  const afterChange = {
    road: await page.locator('#lab-road').inputValue(),
    run: await page.locator('#lab-run').innerText(),
    playDisabled: await page.locator('#lab-play').isDisabled(),
    status: await page.locator('#lab-status').innerText(),
    field: await page.locator('#lab-field-status').innerText(),
  };
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => window.__a1RoadSamples.length === 2, undefined, { timeout: 30000 });
  const gravelNote = await page.locator('#lab-road-acoustic-note').innerText();
  const runs = await page.evaluate(() => window.__a1RoadRuns);
  const samples = await page.evaluate(() => window.__a1RoadSamples);
  const ratio = samples[1].rms / samples[0].rms;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/evidence/A1/A1-FULL-009/main-merge-desktop.png' });
  const toggle = page.locator('#lab-controls-toggle');
  await toggle.click();
  const collapsed = !await page.locator('#lab-controls').isVisible();
  await toggle.click();
  const expanded = await page.locator('#lab-controls').isVisible();
  await page.locator('#lab-road').evaluate(input => { input.value = '0.9'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  const manualNote = await page.locator('#lab-road-acoustic-note').innerText();
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => window.__a1RoadSamples.length === 3, undefined, { timeout: 30000 });
  const manualRun = await page.evaluate(() => window.__a1RoadRuns.at(-1));
  const manualRms = await page.evaluate(() => window.__a1RoadSamples.at(-1).rms);
  await page.locator('#lab-mode').selectOption('replay');
  await page.locator('#lab-duration').selectOption('10');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  const replayRun = await page.evaluate(() => window.__a1ReplayRuns.at(-1));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await page.locator('#lab-viewer canvas').waitFor();
  await page.waitForTimeout(250);
  const narrow = {
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    controlsCollapsed: !await page.locator('#lab-controls').isVisible(),
    viewerVisible: await page.locator('#lab-viewer').isVisible(),
    toggleVisible: await page.locator('#lab-controls-toggle').isVisible(),
  };
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/evidence/A1/A1-FULL-009/main-merge-mobile-stage.png' });
  await page.locator('#lab-controls-toggle').click();
  narrow.controlsOpen = await page.locator('#lab-controls').isVisible();
  await page.screenshot({ path: 'docs/evidence/A1/A1-FULL-009/main-merge-narrow.png', fullPage: true });
  if (errors.length || external.length || initial.road !== '0.6' || initial.mode !== 'live' || initial.source !== 'recorded-noise' ||
      coarse.road !== '1.2' || !coarse.note.includes('当前实验已采用') || !fieldBeforeChange.includes('空间窗口') ||
      afterChange.road !== '2.2' || afterChange.run !== '待计算配置' || !afterChange.playDisabled || !afterChange.status.includes('启动新的实时实验') ||
      !afterChange.field.includes('等待当前实验声场') || !gravelNote.includes('当前实验已采用') ||
      runs.length !== 2 || runs[0].roughness !== 1.2 || runs[1].roughness !== 2.2 || runs.some(run => run.sourceMode !== 'recorded-noise') ||
      samples.some(item => item.samples < 100 || !Number.isFinite(item.rms)) || !(ratio > 1.3 && ratio < 1.4) ||
      !collapsed || !expanded || !manualNote.includes('三维路面仍显示碎石路') || manualRun.roughness !== 0.9 ||
      !(manualRms < samples[0].rms) || replayRun.roughness !== 0.9 || replayRun.durationSeconds !== 10 || replayRun.sourceMode !== 'recorded-noise' ||
      narrow.overflow || !narrow.controlsCollapsed || !narrow.viewerVisible || !narrow.toggleVisible || !narrow.controlsOpen) {
    throw new Error(JSON.stringify({ errors, external, initial, coarse, fieldBeforeChange, afterChange, gravelNote, runs, samples, ratio, collapsed, expanded, manualNote, manualRun, manualRms, replayRun, narrow }));
  }
  return { errors, external, initial, coarse, fieldBeforeChange, afterChange, gravelNote, runs, samples, ratio, collapsed, expanded, manualNote, manualRun, manualRms, replayRun, narrow };
}
