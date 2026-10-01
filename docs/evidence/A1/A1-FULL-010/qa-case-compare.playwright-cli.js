// pnpm dev; npx --yes --package @playwright/cli playwright-cli --session a1full010 run-code --filename docs/evidence/A1/A1-FULL-010/qa-case-compare.playwright-cli.js
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
  const baseline = await page.locator('#lab-case-state').innerText();
  await page.getByRole('button', { name: '切换三维路面为粗糙沥青' }).click();
  const stale = {
    run: await page.locator('#lab-run').innerText(),
    comparisonHidden: await page.locator('#lab-case-results').isHidden(),
    baseline: await page.locator('#lab-case-state').innerText(),
  };
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-case-results')?.querySelectorAll('tr').length === 5, undefined, { timeout: 30000 });
  const road = {
    summary: await page.locator('#lab-case-state').innerText(),
    values: await page.locator('#lab-case-results tr').allInnerTexts(),
    note: await page.locator('#lab-case-results p').innerText(),
  };
  await page.locator('#lab-case').screenshot({ path: 'docs/evidence/A1/A1-FULL-010/desktop-comparison.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = {
    pageOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    comparisonVisible: await page.locator('#lab-case-results').isVisible(),
    controlsCollapsed: await page.locator('#lab-controls').isHidden(),
    tableScrollWidth: await page.locator('#lab-case-results').evaluate(el => el.scrollWidth),
    panelWidth: await page.locator('#lab-case-results').evaluate(el => el.clientWidth),
  };
  await page.locator('#lab-case').screenshot({ path: 'docs/evidence/A1/A1-FULL-010/narrow-comparison.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#lab-controls-toggle').click();
  await page.locator('#lab-speed').evaluate(input => { input.value = '80'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-case-state')?.textContent?.includes('不能直接计算方案差值'), undefined, { timeout: 30000 });
  const incompatible = {
    text: await page.locator('#lab-case-state').innerText(),
    comparisonHidden: await page.locator('#lab-case-results').isHidden(),
  };
  await page.locator('#lab-speed').evaluate(input => { input.value = '60'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#lab-step').fill('0.04');
  await page.locator('#lab-step').dispatchEvent('change');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-case-state')?.textContent?.includes('不能把结果归因于其中一项'), undefined, { timeout: 30000 });
  const multiple = {
    text: await page.locator('#lab-case-state').innerText(),
    comparisonVisible: await page.locator('#lab-case-results').isVisible(),
  };
  await page.locator('#lab-case-clear').click();
  const cleared = {
    comparisonHidden: await page.locator('#lab-case-results').isHidden(),
    clearDisabled: await page.locator('#lab-case-clear').isDisabled(),
  };
  await page.reload();
  const refreshed = {
    clearDisabled: await page.locator('#lab-case-clear').isDisabled(),
    comparisonHidden: await page.locator('#lab-case-results').isHidden(),
  };
  if (errors.length || external.length || !baseline.includes('基线 A 已保存') || stale.run !== '待计算配置' || !stale.comparisonHidden || !stale.baseline.includes('基线 A 已保存') ||
      !road.summary.includes('仅改变：路面粗糙度 0.6 → 1.2') || !road.summary.includes('后排残余变化') || road.values.length !== 5 ||
      !road.note.includes('教学尺度') || narrow.pageOverflow || !narrow.comparisonVisible || !narrow.controlsCollapsed || narrow.tableScrollWidth <= narrow.panelWidth ||
      !incompatible.text.includes('车速不同') || !incompatible.comparisonHidden || !multiple.text.includes('改变了 2 项') || !multiple.comparisonVisible ||
      !cleared.comparisonHidden || !cleared.clearDisabled || !refreshed.clearDisabled || !refreshed.comparisonHidden) {
    throw new Error(JSON.stringify({ errors, external, baseline, stale, road, narrow, incompatible, multiple, cleared, refreshed }));
  }
  return { errors, external, baseline, stale, road, narrow, incompatible, multiple, cleared, refreshed };
}
