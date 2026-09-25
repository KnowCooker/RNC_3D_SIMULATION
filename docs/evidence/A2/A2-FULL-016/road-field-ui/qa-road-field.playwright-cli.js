// playwright-cli run-code --filename docs/evidence/A2/A2-FULL-016/road-field-ui/qa-road-field.playwright-cli.js
async (page) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5181/') && !request.url().startsWith('blob:http://127.0.0.1:5181/')) external.push(request.url()); });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5181/');
  await page.getByRole('combobox', { name: '动力类型' }).selectOption('ice');
  await page.getByRole('button', { name: '道路三维场景' }).click();
  const surfaces = {};
  for (const [id, name] of [['smooth', '平整沥青'], ['coarse', '粗糙沥青'], ['gravel', '碎石路']]) {
    const button = page.getByRole('button', { name: `切换三维路面为${name}` });
    await button.click();
    surfaces[id] = await button.getAttribute('aria-pressed');
    await page.locator('#lab-viewer').screenshot({ path: `docs/evidence/A2/A2-FULL-016/road-field-ui/road-${id}.png` });
  }
  const roughnessAfterVisualSwitch = await page.locator('#lab-road').inputValue();
  await page.locator('#lab-field').selectOption('primary');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), undefined, { timeout: 30000 });
  await page.locator('#lab-seek').evaluate(element => {
    element.value = '5'; element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('.lab-field-hud:not([hidden])').waitFor({ timeout: 30000 });
  const primary = await page.locator('.lab-field-hud').evaluate(element => ({
    mode: element.dataset.mode, count: element.dataset.sampleCount, text: element.textContent,
  }));
  const focusButton = page.locator('.lab-field-focus');
  const fieldFocus = {
    on: await focusButton.getAttribute('aria-pressed'),
    hiddenMarkers: await page.locator('.lab-marker:not([hidden])').count(),
  };
  await focusButton.click();
  fieldFocus.off = await focusButton.getAttribute('aria-pressed');
  await page.waitForFunction(() => document.querySelectorAll('.lab-marker:not([hidden])').length === 16);
  fieldFocus.restoredMarkers = await page.locator('.lab-marker:not([hidden])').count();
  await focusButton.click();
  const threePlanes = await page.locator('.lab-field-interpolation-note').innerText();
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/road-field-ui/field-primary-three-planes.png' });
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('.lab-field-hud:not([hidden])').waitFor({ timeout: 30000 });
  const residual = await page.locator('.lab-field-hud').evaluate(element => ({
    mode: element.dataset.mode, count: element.dataset.sampleCount, text: element.textContent,
  }));
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/road-field-ui/field-residual-three-planes.png' });
  await page.locator('#lab-viewer canvas').click({ position: { x: 650, y: 275 } });
  const probe = await page.locator('.lab-field-hud p:last-child').innerText();
  await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).waitFor({ timeout: 30000 });
  const showroomFieldHidden = !await page.locator('.lab-field-hud').isVisible() && !await focusButton.isVisible();
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).click();
  const fieldRestoredFromShowroom = await page.locator('.lab-field-hud').isVisible() && await focusButton.isVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-016/road-field-ui/field-narrow.png' });
  const narrow = {
    roadSurfaceVisible: await page.locator('.lab-road-surface').isVisible(),
    fieldHudVisible: await page.locator('.lab-field-hud').isVisible(),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  };
  if (errors.length || external.length || Object.values(surfaces).some(value => value !== 'true') || roughnessAfterVisualSwitch !== '1' ||
      primary.mode !== 'primary' || residual.mode !== 'residual' || primary.count !== '280' || residual.count !== '280' ||
      !threePlanes.includes('三正交热力切片') || fieldFocus.on !== 'true' || fieldFocus.hiddenMarkers !== 0 ||
      fieldFocus.off !== 'false' || fieldFocus.restoredMarkers !== 16 || !probe.startsWith('探针 ') || !showroomFieldHidden ||
      !fieldRestoredFromShowroom || narrow.roadSurfaceVisible || !narrow.fieldHudVisible || narrow.overflow) {
    throw new Error(JSON.stringify({ errors, external, surfaces, roughnessAfterVisualSwitch, primary, residual, threePlanes, fieldFocus, probe, showroomFieldHidden, fieldRestoredFromShowroom, narrow }));
  }
  return { errors, external, surfaces, roughnessAfterVisualSwitch, primary, residual, threePlanes, fieldFocus, probe, showroomFieldHidden, fieldRestoredFromShowroom, narrow };
}
