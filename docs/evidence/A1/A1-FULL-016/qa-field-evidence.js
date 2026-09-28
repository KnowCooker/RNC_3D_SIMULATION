async (page) => {
  const errors = [];
  const failedRequests = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('requestfailed', request => {
    if (!request.url().endsWith('/favicon.ico')) failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const rows = [];
  for (const vehicle of ['ice', 'hev', 'erev', 'bev']) {
    await page.reload();
    await page.selectOption('#lab-mode', 'replay');
    await page.selectOption('#lab-duration', '10');
    await page.selectOption('#lab-vehicle', vehicle);
    await page.click('#lab-calculate');
    await page.waitForFunction(() => !document.querySelector('#lab-play').disabled, null, { timeout: 120000 });
    await page.selectOption('#lab-field', 'residual');
    await page.locator('#lab-seek').focus();
    await page.keyboard.press('End');
    await page.locator('#lab-field-evidence').waitFor({ state: 'visible', timeout: 30000 });
    const text = await page.locator('#lab-field-evidence-summary').textContent();
    const match = text.match(/(\d+)\/(\d+) 有效采样点：改善 (\d+) · 接近持平 (\d+) · 变差 (\d+)/);
    if (!match) throw new Error(`${vehicle}: no valid field evidence: ${text}`);
    const [valid, sampled, improved, nearZero, worsened] = match.slice(1).map(Number);
    if (valid !== sampled || valid !== 280 || improved + nearZero + worsened !== valid) {
      throw new Error(`${vehicle}: sample count mismatch: ${text}`);
    }
    const windowText = await page.locator('#lab-field-evidence-window').textContent();
    if (!windowText.includes('10.00 s') || !windowText.includes('A 计权')) throw new Error(`${vehicle}: wrong field window: ${windowText}`);
    rows.push({ vehicle, valid, improved, nearZero, worsened, windowText, summary: text });
    if (vehicle !== 'bev') {
      await page.selectOption('#lab-field', 'off');
      if (await page.locator('#lab-field-evidence').isVisible()) throw new Error(`${vehicle}: old field remained after disabling it`);
    }
  }
  await page.selectOption('#lab-field-weight', 'Z');
  if (await page.locator('#lab-field-evidence').isVisible()) throw new Error('old A-weighted field remained after weighting change');
  await page.locator('#lab-field-evidence').waitFor({ state: 'visible', timeout: 30000 });
  const zWindow = await page.locator('#lab-field-evidence-window').textContent();
  if (!zWindow.includes('Z 计权')) throw new Error(`new weighting not reflected: ${zWindow}`);
  await page.selectOption('#lab-field-weight', 'A');
  await page.locator('#lab-field-evidence').waitFor({ state: 'visible', timeout: 30000 });
  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth,
    evidenceWidth: document.querySelector('#lab-field-evidence').getBoundingClientRect().width,
    visible: !document.querySelector('#lab-field-evidence').hidden,
  }));
  if (!narrow.visible || narrow.width > narrow.viewport + 1) throw new Error(`narrow layout overflow: ${JSON.stringify(narrow)}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.selectOption('#lab-field-slice', 'x');
  await page.locator('#lab-field-evidence').waitFor({ state: 'visible', timeout: 30000 });
  await page.selectOption('#lab-section', 'x');
  await page.locator('#lab-section-position').focus();
  await page.keyboard.press('ArrowRight');
  const staleAfterMovingSlice = await page.locator('#lab-field-evidence').isVisible();
  if (staleAfterMovingSlice) throw new Error('old field evidence remained on a moved physical sampling plane');
  await page.locator('#lab-field-evidence').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#lab-road').focus();
  await page.keyboard.press('ArrowRight');
  const staleAfterChangingRoad = await page.locator('#lab-field-evidence').isVisible();
  if (staleAfterChangingRoad) throw new Error('old field evidence remained after changing experiment conditions');
  return { rows, zWindow, narrow, staleAfterMovingSlice, staleAfterChangingRoad, pageErrors: errors, failedRequests };
}
