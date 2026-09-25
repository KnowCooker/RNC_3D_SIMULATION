// playwright-cli run-code --filename docs/evidence/A2/A2-FULL-016/qa-stage.playwright-cli.js
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5181/');
  const road = page.getByRole('button', { name: '道路三维场景' });
  const workshop = page.getByRole('button', { name: '车间三维场景' });
  const stage = page.locator('.lab-stage-switch');
  const vehicle = page.getByRole('combobox', { name: '动力类型' });
  const counts = [];
  for (const kind of ['ice', 'bev', 'hev', 'erev']) {
    await vehicle.selectOption(kind);
    await road.click();
    const roadMarkers = await page.locator('.lab-marker:not([hidden])').count();
    await workshop.click();
    const workshopMarkers = await page.locator('.lab-marker:not([hidden])').count();
    counts.push({ kind, roadMarkers, workshopMarkers });
  }
  await vehicle.selectOption('bev');
  await page.locator('#lab-body').selectOption('solid');
  await road.click();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/road-stage-bev.png' });
  await page.locator('#lab-body').selectOption('transparent');
  await workshop.click();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/workshop-stage-bev.png' });
  await page.locator('#lab-explode').click();
  await road.click();
  const explodePreserved = (await page.locator('#lab-explode').getAttribute('aria-pressed')) === 'true';
  await workshop.click();
  await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
  const leave = page.getByRole('button', { name: '返回四类动力教学模型和声学实验' });
  await leave.waitFor();
  const stageVisibleWithSameAsset = await stage.isVisible();
  await leave.click();
  const workshopRestored = (await workshop.getAttribute('aria-pressed')) === 'true';
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/workshop-stage-narrow.png' });
  const narrowButtonsVisible = await road.isVisible() && await workshop.isVisible();
  const teachingPanel = page.locator('.lab-assembly-panel:not(.lab-showroom-assembly)');
  const narrowAssemblyClosed = await teachingPanel.evaluate(panel => !panel.open);
  await teachingPanel.locator('summary').click();
  const narrowAssemblyUsable = await teachingPanel.locator('.lab-assembly-list button').first().isVisible();
  const externalResources = await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => !resource.name.startsWith(location.origin)).map(resource => resource.name));
  if (errors.length || externalResources.length || counts.some(row => row.roadMarkers !== 16 || row.workshopMarkers !== 16) || !explodePreserved || !stageVisibleWithSameAsset || !workshopRestored || !narrowButtonsVisible || !narrowAssemblyClosed || !narrowAssemblyUsable) {
    throw new Error(JSON.stringify({ errors, externalResources, counts, explodePreserved, stageVisibleWithSameAsset, workshopRestored, narrowButtonsVisible, narrowAssemblyClosed, narrowAssemblyUsable }));
  }
  return { counts, explodePreserved, stageVisibleWithSameAsset, workshopRestored, narrowButtonsVisible, narrowAssemblyClosed, narrowAssemblyUsable, externalResources, errors };
}
