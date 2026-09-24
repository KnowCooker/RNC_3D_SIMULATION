// playwright-cli run-code --filename docs/evidence/A2/A2-FULL-016/qa-stage-production.playwright-cli.js
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5182/');
  await page.getByRole('button', { name: '车间三维场景' }).click();
  const panel = page.locator('.lab-assembly-panel');
  await panel.locator('[data-part="seat-1"]').click();
  const state = await panel.locator('p').innerText();
  await page.getByRole('button', { name: '道路三维场景' }).click();
  await page.getByRole('button', { name: '车间三维场景' }).click();
  const retained = await panel.locator('p').innerText();
  const markers = await page.locator('.lab-marker:not([hidden])').count();
  const externalResources = await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => !resource.name.startsWith(location.origin)).map(resource => resource.name));
  if (!state.startsWith('已拆 1') || retained !== state || markers !== 16 || externalResources.length || errors.length) throw new Error(JSON.stringify({ state, retained, markers, externalResources, errors }));
  return { state, retained, markers, externalResources, errors };
}
