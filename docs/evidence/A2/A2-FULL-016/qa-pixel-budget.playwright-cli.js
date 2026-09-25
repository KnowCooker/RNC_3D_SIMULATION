// Run against `pnpm dev --port 5181`. Drawing-buffer budget is 1280×720 pixels.
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cases = [];
  for (const [width, height] of [[1920, 1080], [1600, 900], [360, 800]]) {
    await page.setViewportSize({ width, height });
    if (!cases.length) await page.goto('http://127.0.0.1:5181/');
    await page.waitForTimeout(300);
    const current = await page.evaluate(() => {
      const canvas = document.querySelector('#lab-viewer canvas');
      const rect = canvas.getBoundingClientRect();
      return {
        css: [rect.width, rect.height],
        buffer: [canvas.width, canvas.height],
        devicePixelRatio,
        markers: document.querySelectorAll('.lab-marker:not([hidden])').length,
      };
    });
    cases.push({ viewport: [width, height], ...current,
      withinBudget: current.buffer[0] * current.buffer[1] <= 1280 * 720 });
    if (width === 1920) {
      await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent.includes('实验就绪'));
      await page.locator('.lab-marker:visible').first().click();
      cases.at(-1).selectedSignal = await page.locator('#lab-signal-title').innerText();
      await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
      await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).waitFor();
      await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/showroom-pixel-budget.png' });
      await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).click();
    }
    if (width === 360) await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/technical-narrow-pixel-budget.png' });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 2, mobile: false });
  await page.waitForTimeout(300);
  const highDpi = await page.evaluate(() => {
    const canvas = document.querySelector('#lab-viewer canvas');
    return { devicePixelRatio, css: [canvas.clientWidth, canvas.clientHeight], buffer: [canvas.width, canvas.height] };
  });
  highDpi.withinBudget = highDpi.buffer[0] * highDpi.buffer[1] <= 1280 * 720;
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  return { cases, highDpi, pageErrors: errors };
}
