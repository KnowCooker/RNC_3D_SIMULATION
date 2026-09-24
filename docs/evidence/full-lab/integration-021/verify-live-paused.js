async page => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__fieldRequests = [];
    window.Worker = class extends NativeWorker {
      postMessage(data, ...rest) {
        if (data?.type === 'field') window.__fieldRequests.push({ time: data.time, x: data.points[120][0], count: data.points.length });
        return super.postMessage(data, ...rest);
      }
    };
  });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://127.0.0.1:5185/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  await page.locator('#lab-mode').selectOption('live');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => Number(document.querySelector('#lab-time')?.textContent?.split(' ')[0]) > 1.5);
  await page.locator('#lab-play').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实时已暂停'));
  await page.locator('#lab-section').selectOption('x');
  await page.locator('#lab-field-slice').selectOption('x');
  await page.locator('#lab-field').selectOption('residual');
  await page.waitForFunction(() => document.querySelector('.lab-field-note-detail')?.textContent?.includes('X=0.00 m 当前车身剖面真实采样切片'));
  const before = await page.evaluate(() => ({ run: document.querySelector('#lab-run').textContent,
    time: document.querySelector('#lab-time').textContent, requests: window.__fieldRequests.length }));
  await page.evaluate(() => { const slider = document.querySelector('#lab-section-position'); slider.value = '0.6'; slider.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('.lab-field-note-detail')?.textContent?.includes('X=0.60 m 当前车身剖面真实采样切片'));
  const after = await page.evaluate(before => ({ run: document.querySelector('#lab-run').textContent,
    time: document.querySelector('#lab-time').textContent, status: document.querySelector('#lab-field-status').textContent,
    note: document.querySelector('.lab-field-note-detail').textContent,
    requests: window.__fieldRequests.slice(before.requests) }), before);
  if (before.run !== after.run || before.time !== after.time || !after.requests.some(row => row.x === 0.6 && row.count === 280 && Math.abs(row.time - Number(before.time.split(' ')[0])) < 0.01) || errors.length)
    throw Error(`Live paused field does not match the same run/time/plane: ${JSON.stringify({ before, after, errors })}`);
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/full-lab/integration-021/live-paused-x.png' });
  return { before, after, errors };
}
