async page => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__fieldRequests = [];
    window.Worker = class extends NativeWorker {
      postMessage(data, ...rest) {
        if (data?.type === 'field') window.__fieldRequests.push({ time: data.time, id: data.id,
          x: data.points[120][0], y: data.points[24][1], z: data.points[6][2], count: data.points.length });
        return super.postMessage(data, ...rest);
      }
    };
  });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5184/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  const records = [];
  async function move(kind, axis, coordinate) {
    await page.locator('#lab-section').selectOption(axis);
    await page.locator('#lab-field-slice').selectOption(axis);
    await page.locator('#lab-field').selectOption('residual');
    await page.evaluate(() => { const slider = document.querySelector('#lab-section-position'); slider.value = '0'; slider.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(axis => document.querySelector('.lab-field-note-detail')?.textContent?.includes(`${axis.toUpperCase()}=0.00 m 当前车身剖面真实采样切片`), axis);
    const before = await page.evaluate(() => window.__fieldRequests.length);
    await page.evaluate(value => { const slider = document.querySelector('#lab-section-position'); slider.value = String(value); slider.dispatchEvent(new Event('input', { bubbles: true })); }, coordinate);
    const waiting = await page.evaluate(() => document.querySelector('.lab-field-note-detail').textContent);
    if (!waiting.includes('暂无有效声场') && !waiting.includes('待查询')) throw Error(`${kind} ${axis}: old field was not invalidated: ${waiting}`);
    await page.waitForFunction(({ axis, coordinate }) => document.querySelector('.lab-field-note-detail')?.textContent?.includes(`${axis.toUpperCase()}=${coordinate.toFixed(2)} m 当前车身剖面真实采样切片`), { axis, coordinate });
    const state = await page.evaluate(before => ({ run: document.querySelector('#lab-run').textContent,
      time: document.querySelector('#lab-time').textContent, status: document.querySelector('#lab-field-status').textContent,
      note: document.querySelector('.lab-field-note-detail').textContent, requests: window.__fieldRequests.slice(before),
      contextLost: document.querySelector('#lab-viewer canvas').getContext('webgl2').isContextLost() }), before);
    if (state.time !== '3.90 / 16 s' || state.contextLost || !state.requests.some(row => Math.abs(row[axis] - coordinate) < 1e-6 && row.time === 3.9 && row.count === 280))
      throw Error(`${kind} ${axis}: query did not match paused time and physical plane: ${JSON.stringify(state)}`);
    records.push({ kind, axis, coordinate, ...state });
    if (kind === 'bev') await page.locator('#lab-viewer').screenshot({ path: `docs/evidence/A1/A1-FULL-007/after-bev-${axis}.png` });
  }
  for (const kind of ['bev', 'ice', 'hev', 'erev']) {
    if (kind !== 'bev') {
      await page.locator('#lab-vehicle').selectOption(kind);
      await page.locator('#lab-calculate').click();
      await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
    }
    await page.evaluate(() => { const seek = document.querySelector('#lab-seek'); seek.value = '3.9'; seek.dispatchEvent(new Event('input', { bubbles: true })); });
    await move(kind, 'x', 0.6);
    if (kind === 'bev') { await move(kind, 'y', 1.2); await move(kind, 'z', 0.4); }
  }
  if (errors.length) throw Error(`Page errors: ${errors.join('; ')}`);
  return { records, errors };
}
