async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
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
  await page.waitForFunction(() => document.querySelector('#lab-case-evidence-state')?.textContent?.includes('案例物理布局身份不受支持'));
  const rejected = { status: await page.locator('#lab-case-evidence-state').textContent(), importedVisible: await page.locator('#lab-case-imported').isVisible(), currentRun: await page.locator('#lab-run').textContent(), currentField: await page.locator('#lab-field-status').textContent() };
  await page.locator('#lab-case').screenshot({ path: 'output/playwright/unknown-layout-rejected.png' });
  await page.locator('#lab-case-import').setInputFiles('docs/evidence/A1/A1-FULL-012/example-review.json');
  await page.waitForFunction(() => document.querySelector('#lab-case-evidence-state')?.textContent?.includes('已导入'));
  const importedText = await page.locator('#lab-case-imported').textContent();
  const legacy = { status: await page.locator('#lab-case-evidence-state').textContent(), teachingIdentity: importedText?.includes('布局 teaching-fixed-v1'), numericDelta: importedText?.includes('后排 B−A 残余：RL +3.0 dB，RR +3.0 dB'), currentRun: await page.locator('#lab-run').textContent(), currentField: await page.locator('#lab-field-status').textContent() };
  await page.locator('#lab-case').screenshot({ path: 'output/playwright/legacy-layout-imported.png' });
  if (errors.length || rejected.importedVisible || !legacy.teachingIdentity || !legacy.numericDelta || rejected.currentRun !== currentRun || legacy.currentRun !== currentRun || rejected.currentField !== currentField || legacy.currentField !== currentField) throw new Error(JSON.stringify({ rejected, legacy, errors }));
  return { rejected, legacy, errors };
}
