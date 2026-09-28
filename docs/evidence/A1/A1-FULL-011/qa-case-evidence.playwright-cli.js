// pnpm dev --host 127.0.0.1 --port 5173
// npx --yes --package @playwright/cli playwright-cli --session a1full011 run-code --filename docs/evidence/A1/A1-FULL-011/qa-case-evidence.playwright-cli.js
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
  await page.locator('#lab-case-observation').fill('右后座残余升高，先核对路面变化。');
  await page.locator('#lab-case-next-check').fill('保持车速与轮胎条件，增加重复运行。');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#lab-case-export').click();
  const download = await downloadPromise;
  await download.saveAs('docs/evidence/A1/A1-FULL-011/example-case.json');
  const beforeReload = {
    summary: await page.locator('#lab-case-state').innerText(),
    exportStatus: await page.locator('#lab-case-evidence-state').innerText(),
    downloadedName: download.suggestedFilename(),
  };
  await page.reload();
  await page.locator('#lab-viewer canvas').waitFor();
  await page.locator('.lab-case-evidence summary').click();
  await page.locator('#lab-case-import').setInputFiles('docs/evidence/A1/A1-FULL-011/example-case.json');
  await page.waitForFunction(() => document.querySelector('#lab-case-imported')?.querySelectorAll('tr').length === 5);
  const imported = {
    status: await page.locator('#lab-case-evidence-state').innerText(),
    provenance: await page.locator('#lab-case-imported p').first().innerText(),
    summary: await page.locator('#lab-case-imported p').nth(1).innerText(),
    rows: await page.locator('#lab-case-imported tr').allInnerTexts(),
    notes: await page.locator('#lab-case-imported p').nth(2).innerText(),
    boundary: await page.locator('#lab-case-imported p').nth(3).innerText(),
    baselineCleared: await page.locator('#lab-case-clear').isDisabled(),
  };
  await page.locator('#lab-case').screenshot({ path: 'docs/evidence/A1/A1-FULL-011/desktop-imported.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = {
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    importedVisible: await page.locator('#lab-case-imported').isVisible(),
    importedScrollWidth: await page.locator('#lab-case-imported').evaluate(el => el.scrollWidth),
    importedClientWidth: await page.locator('#lab-case-imported').evaluate(el => el.clientWidth),
  };
  await page.locator('#lab-case').screenshot({ path: 'docs/evidence/A1/A1-FULL-011/narrow-imported.png' });
  await page.locator('#lab-case-import').setInputFiles('docs/evidence/A1/A1-FULL-011/invalid-case.json');
  await page.waitForFunction(() => document.querySelector('#lab-case-evidence-state')?.textContent?.includes('版本不受支持'));
  const invalidStatus = await page.locator('#lab-case-evidence-state').innerText();
  const invalidHidden = await page.locator('#lab-case-imported').isHidden();
  if (errors.length || external.length || !beforeReload.summary.includes('仅改变：路面粗糙度 0.6 → 1.2') ||
    !beforeReload.downloadedName.endsWith('.json') || !beforeReload.exportStatus.includes('已导出') ||
    !imported.status.includes('只读复核') || !imported.provenance.includes('实录初级噪声') || !imported.summary.includes('路面粗糙度 0.6 → 1.2') ||
    imported.rows.length !== 5 || !imported.notes.includes('右后座残余升高') ||
    !imported.boundary.includes('不含原始信号') || !imported.baselineCleared || narrow.overflow || !narrow.importedVisible ||
    narrow.importedScrollWidth <= narrow.importedClientWidth || !invalidStatus.includes('版本不受支持') || !invalidHidden) {
    throw new Error(JSON.stringify({ errors, external, beforeReload, imported, narrow, invalidStatus, invalidHidden }));
  }
  return { errors, external, beforeReload, imported, narrow, invalidStatus, invalidHidden };
}
