// playwright-cli run-code --filename docs/evidence/A2/A2-FULL-016/qa-assembly.playwright-cli.js
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5181/');
  const vehicle = page.getByRole('combobox', { name: '动力类型' });
  const road = page.getByRole('button', { name: '道路三维场景' });
  const workshop = page.getByRole('button', { name: '车间三维场景' });
  const panel = page.locator('.lab-assembly-panel:not(.lab-showroom-assembly)');
  const anchor = async index => page.locator('.lab-marker-leaders line').nth(index).evaluate(line => [Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))]);
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const partsByVehicle = [];
  for (const kind of ['ice', 'bev', 'hev', 'erev']) {
    await vehicle.selectOption(kind);
    await workshop.click();
    partsByVehicle.push({ kind, count: await panel.locator('.lab-assembly-list button').count() });
  }
  await vehicle.selectOption('bev');
  const beforeMic = await anchor(8), beforeSpeaker = await anchor(4);
  await panel.locator('[data-part="seat-1"]').click();
  await panel.locator('[data-part="door-front-1"]').click();
  await page.waitForTimeout(850);
  const micMovePx = distance(beforeMic, await anchor(8));
  const speakerMovePx = distance(beforeSpeaker, await anchor(4));
  const afterTwo = await panel.locator('p').innerText();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/workshop-two-parts.png' });
  await road.click(); await workshop.click();
  const stateAcrossScenes = await panel.locator('p').innerText();
  await panel.getByRole('button', { name: '逆序回装' }).click();
  const afterOne = await panel.locator('p').innerText();
  await panel.getByRole('button', { name: '自动回装' }).click();
  await page.waitForTimeout(1100);
  const afterReverse = await panel.locator('p').innerText();
  await panel.getByRole('button', { name: '自动拆解' }).click();
  await page.waitForTimeout(1800);
  const autoCount = Number((await panel.locator('p').innerText()).match(/已拆 (\d+)/)?.[1] ?? -1);
  await panel.getByRole('button', { name: '暂停自动拆解' }).click();
  await page.locator('#lab-reset').click();
  const afterReset = await panel.locator('p').innerText();
  const externalResources = await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => !resource.name.startsWith(location.origin)).map(resource => resource.name));
  const expectedCounts = { ice: 33, bev: 33, hev: 36, erev: 37 };
  if (errors.length || externalResources.length || partsByVehicle.some(row => row.count !== expectedCounts[row.kind]) || micMovePx < 3 || speakerMovePx < 3 || !afterTwo.startsWith('已拆 2') || !stateAcrossScenes.startsWith('已拆 2') || !afterOne.startsWith('已拆 1') || !afterReverse.startsWith('已拆 0') || autoCount < 1 || !afterReset.startsWith('已拆 0')) {
    throw new Error(JSON.stringify({ errors, externalResources, partsByVehicle, micMovePx, speakerMovePx, afterTwo, stateAcrossScenes, afterOne, afterReverse, autoCount, afterReset }));
  }
  return { partsByVehicle, micMovePx, speakerMovePx, afterTwo, stateAcrossScenes, afterOne, afterReverse, autoCount, afterReset, externalResources, errors };
}
