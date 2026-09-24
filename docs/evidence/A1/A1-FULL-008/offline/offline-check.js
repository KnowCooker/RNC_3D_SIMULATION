async page => {
  const browser = page.context().browser();
  const contexts = [], runs = [];
  const url = 'http://127.0.0.1:5188/';
  const loopback = /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i;
  const probeUrl = 'https://offline-isolation.invalid/rnc-controlled-block-probe';
  try {
    for (let iteration = 1; iteration <= 3; iteration++) {
      // A new nonpersistent browser context has independent storage/cache for every launch.
      const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, serviceWorkers: 'block' });
      contexts.push(context);
      const requests = [], blocked = [], workers = [], errors = [], checks = [], cases = [];
      await context.route('**/*', async route => {
        const requestUrl = route.request().url();
        requests.push({ url: requestUrl, type: route.request().resourceType() });
        if (loopback.test(requestUrl)) await route.continue();
        else { blocked.push(requestUrl); await route.abort('internetdisconnected'); }
      });
      const tab = await context.newPage();
      tab.on('pageerror', error => errors.push(String(error)));
      tab.on('worker', worker => workers.push(worker.url()));
      const check = (condition, label) => { if (!condition) throw new Error(`Run ${iteration}: ${label}`); checks.push(label); };
      await tab.goto(url, { waitUntil: 'networkidle' });
      await tab.waitForFunction(() => document.querySelector('#lab-status')?.textContent.includes('实验就绪'));
      const initialSnapshot = await tab.locator('body').ariaSnapshot();
      check(initialSnapshot.includes('车辆声学实验室') && initialSnapshot.includes('纯燃油 SUV') && initialSnapshot.includes('增程 SUV'), 'actual initial DOM exposes lab and four vehicle options');
      check(await tab.locator('#lab-mode').inputValue() === 'replay', 'fresh context opens expected default batch mode');
      const guardWorked = await tab.evaluate(async probe => {
        try { await fetch(probe); return false; } catch { return true; }
      }, probeUrl);
      check(guardWorked && blocked.includes(probeUrl), 'nonloopback network guard blocks deliberate test probe');
      for (const vehicle of ['ice', 'bev', 'hev', 'erev']) {
        await tab.locator('#lab-vehicle').selectOption(vehicle);
        await tab.locator('#lab-calculate').click();
        await tab.waitForFunction(() => document.querySelector('#lab-status')?.textContent.includes('实验就绪'));
        await tab.locator('#lab-seek').focus(); await tab.keyboard.press('End');
        await tab.waitForFunction(() => document.querySelector('#lab-time')?.textContent.startsWith('16.00'));
        await tab.locator('#lab-field').selectOption('residual');
        await tab.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent.includes('空间窗口截至 16.00'));
        const value = await tab.evaluate(() => ({
          vehicle: document.querySelector('#lab-vehicle').value,
          status: document.querySelector('#lab-status').textContent,
          time: document.querySelector('#lab-time').textContent,
          metrics: document.querySelector('#lab-metrics').textContent,
          field: document.querySelector('#lab-field-status').textContent,
          canvases: [...document.querySelectorAll('canvas')].map(c => ({ width: c.width, height: c.height })),
        }));
        cases.push(value);
        check(value.vehicle === vehicle && value.status.includes('末4秒总改善') && value.metrics.includes('dB SPL') && !value.metrics.includes('准备中'), `${vehicle}: actual batch calculation and four-mic metrics complete`);
        check(value.field.includes('空间窗口截至 16.00') && value.canvases.some(c => c.width > 100 && c.height > 100), `${vehicle}: real field query and rendered canvases available`);
      }
      await tab.locator('#lab-mode').selectOption('live');
      await tab.locator('#lab-calculate').click();
      await tab.waitForFunction(() => parseFloat(document.querySelector('#lab-time')?.textContent || '0') >= 2.2);
      await tab.locator('#lab-play').click();
      await tab.waitForTimeout(180);
      const live = await tab.evaluate(() => ({ status: document.querySelector('#lab-status').textContent,
        time: document.querySelector('#lab-time').textContent, play: document.querySelector('#lab-play').textContent,
        metrics: document.querySelector('#lab-metrics').textContent, field: document.querySelector('#lab-field-status').textContent }));
      check(live.time.includes('实时') && parseFloat(live.time) >= 2.2 && live.status.includes('实时已暂停') && live.play === '播放', 'real continuous mode generates samples and pauses after start');
      check(workers.length >= 6 && workers.every(workerUrl => workerUrl.startsWith(`${url}assets/lab.worker-`)), 'batch and live create actual packaged lab Worker');
      check(blocked.every(blockedUrl => blockedUrl === probeUrl), 'application makes no nonloopback resource request');
      check(errors.length === 0, 'no page script errors');
      if (iteration === 1) await tab.screenshot({ path: 'offline-first-context.png', fullPage: true });
      runs.push({ iteration, freshContext: true, checks, cases, live, workers, requests, blocked, errors, initialSnapshot,
        browserVersion: browser.version(), userAgent: await tab.evaluate(() => navigator.userAgent) });
      await context.close();
    }
    return { passed: true, sourceCommit: 'abf1d2eac6e24f30fa4834773492194a08d5af82',
      scope: 'Three fresh browser contexts on the same Windows host. Playwright routing blocks nonloopback requests; service workers disabled. Not physical disconnection or second-machine acceptance.',
      url, contexts: 3, checksPassed: runs.reduce((sum, run) => sum + run.checks.length, 0), runs };
  } catch (error) {
    return { passed: false, error: String(error), runs };
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
  }
}
