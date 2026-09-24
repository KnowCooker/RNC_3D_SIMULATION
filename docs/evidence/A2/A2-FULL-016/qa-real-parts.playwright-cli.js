// playwright-cli run-code --filename docs/evidence/A2/A2-FULL-016/qa-real-parts.playwright-cli.js
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5181/');
  await page.getByRole('combobox', { name: '动力类型' }).selectOption('ice');
  await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
  const workshop = page.getByRole('button', { name: '车间三维场景' });
  const road = page.getByRole('button', { name: '道路三维场景' });
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).waitFor();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-road-ice.png' });
  await workshop.click();
  const panel = page.locator('.lab-showroom-assembly');
  const count = await panel.locator('.lab-assembly-list button').count();
  const roadStageVisible = await page.locator('.lab-stage-switch').isVisible();
  const markersHidden = await page.locator('.lab-marker:not([hidden])').count() === 0;
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-workshop-assembled.png' });
  await panel.locator('[data-part="hood"]').click();
  await panel.locator('[data-part="door-left"]').click();
  await page.waitForTimeout(1000);
  const afterTwo = await panel.locator('p').innerText();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-workshop-two-parts.png' });
  await road.click(); await workshop.click();
  const stateAcrossStages = await panel.locator('p').innerText();
  await panel.getByRole('button', { name: '逆序回装' }).click();
  const afterOne = await panel.locator('p').innerText();
  await panel.getByRole('button', { name: '自动回装' }).click();
  await page.waitForTimeout(1200);
  const afterAuto = await panel.locator('p').innerText();
  await panel.locator('[data-part="interior"]').click();
  await page.waitForTimeout(850);
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-workshop-interior.png' });
  await page.locator('#lab-reset').click();
  const afterReset = await panel.locator('p').innerText();
  const meshAudit = await page.evaluate(async () => {
    const { loadShowroomModel } = await import('/src/team-a/viewer/showroom-model.ts');
    const model = await loadShowroomModel('ice');
    let meshes = 0;
    const geometries = new Set(), materials = new Set();
    model.group.traverse(object => {
      if (!object.isMesh) return;
      meshes++; geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    const rows = model.parts.map(part => {
      const pivot = model.group.getObjectByName(`assembly-${part.id}`);
      const before = pivot?.position.clone();
      model.setPartProgress(part.id, 1);
      return { id: part.id, meshCount: pivot?.children.length ?? 0, displacement: pivot && before ? pivot.position.distanceTo(before) : 0 };
    });
    const disposalCounts = new Map();
    for (const resource of [...geometries, ...materials]) {
      disposalCounts.set(resource, 0);
      resource.addEventListener('dispose', () => disposalCounts.set(resource, disposalCounts.get(resource) + 1));
    }
    model.dispose();
    return { meshes, rows, geometryCount: geometries.size, materialCount: materials.size, resourcesDisposedOnce: [...disposalCounts.values()].every(count => count === 1) };
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-workshop-narrow.png' });
  const narrowClosed = await panel.evaluate(element => !element.open);
  await panel.locator('summary').click();
  const narrowUsable = await panel.locator('[data-part="hood"]').isVisible();
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).click();
  await page.setViewportSize({ width: 1600, height: 900 });
  const vehicle = page.getByRole('combobox', { name: '动力类型' });
  const fallbackPartsHidden = [];
  for (const kind of ['hev', 'erev', 'bev']) {
    await vehicle.selectOption(kind);
    await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
    await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).waitFor();
    await workshop.click();
    fallbackPartsHidden.push({ kind, hidden: await panel.isHidden() });
    await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).click();
  }
  const externalResources = await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => !resource.name.startsWith(location.origin)).map(resource => resource.name));
  if (count !== 10 || !roadStageVisible || !markersHidden || !afterTwo.startsWith('已拆 2') || stateAcrossStages !== afterTwo || !afterOne.startsWith('已拆 1') || !afterAuto.startsWith('已拆 0') || !afterReset.startsWith('已拆 0') || meshAudit.meshes !== 171 || meshAudit.rows.some(row => row.meshCount < 1 || row.displacement < 0.25) || !meshAudit.resourcesDisposedOnce || !narrowClosed || !narrowUsable || fallbackPartsHidden.some(row => !row.hidden) || errors.length || externalResources.length) {
    throw new Error(JSON.stringify({ count, roadStageVisible, markersHidden, afterTwo, stateAcrossStages, afterOne, afterAuto, afterReset, meshAudit, narrowClosed, narrowUsable, fallbackPartsHidden, errors, externalResources }));
  }
  return { count, roadStageVisible, markersHidden, afterTwo, stateAcrossStages, afterOne, afterAuto, afterReset, meshAudit, narrowClosed, narrowUsable, fallbackPartsHidden, errors, externalResources };
}
