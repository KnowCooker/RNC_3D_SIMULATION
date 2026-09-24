async page => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.__fieldSent = [];
    window.Worker = class extends NativeWorker {
      postMessage(data, ...rest) {
        if (data?.type !== 'field') return super.postMessage(data, ...rest);
        window.__fieldSent.push({ time: data.time, x: data.points[120][0], at: performance.now() });
        setTimeout(() => super.postMessage(data, ...rest), 900);
      }
    };
  });
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://127.0.0.1:5184/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  await page.evaluate(() => { const seek = document.querySelector('#lab-seek'); seek.value = '3.9'; seek.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#lab-section').selectOption('x');
  await page.locator('#lab-field-slice').selectOption('x');
  await page.locator('#lab-field').selectOption('residual');
  await page.waitForFunction(() => window.__fieldSent.length >= 1);
  for (let i = 1; i <= 9; i++) {
    await page.evaluate(value => { const slider = document.querySelector('#lab-section-position'); slider.value = String(value); slider.dispatchEvent(new Event('input', { bubbles: true })); }, i / 10);
    await page.waitForTimeout(45);
  }
  const during = await page.evaluate(() => ({ count: window.__fieldSent.length,
    note: document.querySelector('.lab-field-note-detail').textContent,
    status: document.querySelector('#lab-field-status').textContent }));
  if (during.count > 2 || during.note.includes('当前车身剖面真实采样切片')) throw Error(`Unbounded or stale field while dragging: ${JSON.stringify(during)}`);
  await page.waitForFunction(() => document.querySelector('.lab-field-note-detail')?.textContent?.includes('X=0.90 m 当前车身剖面真实采样切片'));
  const final = await page.evaluate(() => ({ time: document.querySelector('#lab-time').textContent,
    note: document.querySelector('.lab-field-note-detail').textContent,
    requests: window.__fieldSent, status: document.querySelector('#lab-field-status').textContent }));
  if (final.time !== '3.90 / 16 s' || !final.requests.some(row => Math.abs(row.x - 0.9) < 1e-6 && row.time === 3.9) || errors.length)
    throw Error(`Latest plane not computed from paused run: ${JSON.stringify({ final, errors })}`);
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A1/A1-FULL-007/after-slow-latest.png' });
  return { during, final, errors };
}
