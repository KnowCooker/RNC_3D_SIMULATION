async page => {
  const vehicle = page.url().match(/[?&]captureVehicle=([^&]+)/)?.[1] || 'bev';
  if (!['bev', 'ice', 'hev', 'erev'].includes(vehicle)) throw Error(`Unknown vehicle ${vehicle}`);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => {
    const original = Worker.prototype.postMessage;
    window.__fieldRequests = [];
    Worker.prototype.postMessage = function (message, ...rest) {
      if (message?.type === 'field') window.__fieldRequests.push({ time: message.time, points: message.points });
      return original.call(this, message, ...rest);
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5183/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  if (vehicle !== 'bev') {
    await page.locator('#lab-vehicle').selectOption(vehicle);
    await page.locator('#lab-calculate').click();
    await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  }
  const run = await page.locator('#lab-run').textContent();
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-seek').evaluate(element => { element.value = '4'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('空间窗口截至'));
  const positions = { x: [-0.4, 0.4], y: [1.1, 1.6], z: [-0.8, 0.8] };
  const rows = [];
  for (const axis of ['x', 'y', 'z']) {
    await page.locator('#lab-section').selectOption(axis);
    await page.locator('#lab-field-slice').selectOption(axis);
    for (const cut of positions[axis]) {
      const previousQueries = await page.evaluate(() => window.__fieldRequests.length);
      await page.locator('#lab-section-position').evaluate((element, value) => {
        element.value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }, cut);
      const pendingNote = await page.locator('.lab-field-note-detail').textContent();
      if (!pendingNote?.includes('待查询')) throw Error(`${vehicle} ${axis}=${cut}: old field did not hide: ${pendingNote}`);
      const seekTime = 4.3 + rows.length * 0.35;
      await page.locator('#lab-seek').evaluate((element, value) => {
        element.value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }, seekTime);
      await page.waitForFunction(({ axis, cut }) => {
        const note = document.querySelector('.lab-field-note-detail')?.textContent || '';
        return note.includes(`${axis.toUpperCase()}=${cut.toFixed(2)} m`) && note.includes('当前车身剖面真实采样切片');
      }, { axis, cut }, { timeout: 20000 });
      const state = await page.evaluate(({ axis, cut, previousQueries }) => {
        const dimension = { x: 0, y: 1, z: 2 }[axis];
        const selected = index => axis === 'x' ? Math.floor(index / 40) === 3
          : axis === 'y' ? Math.floor(index / 8) % 5 === 3 : index % 8 === 6;
        const requests = window.__fieldRequests.slice(previousQueries);
        const match = requests.findLast(request => request.points.length === 280
          && request.points.every((point, index) => !selected(index) || Math.abs(point[dimension] - cut) < 1e-9));
        const host = document.querySelector('#lab-viewer');
        return {
          vehicle: document.querySelector('#lab-vehicle').value,
          run: document.querySelector('#lab-run').textContent,
          axis, cut, queryCount: requests.length, matchedQuery: !!match,
          movedSamples: match?.points.filter((_, index) => selected(index)).length || 0,
          queryTime: match?.time ?? null,
          note: host.querySelector('.lab-field-note-detail')?.textContent,
          contextLost: host.querySelector('canvas').getContext('webgl2').isContextLost(),
        };
      }, { axis, cut, previousQueries });
      if (!state.matchedQuery || state.run !== run || state.vehicle !== vehicle || state.contextLost) throw Error(JSON.stringify(state));
      rows.push(state);
      if (cut === positions[axis][0]) await page.locator('#lab-viewer').screenshot({ path: `docs/evidence/A2/A2-FULL-011/${vehicle}-${axis}-first.png` });
    }
    await page.locator('#lab-viewer').screenshot({ path: `docs/evidence/A2/A2-FULL-011/${vehicle}-${axis}.png` });
  }
  if (errors.length) throw Error(errors.join('; '));
  return { vehicle, run, rows, errors };
}
