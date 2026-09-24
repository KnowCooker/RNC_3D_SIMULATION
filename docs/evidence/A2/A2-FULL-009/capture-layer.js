async page => {
  const stage = page.url().includes('stage=before') ? 'before' : 'after';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5183/');
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  const root = 'docs/evidence/A2/A2-FULL-009';
  await page.locator('#lab-paths').selectOption('both');
  await page.locator('#lab-waves').check();
  await page.locator('.lab-marker[data-signal="e"][data-channel="0"]').click();
  const seek = page.locator('#lab-seek');
  const seekBox = await seek.boundingBox();
  await page.mouse.click(seekBox.x + seekBox.width * 0.25, seekBox.y + seekBox.height / 2);
  const states = [];
  async function capture(name, field, slice, body, explode, section) {
    await page.locator('#lab-body').selectOption(body);
    const pressed = await page.locator('#lab-explode').getAttribute('aria-pressed');
    if ((pressed === 'true') !== explode) await page.locator('#lab-explode').click();
    await page.locator('#lab-section').selectOption(section);
    await page.locator('#lab-field-slice').selectOption(slice);
    await page.locator('#lab-field').selectOption(field);
    if (field !== 'off') await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('空间窗口截至'));
    await page.waitForTimeout(explode ? 1200 : 250);
    const state = await page.evaluate(name => {
      const host = document.querySelector('#lab-viewer');
      const note = host.querySelector('.lab-field-interpolation-note');
      const gl = host.querySelector('canvas').getContext('webgl2');
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        name, vehicle: document.querySelector('#lab-vehicle').value,
        field: document.querySelector('#lab-field').value,
        slice: document.querySelector('#lab-field-slice').value,
        paths: document.querySelector('#lab-paths').value,
        waves: document.querySelector('#lab-waves').checked,
        body: document.querySelector('#lab-body').value,
        section: document.querySelector('#lab-section').value,
        exploded: document.querySelector('#lab-explode').getAttribute('aria-pressed'),
        fieldStatus: document.querySelector('#lab-field-status').textContent,
        note: note.hidden ? null : note.textContent,
        focus: host.querySelector('.lab-path-focus-note')?.textContent ?? null,
        selected: document.querySelector('#lab-signal-title').textContent,
        markers: [...host.querySelectorAll('.lab-marker')].filter(el => !el.hidden).length,
        gpu: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      };
    }, name);
    await page.locator('#lab-viewer').screenshot({ path: `${root}/${stage}-${name}.png` });
    states.push(state);
  }
  await capture('bev-paths-waves', 'off', 'volume', 'transparent', false, 'none');
  await capture('bev-all-volume', 'residual', 'volume', 'transparent', false, 'none');
  await capture('bev-all-y', 'residual', 'y', 'transparent', false, 'none');
  await capture('bev-all-y-exploded', 'residual', 'y', 'transparent', true, 'none');
  await capture('bev-all-y-section', 'residual', 'y', 'solid', false, 'y');
  if (errors.length) throw Error(errors.join('; '));
  return { stage, states, errors };
}
