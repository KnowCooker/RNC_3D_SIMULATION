// playwright-cli run-code --filename docs/evidence/A2/A2-FULL-016/qa.playwright-cli.js
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5176/');
  const viewer = page.locator('#lab-viewer');
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/technical-before.png' });
  await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).waitFor();
  const inShowroom = {
    panel: await page.locator('.lab-showroom-panel').isVisible(),
    visibleMarkers: await page.locator('.lab-marker:not([hidden])').count(),
    modelLoads: await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => resource.name.includes('range-rover-sport-svr')).length),
    externalResources: await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => !resource.name.startsWith(location.origin)).map(resource => resource.name)),
  };
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/showroom-viewer-front.png' });
  await page.getByRole('button', { name: '侧面' }).click();
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/showroom-viewer-side.png' });
  await page.getByRole('button', { name: '后侧' }).click();
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/showroom-viewer-rear.png' });
  await page.getByRole('button', { name: '珍珠白车漆' }).click();
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/showroom-viewer-white.png' });
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).click();
  await viewer.screenshot({ path: 'docs/evidence/A2/A2-FULL-016/technical-return.png' });
  const onReturn = {
    panelHidden: await page.locator('.lab-showroom-panel').isHidden(),
    visibleMarkers: await page.locator('.lab-marker:not([hidden])').count(),
  };
  await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).waitFor();
  await page.getByRole('combobox', { name: '动力类型' }).selectOption({ label: '纯燃油 SUV' });
  const onVehicleChange = {
    panelHidden: await page.locator('.lab-showroom-panel').isHidden(),
    visibleMarkers: await page.locator('.lab-marker:not([hidden])').count(),
    selectedVehicle: await page.getByRole('combobox', { name: '动力类型' }).inputValue(),
  };
  return { inShowroom, onReturn, onVehicleChange, pageErrors: errors };
}
