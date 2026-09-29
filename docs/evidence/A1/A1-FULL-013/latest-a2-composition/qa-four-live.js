async (page) => {
  const errors = [], failures = [], cases = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push({ url: request.url(), reason: request.failure()?.errorText }));
  await page.goto('http://127.0.0.1:5186/');
  await page.locator('#lab-viewer canvas').waitFor();
  await page.locator('#lab-mode').selectOption('replay');
  await page.locator('#lab-duration').selectOption('10');
  await page.locator('#lab-field').selectOption('residual');
  for (const vehicle of ['ice', 'bev', 'hev', 'erev']) {
    await page.locator('#lab-vehicle').selectOption(vehicle);
    await page.locator('#lab-calculate').click({ timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 45000 });
    await page.locator('#lab-seek').fill('10');
    await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('教学布局声场截至 10.00 s'), undefined, { timeout: 45000 });
    const run = await page.locator('#lab-run').textContent();
    const field = await page.locator('#lab-field-status').textContent();
    if (!run?.includes('teaching-fixed-v1')) throw new Error(`${vehicle}: no physical layout identity`);
    cases.push({ vehicle, run, field });
  }
  await page.locator('#lab-mode').selectOption('live');
  await page.locator('#lab-vehicle').selectOption('bev');
  await page.locator('#lab-calculate').click({ timeout: 30000 });
  await page.waitForFunction(() => {
    const value = document.querySelector('#lab-field-status')?.textContent ?? '';
    const seconds = Number(value.match(/截至 ([\d.]+) s/)?.[1] ?? 0);
    return value.includes('教学布局声场') && seconds >= 2;
  }, undefined, { timeout: 45000 });
  const live = { run: await page.locator('#lab-run').textContent(), field: await page.locator('#lab-field-status').textContent(), status: await page.locator('#lab-status').textContent() };
  await page.locator('#lab-rnc-on').click();
  await page.waitForFunction(() => document.querySelector('#lab-audition-state')?.textContent?.includes('权重冻结'), undefined, { timeout: 30000 });
  const off = { status: await page.locator('#lab-status').textContent(), audition: await page.locator('#lab-audition-state').textContent() };
  await page.locator('#lab-rnc-on').click();
  await page.waitForFunction(() => document.querySelector('#lab-audition-state')?.textContent?.includes('自适应控制'), undefined, { timeout: 30000 });
  const on = { status: await page.locator('#lab-status').textContent(), audition: await page.locator('#lab-audition-state').textContent(), field: await page.locator('#lab-field-status').textContent() };
  await page.locator('.lab-workspace').screenshot({ path: 'output/playwright/latest-bev-live.png' });
  if (errors.length || failures.length || !live.run?.includes('teaching-fixed-v1') || !off.status?.includes('实时运行') || !on.status?.includes('实时运行')) throw new Error(JSON.stringify({ cases, live, off, on, errors, failures }));
  return { cases, live, off, on, errors, failures };
}
