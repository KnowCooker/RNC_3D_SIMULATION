// playwright-cli run-code --filename docs/evidence/A2/A2-FULL-016/qa-two-models.playwright-cli.js
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5181/');
  const viewer = page.locator('#lab-viewer');
  const vehicle = page.getByRole('combobox', { name: '动力类型' });
  const enter = page.getByRole('button', { name: '打开写实 SUV 外观范例' });
  const leave = page.getByRole('button', { name: '返回四类动力教学模型和声学实验' });
  await vehicle.selectOption('bev');
  await enter.click();
  await leave.waitFor();
  await page.waitForTimeout(400);
  const bev = {
    heading: await page.locator('.lab-showroom-panel strong').innerText(),
    credit: await page.locator('.lab-showroom-panel a').innerText(),
    panel: await page.locator('.lab-showroom-panel').isVisible(),
    modelLoads: await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => resource.name.includes('tesla-model-y.meshopt')).length),
  };
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/bev-model-y-front.png' });
  await page.getByRole('button', { name: '侧面' }).click();
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/bev-model-y-side.png' });
  await page.getByRole('button', { name: '后侧' }).click();
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/bev-model-y-rear.png' });
  await leave.click();
  await vehicle.selectOption('ice');
  await enter.click();
  await leave.waitFor();
  const ice = {
    heading: await page.locator('.lab-showroom-panel strong').innerText(),
    modelLoads: await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => resource.name.includes('range-rover-sport-svr')).length),
  };
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/ice-range-rover-after-switch.png' });
  await leave.click();
  await vehicle.selectOption('hev');
  await enter.click();
  await leave.waitFor();
  const hev = {
    heading: await page.locator('.lab-showroom-panel strong').innerText(),
    disclosure: await page.locator('.lab-showroom-panel p').innerText(),
  };
  await leave.click();
  await vehicle.selectOption('erev');
  await enter.click();
  await leave.waitFor();
  const erev = {
    heading: await page.locator('.lab-showroom-panel strong').innerText(),
    disclosure: await page.locator('.lab-showroom-panel p').innerText(),
  };
  await leave.click();
  await page.waitForTimeout(350);
  const restoredMarkers = await page.locator('.lab-marker:not([hidden])').count();
  const externalResources = await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => !resource.name.startsWith(location.origin)).map(resource => resource.name));
  return { bev, ice, hev, erev, restoredMarkers, externalResources, pageErrors: errors };
}
