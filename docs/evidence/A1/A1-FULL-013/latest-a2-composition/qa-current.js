async (page) => {
  const errors = [];
  const failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push({ url: request.url(), reason: request.failure()?.errorText }));
  await page.goto('http://127.0.0.1:5186/');
  await page.locator('#lab-viewer canvas').waitFor();
  await page.locator('#lab-vehicle').selectOption('ice');
  await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
  await page.getByText('同车结构检视').click();
  const asset = page.getByText('Range Rover Sport SVR · 同车外观验证');
  if (!(await asset.isVisible())) throw new Error('ICE showroom asset is not visible');
  const part = page.getByRole('combobox', { name: '选择写实车部件' });
  await part.selectOption({ label: '左前座椅与头枕' });
  await page.getByRole('button', { name: '拆出所选部件' }).click();
  await page.getByRole('button', { name: '回装所选部件' }).waitFor();
  await page.getByRole('button', { name: '车间三维场景' }).click();
  if (!(await asset.isVisible())) throw new Error('ICE asset disappeared in workshop');
  await page.getByRole('combobox', { name: '写实车外壳' }).selectOption({ label: '透明' });
  await page.getByRole('combobox', { name: '写实车剖面' }).selectOption({ label: '纵向 X' });
  await page.locator('.lab-workspace').screenshot({ path: 'output/playwright/latest-ice-workshop.png' });
  await page.getByRole('button', { name: '道路三维场景' }).click();
  if (!(await asset.isVisible())) throw new Error('ICE asset disappeared on road');
  await page.getByRole('button', { name: '恢复同车视图与回装' }).click();
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).click();
  await page.locator('#lab-mode').selectOption('replay');
  await page.locator('#lab-duration').selectOption('10');
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-calculate').click({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 45000 });
  await page.locator('#lab-seek').fill('10');
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('教学布局声场截至 10.00 s'), undefined, { timeout: 45000 });
  const report = {
    source: 'A1 c26cc3b + A2 d8e2717',
    asset: await asset.count(),
    mode: await page.locator('#lab-mode').inputValue(),
    run: await page.locator('#lab-run').textContent(),
    status: await page.locator('#lab-status').textContent(),
    field: await page.locator('#lab-field-status').textContent(),
    errors,
    failures,
  };
  await page.locator('.lab-workspace').screenshot({ path: 'output/playwright/latest-ice-field.png' });
  if (errors.length || failures.length || !report.run?.includes('teaching-fixed-v1')) throw new Error(JSON.stringify(report));
  return report;
}
