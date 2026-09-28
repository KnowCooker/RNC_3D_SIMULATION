async page => {
  const browser = page.context().browser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const url = 'http://127.0.0.1:5189/';
  const blocked = [], requests = [], workers = [], errors = [], cases = [];
  try {
    await context.route('**/*', async route => {
      const address = route.request().url();
      requests.push(address);
      if (address.startsWith(url)) await route.continue();
      else { blocked.push(address); await route.abort('internetdisconnected'); }
    });
    const tab = await context.newPage();
    tab.on('pageerror', error => errors.push(error.message));
    tab.on('worker', worker => workers.push(worker.url()));
    await tab.goto(url);
    await tab.locator('#lab-viewer canvas').waitFor();
    await tab.locator('#lab-mode').selectOption('replay');
    await tab.locator('#lab-duration').selectOption('10');
    for (const vehicle of ['ice', 'bev', 'hev', 'erev']) {
      await tab.locator('#lab-vehicle').selectOption(vehicle);
      await tab.locator('#lab-calculate').click();
      await tab.waitForFunction(() => !document.querySelector('#lab-seek')?.hasAttribute('disabled'), undefined, { timeout: 45000 });
      await tab.locator('#lab-field').selectOption('residual');
      await tab.locator('#lab-seek').evaluate(input => { input.value = '10'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      await tab.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('10.00 s'), undefined, { timeout: 45000 });
      const state = await tab.evaluate(() => ({
        vehicle: document.querySelector('#lab-vehicle').value,
        status: document.querySelector('#lab-status').textContent,
        field: document.querySelector('#lab-field-status').textContent,
        metrics: document.querySelector('#lab-metrics').textContent,
      }));
      if (state.vehicle !== vehicle || !state.field.includes('10.00 s') || !state.metrics.includes('dB')) throw new Error(`incomplete ${vehicle}: ${JSON.stringify(state)}`);
      cases.push(state);
    }
    await tab.screenshot({ path: 'docs/evidence/A1/A1-FULL-015/offline-four-cars.png', fullPage: true });
    if (blocked.length || errors.length || workers.length < 4 || !workers.every(address => address.startsWith(`${url}assets/lab.worker-`)))
      throw new Error(JSON.stringify({ blocked, errors, workers }));
    return { passed: true, scope: 'One fresh browser context with nonloopback requests blocked on this Windows host; not physical disconnection or second-machine acceptance.',
      cases, workers, requests, blocked, errors, browserVersion: browser.version() };
  } finally { await context.close(); }
}
