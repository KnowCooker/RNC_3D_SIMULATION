async (page) => {
  const browser = page.context().browser();
  const results = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const context = await browser.newContext({ viewport: { width: 1536, height: 960 }, serviceWorkers: 'block' });
    const externalRequests = [], requests = [], failures = [], pageErrors = [];
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//.test(url)) {
        externalRequests.push(url);
        await route.abort('internetdisconnected');
      } else { await route.continue(); }
    });
    const tab = await context.newPage();
    tab.on('pageerror', error => pageErrors.push(String(error)));
    tab.on('request', request => requests.push({ method: request.method(), url: request.url(), resourceType: request.resourceType() }));
    tab.on('requestfailed', request => failures.push({ url: request.url(), failure: request.failure() }));
    await tab.goto('http://127.0.0.1:5176/');
    await tab.waitForFunction(() => document.querySelector('#diagnostics')?.textContent.includes('reference-replay') && !document.querySelector('#play').disabled);
    const reference = await tab.locator('#diagnostics').innerText();
    await tab.getByRole('button', { name: '播放', exact: true }).click();
    await tab.waitForFunction(() => Number(document.querySelector('#seek').value) > 0.5);
    const referenceTime = await tab.locator('#time').innerText();
    await tab.getByRole('button', { name: '暂停', exact: true }).click();
    await tab.getByRole('combobox', { name: '固定随机种子' }).selectOption(['11','29','47'][attempt - 1]);
    await tab.getByRole('button', { name: '计算新实验', exact: true }).click();
    await tab.waitForFunction(() => document.querySelector('#diagnostics')?.textContent.includes('computed-browser') && !document.querySelector('#play').disabled);
    const computed = await tab.locator('#diagnostics').innerText();
    await tab.getByRole('button', { name: '播放', exact: true }).click();
    await tab.waitForFunction(() => Number(document.querySelector('#seek').value) > 0.5);
    const computedTime = await tab.locator('#time').innerText();
    if (externalRequests.length || failures.length || pageErrors.length) throw new Error(JSON.stringify({ attempt, externalRequests, failures, pageErrors }));
    if (attempt === 3) await tab.screenshot({ path: 'output/playwright/final-qa/offline-production-start.png', fullPage: true });
    results.push({ attempt, freshBrowserContext: true, reference, referenceTime, computed, computedTime, externalRequests, failures, pageErrors, requests });
    await context.close();
  }
  return { testedAt: new Date().toISOString(), browserVersion: browser.version(), networkConstraint: 'All non-loopback HTTP(S) browser requests aborted. OS network remains enabled. This is a same-machine production-package isolation test, not a physical offline or second-Windows test.', results };
}
