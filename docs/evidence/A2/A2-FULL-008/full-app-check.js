async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5183/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  const cases = [
    ['solid', 'solid', false],
    ['transparent', 'transparent', false],
    ['hidden', 'hidden', false],
    ['exploded', 'solid', true],
  ];
  const records = [];
  for (const [name, body, exploded] of cases) {
    await page.locator('#lab-body').selectOption(body);
    const pressed = await page.locator('#lab-explode').getAttribute('aria-pressed');
    if ((pressed === 'true') !== exploded) await page.locator('#lab-explode').click();
    await page.waitForTimeout(200);
    const state = await page.evaluate(name => ({
      name,
      vehicle: document.querySelector('#lab-vehicle').value,
      body: document.querySelector('#lab-body').value,
      exploded: document.querySelector('#lab-explode').getAttribute('aria-pressed'),
      hardware: document.querySelectorAll('#lab-viewer .lab-marker[data-signal]').length,
      status: document.querySelector('#lab-status').textContent,
      renderer: document.querySelector('#lab-viewer canvas') !== null,
    }), name);
    if (state.vehicle !== 'bev' || !state.renderer || state.hardware < 12 || state.exploded !== String(exploded)) throw Error(JSON.stringify(state));
    await page.screenshot({ path: `docs/evidence/A2/A2-FULL-008/app-${name}.png` });
    records.push(state);
  }
  return { records };
}
