async (page) => {
  await page.setViewportSize({ width: 1536, height: 960 });
  await page.addInitScript(() => {
    // Three's devtools observe event exposes read-only renderer counters to this test only.
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
      if (event.detail.isWebGLRenderer) window.__finalQaRenderer = event.detail;
    });
    window.__finalQa = { startedAt: Date.now(), performanceStart: performance.now(), errors: [], rejections: [], computations: 0, switches: 0, replays: 0, samples: 0 };
    addEventListener('error', event => window.__finalQa.errors.push(String(event.error || event.message)));
    addEventListener('unhandledrejection', event => window.__finalQa.rejections.push(String(event.reason)));
  });
  await page.goto('http://127.0.0.1:5176/');
  await page.waitForFunction(() => document.querySelector('#diagnostics')?.textContent.includes('reference-replay') && !document.querySelector('#play').disabled);
  return await page.evaluate(() => ({ startedAt: new Date(window.__finalQa.startedAt).toISOString(), userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory, diagnostics: document.querySelector('#diagnostics').textContent }));
}
