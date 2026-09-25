async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5183/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  const run = await page.locator('#lab-run').textContent();
  const records = [];
  for (const [name, body, explode, section] of [
    ['solid', 'solid', false, 'none'], ['transparent', 'transparent', false, 'none'],
    ['hidden', 'hidden', false, 'none'], ['exploded', 'solid', true, 'none'],
    ['section-x', 'solid', true, 'x'],
  ]) {
    await page.locator('#lab-body').selectOption(body);
    const pressed = await page.locator('#lab-explode').getAttribute('aria-pressed');
    if ((pressed === 'true') !== explode) await page.locator('#lab-explode').click();
    await page.locator('#lab-section').selectOption(section);
    await page.waitForTimeout(250);
    const state = await page.evaluate(name => {
      const host = document.querySelector('#lab-viewer'), canvas = host.querySelector('canvas'), gl = canvas.getContext('webgl2');
      return { name, run: document.querySelector('#lab-run').textContent, body: document.querySelector('#lab-body').value,
        explode: document.querySelector('#lab-explode').getAttribute('aria-pressed'), section: document.querySelector('#lab-section').value,
        markerCount: host.querySelectorAll('.lab-marker[data-signal]').length, contextLost: gl.isContextLost() };
    }, name);
    if (state.run !== run || state.body !== body || state.explode !== String(explode) || state.section !== section ||
        state.markerCount < 12 || state.contextLost || errors.length) throw Error(JSON.stringify({ state, errors }));
    await page.locator('#lab-viewer').screenshot({ path: `docs/evidence/A2/A2-FULL-015/full-app-${name}.png` });
    records.push(state);
  }
  return { run, records, errors };
}
