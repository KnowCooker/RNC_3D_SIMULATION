async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5183/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  const run = await page.locator('#lab-run').textContent();
  await page.locator('#lab-body').selectOption('hidden');
  await page.locator('.lab-part-picker select').selectOption('cockpit');
  const guide = await page.locator('.lab-part-card').textContent();
  if (!guide?.includes('屏幕图形仅作车辆控制件示意')) throw Error(`Cockpit guide missing: ${guide}`);
  await page.locator('.lab-part-card button').click();
  await page.waitForTimeout(300);
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-012/full-app-zoomed-cabin.png' });
  const near = await page.evaluate(() => {
    const host = document.querySelector('#lab-viewer'), gl = host.querySelector('canvas').getContext('webgl2');
    return { body: document.querySelector('#lab-body').value, run: document.querySelector('#lab-run').textContent,
      markerCount: [...host.querySelectorAll('.lab-marker')].filter(marker => !marker.hidden).length,
      contextLost: gl.isContextLost() };
  });
  await page.locator('#lab-body').selectOption('solid');
  await page.waitForTimeout(250);
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-012/full-app-solid-after-cabin.png' });
  const solid = await page.evaluate(() => ({ body: document.querySelector('#lab-body').value, run: document.querySelector('#lab-run').textContent }));
  if (errors.length || near.body !== 'hidden' || solid.body !== 'solid' || near.run !== run || solid.run !== run || near.contextLost) throw Error(JSON.stringify({ errors, near, solid }));
  return { run, guide, near, solid, errors };
}
