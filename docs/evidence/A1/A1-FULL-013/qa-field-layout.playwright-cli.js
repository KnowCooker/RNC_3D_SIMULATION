// pnpm dev --host 127.0.0.1 --port 5173
// npx --yes --package @playwright/cli playwright-cli --session a1full013field run-code --filename docs/evidence/A1/A1-FULL-013/qa-field-layout.playwright-cli.js
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#lab-viewer canvas').waitFor();
  await page.locator('#lab-mode').selectOption('replay');
  await page.locator('#lab-duration').selectOption('10');
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-calculate').click({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  await page.locator('#lab-seek').fill('10');
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('教学布局声场截至 10.00 s'), undefined, { timeout: 30000 });
  const replay = {
    run: await page.locator('#lab-run').textContent(),
    field: await page.locator('#lab-field-status').textContent(),
    time: await page.locator('#lab-seek').inputValue(),
  };
  await page.locator('.lab-workspace').screenshot({ path: 'docs/evidence/A1/A1-FULL-013/layout-field-identity-replay.png', timeout: 30000 });
  await page.locator('#lab-mode').selectOption('live');
  await page.locator('#lab-calculate').click({ timeout: 30000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('#lab-field-status')?.textContent ?? '';
    const seconds = Number(status.match(/截至 ([\d.]+) s/)?.[1]);
    return status.includes('教学布局声场') && seconds >= 2;
  }, undefined, { timeout: 30000 });
  const live = {
    run: await page.locator('#lab-run').textContent(),
    field: await page.locator('#lab-field-status').textContent(),
    status: await page.locator('#lab-status').textContent(),
  };
  await page.locator('.lab-workspace').screenshot({ path: 'docs/evidence/A1/A1-FULL-013/layout-field-identity-live.png', timeout: 30000 });
  if (errors.length || !replay.run?.includes('teaching-fixed-v1') || !live.run?.includes('teaching-fixed-v1') || !live.status?.includes('实时运行')) {
    throw new Error(JSON.stringify({ errors, replay, live }));
  }
  return { errors, replay, live };
}
