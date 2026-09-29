async (page) => {
  const errors = [], failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push({ url: request.url(), reason: request.failure()?.errorText }));
  await page.goto('http://127.0.0.1:5187/');
  await page.locator('#lab-viewer canvas').waitFor();
  await page.locator('#lab-mode').selectOption('replay');
  await page.locator('#lab-duration').selectOption('10');
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  await page.locator('#lab-seek').fill('10');
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('教学布局声场截至 10.00 s'), undefined, { timeout: 30000 });
  const currentRun = await page.locator('#lab-run').textContent();
  const currentField = await page.locator('#lab-field-status').textContent();
  await page.locator('details.lab-case-evidence summary').click();
  await page.locator('#lab-case-import').setInputFiles('docs/evidence/A1/A1-FULL-013/import-boundary/unknown-layout-case.json');
  await page.waitForFunction(() => document.querySelector('#lab-case-evidence-state')?.textContent?.includes('已只读导入'));
  const foreign = {
    status: await page.locator('#lab-case-evidence-state').textContent(),
    summary: await page.locator('#lab-case-imported p').first().textContent(),
    deltas: await page.locator('#lab-case-imported tr td:last-child').allTextContents(),
    text: await page.locator('#lab-case-imported').textContent(),
    currentRun: await page.locator('#lab-run').textContent(),
    currentField: await page.locator('#lab-field-status').textContent(),
  };
  await page.locator('#lab-case').screenshot({ path: 'output/playwright/foreign-layout-readonly.png' });
  await page.locator('#lab-case-import').setInputFiles('docs/evidence/A1/A1-FULL-012/example-review.json');
  await page.waitForFunction(() => document.querySelector('#lab-case-evidence-state')?.textContent?.includes('已导入 example-review.json'));
  const legacy = {
    status: await page.locator('#lab-case-evidence-state').textContent(),
    deltas: await page.locator('#lab-case-imported tr td:last-child').allTextContents(),
    currentRun: await page.locator('#lab-run').textContent(),
    currentField: await page.locator('#lab-field-status').textContent(),
  };
  await page.locator('#lab-case').screenshot({ path: 'output/playwright/legacy-layout-still-comparable.png' });
  if (errors.length || failures.length || !foreign.status?.includes('未经签名验证') || !foreign.status?.includes('不复算或比较') || !foreign.text?.includes('showroom-unverified-v1') || !foreign.text?.includes('不计算或解释 A/B 差值') || foreign.deltas.length !== 4 || foreign.deltas.some(value => value !== '—') || legacy.deltas[2] !== '+3.0' || legacy.deltas[3] !== '+3.0' || foreign.currentRun !== currentRun || legacy.currentRun !== currentRun || foreign.currentField !== currentField || legacy.currentField !== currentField) throw new Error(JSON.stringify({ foreign, legacy, errors, failures }));
  return { foreign: { status: foreign.status, summary: foreign.summary, deltas: foreign.deltas, currentRun: foreign.currentRun, currentField: foreign.currentField }, legacy, errors, failures };
}
