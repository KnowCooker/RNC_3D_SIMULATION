async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), { timeout: 30000 });
  await page.locator('#lab-body').selectOption('hidden');
  await page.locator('#lab-explode').click();
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => ({
    vehicle: document.querySelector('#lab-vehicle').value,
    status: document.querySelector('#lab-status').textContent,
    exploded: document.querySelector('#lab-explode').getAttribute('aria-pressed'),
    markers: document.querySelectorAll('.lab-marker').length,
    canvas: document.querySelector('#lab-viewer canvas')?.getBoundingClientRect().toJSON(),
  }));
  await page.screenshot({ path: 'docs/evidence/A2/A2-FULL-004/full-app-bev-open.png', fullPage: true });
  await page.locator('#lab-vehicle').selectOption('erev');
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => ({
    vehicle: document.querySelector('#lab-vehicle').value,
    status: document.querySelector('#lab-status').textContent,
    markers: document.querySelectorAll('.lab-marker').length,
  }));
  await page.screenshot({ path: 'docs/evidence/A2/A2-FULL-004/full-app-erev-open.png', fullPage: true });
  if (before.vehicle !== 'bev' || before.exploded !== 'true' || before.markers < 12 || !before.canvas?.width || after.vehicle !== 'erev' || after.markers < 12 || !after.status.includes('配置已改变')) {
    throw Error(`full app mismatch: ${JSON.stringify({ before, after })}`);
  }
  return { before, after };
}
