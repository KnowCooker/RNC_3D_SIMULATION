async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5183/');
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  await page.locator('#lab-paths').selectOption('both');
  await page.locator('#lab-waves').check();
  await page.locator('#lab-body').selectOption('transparent');
  await page.locator('#lab-field-slice').selectOption('y');
  await page.locator('#lab-field').selectOption('residual');
  const results = [];
  async function seek() {
    const box = await page.locator('#lab-seek').boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
    await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('空间窗口截至'));
  }
  async function record(name, signal, channel, expectedFocused, expectedShown, screenshot = false) {
    if (signal) await page.locator(`.lab-marker[data-signal="${signal}"][data-channel="${channel}"]`).click();
    await page.waitForFunction(() => !document.querySelector('.lab-path-focus-note')?.hidden);
    const state = await page.evaluate(name => {
      const host = document.querySelector('#lab-viewer'), note = host.querySelector('.lab-path-focus-note');
      return {
        name, vehicle: document.querySelector('#lab-vehicle').value,
        fieldStatus: document.querySelector('#lab-field-status').textContent,
        paths: document.querySelector('#lab-paths').value,
        waves: document.querySelector('#lab-waves').checked,
        signalTitle: document.querySelector('#lab-signal-title').textContent,
        note: note.textContent,
        focused: Number(note.dataset.focusedPaths), shown: Number(note.dataset.shownPaths),
        markers: [...host.querySelectorAll('.lab-marker')].filter(el => !el.hidden).length,
      };
    }, name);
    if (state.focused !== expectedFocused || state.shown !== expectedShown || !state.fieldStatus.includes('空间窗口截至')) throw Error(JSON.stringify(state));
    if (screenshot) await page.locator('#lab-viewer').screenshot({ path: `docs/evidence/A2/A2-FULL-009/after-${name}.png` });
    results.push(state);
  }
  await seek();
  await record('bev-q1', 'q', 0, 4, 32, true);
  await record('bev-x1', 'x', 0, 0, 32, true);
  await record('bev-u1', 'u', 0, 4, 32, true);
  await record('bev-e-fl', 'e', 0, 8, 32, true);
  await page.locator('#lab-paths').selectOption('secondary');
  await record('bev-secondary-u1', 'u', 0, 4, 16);
  await page.locator('#lab-paths').selectOption('both');
  await page.locator('[data-speaker="0"]').uncheck();
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  await seek();
  await record('bev-disabled-u1', 'u', 0, 0, 28, true);
  await page.locator('[data-speaker="0"]').check();
  for (const vehicle of ['ice', 'hev', 'erev']) {
    await page.locator('#lab-vehicle').selectOption(vehicle);
    await page.locator('#lab-calculate').click();
    await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
    await seek();
    await record(`${vehicle}-e-fl`, 'e', 0, 8, 32, true);
  }
  if (errors.length) throw Error(errors.join('; '));
  return { results, errors };
}
