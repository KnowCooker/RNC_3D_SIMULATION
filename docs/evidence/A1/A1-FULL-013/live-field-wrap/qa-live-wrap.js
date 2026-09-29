// Production build: PORT=5194 pnpm start
// npx --yes --package @playwright/cli playwright-cli -s=a1-field-wrap run-code --filename docs/evidence/A1/A1-FULL-013/live-field-wrap/qa-live-wrap.js
async (page) => {
  const errors = [], failedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => {
    if (!request.url().endsWith('/favicon.ico')) failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  await page.goto('http://127.0.0.1:5194/');
  await page.locator('#lab-viewer canvas').waitFor();
  await page.selectOption('#lab-mode', 'live');
  await page.selectOption('#lab-field', 'residual');
  await page.click('#lab-calculate');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实时运行'), undefined, { timeout: 30000 });
  const samples = [];
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(3000);
    const sample = {
      clock: await page.locator('#lab-time').textContent(),
      field: await page.locator('#lab-field-status').textContent(),
      window: await page.locator('#lab-field-evidence-window').textContent(),
      evidenceVisible: await page.locator('#lab-field-evidence').isVisible(),
      run: await page.locator('#lab-run').textContent(),
    };
    if (!sample.field?.includes('教学布局声场截至') || !sample.evidenceVisible || !sample.window?.includes('A 计权')) {
      throw new Error(`live field failed after history moved: ${JSON.stringify(sample)}`);
    }
    samples.push(sample);
  }
  await page.selectOption('#lab-field-weight', 'Z');
  await page.waitForFunction(() => document.querySelector('#lab-field-evidence-window')?.textContent?.includes('Z 计权'), undefined, { timeout: 30000 });
  const z = await page.locator('#lab-field-evidence-window').textContent();
  await page.selectOption('#lab-field-weight', 'A');
  await page.waitForFunction(() => document.querySelector('#lab-field-evidence-window')?.textContent?.includes('A 计权'), undefined, { timeout: 30000 });
  const a = await page.locator('#lab-field-evidence-window').textContent();
  if (errors.length || failedRequests.length) throw new Error(JSON.stringify({ errors, failedRequests }));
  await page.locator('.lab-workspace').screenshot({ path: 'docs/evidence/A1/A1-FULL-013/live-field-wrap/after-27s.png' });
  return { samples, z, a, errors, failedRequests };
}
