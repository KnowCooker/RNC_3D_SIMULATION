async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5184/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  await page.evaluate(() => {
    const seek = document.querySelector('#lab-seek'); seek.value = '3.9'; seek.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#lab-section').selectOption('x');
  await page.locator('#lab-field-slice').selectOption('x');
  await page.locator('#lab-field').selectOption('residual');
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('空间窗口截至'));
  const initial = await page.evaluate(() => ({ run: document.querySelector('#lab-run').textContent,
    time: document.querySelector('#lab-time').textContent, status: document.querySelector('#lab-field-status').textContent,
    section: document.querySelector('#lab-section-position').value }));
  await page.evaluate(() => {
    const slider = document.querySelector('#lab-section-position'); slider.value = '0.6'; slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(1000);
  const moved = await page.evaluate(() => ({ run: document.querySelector('#lab-run').textContent,
    time: document.querySelector('#lab-time').textContent, status: document.querySelector('#lab-field-status').textContent,
    section: document.querySelector('#lab-section-position').value }));
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A1/A1-FULL-007/before-paused-moved.png' });
  return { initial, moved };
}
