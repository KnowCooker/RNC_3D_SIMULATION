// pnpm dev --host 127.0.0.1 --port 5173
// npx --yes --package @playwright/cli playwright-cli --session a1full012 run-code --filename docs/evidence/A1/A1-FULL-012/qa-review-card.playwright-cli.js
async (page) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith('http://127.0.0.1:5173/') && !url.startsWith('blob:http://127.0.0.1:5173/')) external.push(url);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#lab-viewer canvas').waitFor();
  await page.locator('#lab-mode').selectOption('replay');
  await page.locator('#lab-duration').selectOption('10');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  await page.locator('#lab-case-save').click();
  await page.getByRole('button', { name: '切换三维路面为粗糙沥青' }).click();
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-case-results')?.querySelectorAll('tr').length === 5, undefined, { timeout: 30000 });
  await page.locator('.lab-case-evidence summary').click();
  const currentReview = await page.locator('#lab-case-review-current').innerText();
  await page.locator('#lab-case-observation').fill('右后座残余升高。');
  await page.locator('#lab-case-interpretation').fill('可能由路面粗糙度变化导致，仍需验证。');
  await page.locator('#lab-case-decision').fill('先保留基线，不作实车方案签收。');
  await page.locator('#lab-case-next-check').fill('保持其他工况不变，再做复测。');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#lab-case-export').click();
  const download = await downloadPromise;
  await download.saveAs('docs/evidence/A1/A1-FULL-012/example-review.json');
  await page.reload();
  await page.locator('#lab-viewer canvas').waitFor();
  await page.locator('.lab-case-evidence summary').click();
  await page.locator('#lab-case-import').setInputFiles('docs/evidence/A1/A1-FULL-012/example-review.json');
  await page.waitForFunction(() => document.querySelector('#lab-case-imported .lab-review-human')?.textContent?.includes('先保留基线'));
  const imported = {
    review: await page.locator('#lab-case-imported .lab-review-facts').innerText(),
    human: await page.locator('#lab-case-imported .lab-review-human').innerText(),
    rows: await page.locator('#lab-case-imported tr').count(),
    baselineCleared: await page.locator('#lab-case-clear').isDisabled(),
  };
  await page.locator('#lab-case').screenshot({ path: 'docs/evidence/A1/A1-FULL-012/desktop-review.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = {
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    importedVisible: await page.locator('#lab-case-imported').isVisible(),
    panelScrolls: await page.locator('#lab-case-imported').evaluate(el => el.scrollWidth > el.clientWidth),
  };
  await page.locator('#lab-case').screenshot({ path: 'docs/evidence/A1/A1-FULL-012/narrow-review.png' });
  await page.locator('#lab-case-import').setInputFiles('docs/evidence/A1/A1-FULL-011/example-case.json');
  await page.waitForFunction(() => document.querySelector('#lab-case-imported .lab-review-human')?.textContent?.includes('人工解释（待验证）：未填写'));
  const legacy = await page.locator('#lab-case-imported .lab-review-human').innerText();
  await page.setViewportSize({ width: 1440, height: 900 });
  if (await page.locator('#lab-controls').isHidden()) await page.locator('#lab-controls-toggle').click();
  await page.locator('#lab-mode').selectOption('replay');
  await page.locator('#lab-duration').selectOption('10');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  await page.locator('#lab-case-save').click();
  await page.locator('#lab-speed').evaluate(input => { input.value = '80'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-case-review-current')?.textContent?.includes('可比条件不一致'), undefined, { timeout: 30000 });
  const mismatchReview = await page.locator('#lab-case-review-current').innerText();
  await page.locator('#lab-speed').evaluate(input => { input.value = '60'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#lab-road').evaluate(input => { input.value = '1.2'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#lab-step').fill('0.04');
  await page.locator('#lab-step').dispatchEvent('change');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-case-review-current')?.textContent?.includes('多项变量同时改变'), undefined, { timeout: 30000 });
  const multiReview = await page.locator('#lab-case-review-current').innerText();
  if (errors.length || external.length || !currentReview.includes('配置唯一变更：路面粗糙度 0.6 → 1.2') ||
      !currentReview.includes('左后座 +3.0 dB') || !currentReview.includes('不能用于实车认证') ||
      !imported.review.includes('左后座 +3.0 dB') || !imported.human.includes('可能由路面粗糙度变化导致，仍需验证') ||
      !imported.human.includes('先保留基线') || imported.rows !== 5 || !imported.baselineCleared ||
      narrow.overflow || !narrow.importedVisible || !narrow.panelScrolls || !legacy.includes('人工解释（待验证）：未填写') ||
      !mismatchReview.includes('车速') || mismatchReview.includes('后排残余 B−A') || !multiReview.includes('不能把结果归因于其中一项')) {
    throw new Error(JSON.stringify({ errors, external, currentReview, imported, narrow, legacy, mismatchReview, multiReview }));
  }
  return { errors, external, currentReview, imported, narrow, legacy, mismatchReview, multiReview };
}
