// Run against `pnpm preview --port 5182` after `pnpm check`.
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5182/');
  const vehicle = page.getByRole('combobox', { name: '动力类型' });
  const enter = page.getByRole('button', { name: '打开写实 SUV 外观范例' });
  const leave = page.getByRole('button', { name: '返回四类动力教学模型和声学实验' });
  await vehicle.selectOption('bev');
  await enter.click(); await leave.waitFor();
  const bev = await page.locator('.lab-showroom-panel strong').innerText();
  await leave.click();
  await vehicle.selectOption('ice');
  await enter.click(); await leave.waitFor();
  const ice = await page.locator('.lab-showroom-panel strong').innerText();
  const assets = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(resource => resource.name.endsWith('.glb'))
    .map(resource => resource.name));
  const externalResources = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(resource => !resource.name.startsWith(location.origin))
    .map(resource => resource.name));
  return { bev, ice, assets, externalResources, pageErrors: errors };
}
