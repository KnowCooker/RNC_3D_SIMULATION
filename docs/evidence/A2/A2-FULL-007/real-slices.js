async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5183/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  const folder = 'docs/evidence/A2/A2-FULL-007';
  const states = [];
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const fieldReady = () => page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('空间窗口截至'), { timeout: 20000 });
  async function seekFourSeconds() {
    const box = await page.locator('#lab-seek').boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
    await fieldReady();
  }
  async function save(name, slice) {
    await page.locator('#lab-field-slice').selectOption(slice);
    await fieldReady();
    await page.waitForTimeout(180);
    const state = await page.evaluate(name => {
      const note = document.querySelector('.lab-field-interpolation-note');
      const canvas = document.querySelector('#lab-viewer canvas');
      return {
        name, vehicle: document.querySelector('#lab-vehicle').value,
        fieldMode: document.querySelector('#lab-field').value,
        playbackTime: Number(document.querySelector('#lab-seek').value),
        slice: document.querySelector('#lab-field-slice').value,
        section: document.querySelector('#lab-section').value,
        exploded: document.querySelector('#lab-explode').getAttribute('aria-pressed'),
        note: note.hidden ? null : note.textContent,
        status: document.querySelector('#lab-field-status').textContent,
        canvas: [canvas.width, canvas.height],
      };
    }, name);
    if (!state.status.includes('空间窗口截至')) throw Error(`${name}: no computed field`);
    if (slice === 'volume' ? state.note !== null : !state.note?.includes('三角插值')) throw Error(`${name}: slice provenance is wrong`);
    await page.locator('#lab-viewer').screenshot({ path: `${folder}/${name}.png` });
    states.push(state);
  }
  await page.locator('#lab-field').selectOption('residual');
  await seekFourSeconds();
  for (const slice of ['volume', 'x', 'y', 'z']) await save(`bev-${slice}`, slice);
  await page.locator('#lab-field').selectOption('primary');
  await save('bev-y-primary', 'y');
  await page.locator('#lab-field').selectOption('residual');
  const lateSeek = await page.locator('#lab-seek').boundingBox();
  await page.mouse.click(lateSeek.x + lateSeek.width * 0.88, lateSeek.y + lateSeek.height / 2);
  await fieldReady();
  await save('bev-y-late', 'y');
  await seekFourSeconds();
  await page.locator('#lab-section').selectOption('y');
  await page.locator('#lab-explode').click();
  await page.waitForTimeout(1300);
  await save('bev-y-section-exploded', 'y');
  await page.locator('#lab-section').selectOption('none');
  await page.locator('#lab-explode').click();
  for (const [vehicle, slice] of [['ice', 'x'], ['hev', 'y'], ['erev', 'z']]) {
    await page.locator('#lab-vehicle').selectOption(vehicle);
    await page.locator('#lab-calculate').click();
    await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
    await seekFourSeconds();
    await save(`${vehicle}-${slice}`, slice);
  }
  const gpu = await page.evaluate(() => {
    const gl = document.querySelector('#lab-viewer canvas').getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  if (errors.length) throw Error(`Page errors: ${errors.join('; ')}`);
  return { states, gpu, errors };
}
