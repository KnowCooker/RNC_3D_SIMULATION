// Production build: PORT=5188 pnpm start
// npx --yes --package @playwright/cli playwright-cli -s=a1-config-identity run-code --filename docs/evidence/A1/A1-FULL-013/config-identity/verify.playwright-cli.js
async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5188/');
  await page.locator('#lab-viewer canvas').waitFor();
  await page.locator('#lab-mode').selectOption('replay');
  await page.locator('#lab-duration').selectOption('10');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  const replay = {
    run: await page.locator('#lab-run').textContent(),
    status: await page.locator('#lab-status').textContent(),
  };
  await page.locator('#lab-mode').selectOption('live');
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实时运行'), undefined, { timeout: 30000 });
  const started = {
    run: await page.locator('#lab-run').textContent(),
    status: await page.locator('#lab-status').textContent(),
  };
  await page.locator('#lab-rnc-on').click();
  await page.waitForFunction(() => document.querySelector('#lab-rnc-on')?.getAttribute('aria-pressed') === 'false' && document.querySelector('#lab-audition-state')?.textContent?.includes('权重冻结'), undefined, { timeout: 30000 });
  const off = {
    status: await page.locator('#lab-status').textContent(),
    audition: await page.locator('#lab-audition-state').textContent(),
  };
  await page.locator('#lab-rnc-on').click();
  await page.waitForFunction(() => document.querySelector('#lab-rnc-on')?.getAttribute('aria-pressed') === 'true' && document.querySelector('#lab-audition-state')?.textContent?.includes('自适应控制'), undefined, { timeout: 30000 });
  await page.waitForFunction(() => {
    const status = document.querySelector('#lab-field-status')?.textContent ?? '';
    const seconds = Number(status.match(/截至 ([\d.]+) s/)?.[1]);
    return status.includes('教学布局声场') && seconds >= 2;
  }, undefined, { timeout: 30000 });
  const on = {
    status: await page.locator('#lab-status').textContent(),
    audition: await page.locator('#lab-audition-state').textContent(),
    field: await page.locator('#lab-field-status').textContent(),
  };
  await page.locator('.lab-workspace').screenshot({ path: 'docs/evidence/A1/A1-FULL-013/config-identity/live-rnc-restored.png' });
  if (errors.length || !replay.run?.includes('teaching-fixed-v1') || !started.run?.includes('teaching-fixed-v1') || !off.status?.includes('实时运行') || !on.status?.includes('实时运行')) {
    throw new Error(JSON.stringify({ errors, replay, started, off, on }));
  }
  return { errors, replay, started, off, on };
}
