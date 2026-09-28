async (page) => {
  const errors = [], failedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), reason: request.failure()?.errorText }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5192/');
  await page.locator('#lab-viewer canvas').waitFor();
  const stage = async expected => page.waitForFunction(value => document.querySelector('#lab-guide-action')?.getAttribute('data-stage') === value, expected, { timeout: 45000 });
  await page.locator('#lab-guide-toggle').click();
  await stage('mode');
  await page.locator('#lab-guide-action').click();
  await stage('baseline-run');
  await page.locator('#lab-duration').selectOption('10');
  await page.locator('#lab-guide-action').click();
  await stage('baseline-save');
  await page.locator('#lab-guide-action').click();
  await stage('road');
  await page.locator('#lab-guide-action').click();
  await stage('candidate-run');
  await page.locator('#lab-guide-action').click();
  await stage('field');

  await page.locator('#lab-field').selectOption('primary');
  await page.locator('#lab-seek').evaluate(input => { input.value = '10'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('10.00 s'), undefined, { timeout: 45000 });
  const primaryStage = await page.locator('#lab-guide-action').getAttribute('data-stage');
  if (primaryStage !== 'field') throw new Error(`primary field incorrectly unlocked ${primaryStage}`);

  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-field-weight').selectOption('Z');
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('10.00 s'), undefined, { timeout: 45000 });
  const unweightedStage = await page.locator('#lab-guide-action').getAttribute('data-stage');
  if (unweightedStage !== 'field') throw new Error(`Z-weighted field incorrectly unlocked ${unweightedStage}`);

  await page.locator('#lab-field-weight').selectOption('A');
  await page.locator('#lab-seek').evaluate(input => {
    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('3.00 s'), undefined, { timeout: 45000 });
  const earlyField = await page.locator('#lab-field-status').textContent();
  const earlyStage = await page.locator('#lab-guide-action').getAttribute('data-stage');
  if (earlyStage !== 'field') throw new Error(`early field incorrectly unlocked ${earlyStage}: ${earlyField}`);
  await page.locator('.lab-workspace').screenshot({ path: 'docs/evidence/A1/A1-FULL-013/main-merge/early-field.png' });

  await page.locator('#lab-field-weight').selectOption('Z');
  await page.locator('#lab-guide-action').click();
  await stage('listen');
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('10.00 s'), undefined, { timeout: 45000 });
  const terminalField = await page.locator('#lab-field-status').textContent();
  const terminalWeighting = await page.locator('#lab-field-weight').inputValue();
  if (terminalWeighting !== 'A') throw new Error(`guide failed to restore A weighting: ${terminalWeighting}`);
  await page.locator('.lab-workspace').screenshot({ path: 'docs/evidence/A1/A1-FULL-013/main-merge/terminal-field.png' });
  if (errors.length || failedRequests.length) throw new Error(JSON.stringify({ errors, failedRequests }));
  return { primaryStage, unweightedStage, earlyStage, earlyField, terminalStage: 'listen', terminalField, terminalWeighting, errors, failedRequests };
}
