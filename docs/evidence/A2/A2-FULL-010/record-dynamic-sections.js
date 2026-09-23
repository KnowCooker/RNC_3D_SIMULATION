async page => {
  const vehicle = page.url().match(/[?&]captureVehicle=([^&]+)/)?.[1] || 'bev';
  if (!['ice', 'bev', 'hev', 'erev'].includes(vehicle)) throw Error(`Unknown vehicle ${vehicle}`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5183/');
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  if (vehicle !== 'bev') {
    await page.locator('#lab-vehicle').selectOption(vehicle);
    await page.locator('#lab-calculate').click();
    await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  }
  const run = await page.locator('#lab-run').textContent();
  await page.locator('#lab-body').selectOption('solid');
  await page.locator('#lab-paths').selectOption('both');
  await page.locator('#lab-waves').check();
  await page.locator('#lab-field').selectOption('residual');
  const seekBox = await page.locator('#lab-seek').boundingBox();
  await page.mouse.click(seekBox.x + seekBox.width * 0.25, seekBox.y + seekBox.height / 2);
  const ready = () => page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('空间窗口截至'));
  await ready();
  const rows = [], slider = page.locator('#lab-section-position');
  async function state(label) {
    const value = await page.evaluate(label => {
      const host = document.querySelector('#lab-viewer'), gl = host.querySelector('canvas').getContext('webgl2');
      return {
        label, vehicle: document.querySelector('#lab-vehicle').value,
        run: document.querySelector('#lab-run').textContent,
        section: document.querySelector('#lab-section').value,
        cut: Number(document.querySelector('#lab-section-position').value),
        field: document.querySelector('#lab-field').value,
        slice: document.querySelector('#lab-field-slice').value,
        fieldStatus: document.querySelector('#lab-field-status').textContent,
        note: host.querySelector('.lab-field-note-detail')?.textContent,
        exploded: document.querySelector('#lab-explode').getAttribute('aria-pressed'),
        markers: [...host.querySelectorAll('.lab-marker')].filter(el => !el.hidden).length,
        contextLost: gl.isContextLost(),
      };
    }, label);
    if (value.vehicle !== vehicle || value.run !== run || value.contextLost || !value.fieldStatus.includes('空间窗口截至')) throw Error(JSON.stringify(value));
    rows.push(value);
  }
  await state('start');
  const cuts = {
    x: [-1.1, -0.8, -0.55, -0.3, 0, 0.3, 0.55, 0.8, 1.1],
    y: [0.45, 0.62, 0.8, 0.95, 1.05, 1.2, 1.4, 1.65, 1.9],
    z: [-1.8, -1.35, -0.9, -0.45, 0, 0.45, 0.9, 1.35, 1.8],
  };
  for (const axis of ['x', 'y', 'z']) {
    await page.locator('#lab-section').selectOption(axis);
    await page.waitForTimeout(300);
    for (const cut of cuts[axis]) {
      await slider.evaluate((element, value) => {
        element.value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }, cut);
      await page.waitForTimeout(140);
      await state(`${axis}-${cut}`);
    }
    const center = axis === 'y' ? 1.05 : 0;
    await slider.evaluate((element, value) => { element.value = String(value); element.dispatchEvent(new Event('input', { bubbles: true })); }, center);
    await page.locator('#lab-field-slice').selectOption(axis);
    await ready(); await page.waitForTimeout(500);
    await state(`${axis}-sampled-slice`);
    if (!rows[rows.length - 1].note?.includes('固定采样切片')) throw Error(`${vehicle} ${axis}: fixed sampling plane not identified`);
    await page.locator('#lab-viewer').screenshot({ path: `docs/evidence/A2/A2-FULL-010/${vehicle}-${axis}-slice.png` });
    await page.locator('#lab-field-slice').selectOption('volume');
    await ready();
  }
  await page.locator('#lab-section').selectOption('y');
  await slider.evaluate(element => { element.value = '1.05'; element.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#lab-explode').click(); await page.waitForTimeout(1200); await state('exploded-y');
  await page.locator('#lab-viewer').screenshot({ path: `docs/evidence/A2/A2-FULL-010/${vehicle}-exploded-y.png` });
  await page.locator('#lab-explode').click(); await page.waitForTimeout(1200); await state('closed-y');
  if (errors.length) throw Error(errors.join('; '));
  return { vehicle, run, rows, errors };
}
