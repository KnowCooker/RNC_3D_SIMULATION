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
  await panel.locator('[data-part="hood"]').click();
  await panel.locator('[data-part="engine-bay"]').click();
  await page.waitForTimeout(850);
  const afterEngine = await panel.locator('p').innerText();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-workshop-engine-bay.png' });
  await page.locator('#lab-reset').click();
  await panel.locator('[data-part="interior"]').click();
  await page.waitForTimeout(850);
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-workshop-interior.png' });
  await page.locator('#lab-reset').click();
  const afterReset = await panel.locator('p').innerText();
  for (const corner of ['fl', 'fr', 'rl', 'rr']) await panel.locator(`[data-part="wheel-${corner}"]`).click();
  await page.waitForTimeout(850);
  const afterFourWheels = await panel.locator('p').innerText();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-workshop-four-wheels.png' });
  await page.locator('#lab-reset').click();
  await panel.getByRole('button', { name: '自动拆解' }).click();
  await page.waitForFunction(() => document.querySelector('.lab-showroom-assembly p')?.textContent?.startsWith('已拆 27'), undefined, { timeout: 30000 });
  await page.waitForTimeout(850);
  const afterFullDetach = await panel.locator('p').innerText();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-workshop-all-parts.png' });
  await panel.getByRole('button', { name: '自动回装' }).click();
  await page.waitForFunction(() => document.querySelector('.lab-showroom-assembly p')?.textContent?.startsWith('已拆 0'), undefined, { timeout: 30000 });
  await page.waitForTimeout(850);
  const afterFullRestore = await panel.locator('p').innerText();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/real-workshop-restored.png' });
  const meshAudit = await page.evaluate(async () => {
    const { loadShowroomModel } = await import('/src/team-a/viewer/showroom-model.ts');
    const model = await loadShowroomModel('ice');
    let meshes = 0, triangles = 0;
    const geometries = new Set(), materials = new Set();
    model.group.traverse(object => {
      if (!object.isMesh) return;
      meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; geometries.add(object.geometry);
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
    return { meshes, triangles, rows, geometryCount: geometries.size, materialCount: materials.size, resourcesDisposedOnce: [...disposalCounts.values()].every(count => count === 1) };
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
  const authoredCounts = { 'fender-front-left': 4, 'fender-front-right': 4, 'headlight-left': 6, 'headlight-right': 6, 'front-inner-panels': 1, 'taillight-left': 5, 'taillight-right': 5, 'rear-quarters': 5, 'rear-inner-panels': 2, 'side-skirts': 4, glazing: 6, 'engine-bay': 1, 'chassis-shell': 1 };
  if (count !== 27 || !roadStageVisible || !markersHidden || !afterTwo.startsWith('已拆 2') || stateAcrossStages !== afterTwo || !afterOne.startsWith('已拆 1') || !afterAuto.startsWith('已拆 0') || !afterEngine.startsWith('已拆 2') || !afterReset.startsWith('已拆 0') || !afterFourWheels.startsWith('已拆 4') || !afterFullDetach.startsWith('已拆 27') || !afterFullRestore.startsWith('已拆 0') || meshAudit.meshes !== 180 || meshAudit.triangles !== 74127 || meshAudit.rows.some(row => row.meshCount < 1 || row.displacement < 0.25 || (row.id.startsWith('wheel-') && row.meshCount !== 7) || (row.id in authoredCounts && row.meshCount !== authoredCounts[row.id])) || !meshAudit.resourcesDisposedOnce || !narrowClosed || !narrowUsable || fallbackPartsHidden.some(row => !row.hidden) || errors.length || externalResources.length) {
    throw new Error(JSON.stringify({ count, roadStageVisible, markersHidden, afterTwo, stateAcrossStages, afterOne, afterAuto, afterEngine, afterReset, afterFourWheels, afterFullDetach, afterFullRestore, meshAudit, narrowClosed, narrowUsable, fallbackPartsHidden, errors, externalResources }));
  }
  return { count, roadStageVisible, markersHidden, afterTwo, stateAcrossStages, afterOne, afterAuto, afterEngine, afterReset, afterFourWheels, afterFullDetach, afterFullRestore, meshAudit, narrowClosed, narrowUsable, fallbackPartsHidden, errors, externalResources };
}
