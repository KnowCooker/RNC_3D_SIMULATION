// Run against the combined worktree after opening / and reading a CLI snapshot.
async (page) => {
  const checks = [], errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push(name); };
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('就绪'));
  const initial = await page.locator('#diagnostics').textContent();
  assert('12 viewer controls and 12 app controls have separate ownership attributes', await page.locator('#viewer [data-viewer-signal]').count() === 12 && await page.locator('#hardware [data-signal]').count() === 12);
  for (const [signal, unit] of [['x', 'm/s²'], ['u', 'drive'], ['e', 'Pa']]) {
    for (const corner of ['fl','fr','rl','rr']) {
      const button = page.locator(`#viewer [data-viewer-signal="${signal}"][data-viewer-corner="${corner}"]`);
      await button.click();
      await page.waitForFunction(({ signal, corner }) => document.querySelector(`#viewer [data-viewer-signal="${signal}"][data-viewer-corner="${corner}"]`).getAttribute('aria-pressed') === 'true', { signal, corner });
      assert(`viewer ${signal}/${corner} selects matching app graph and hardware`, await page.locator('#wave-title').textContent() === `${corner.toUpperCase()} · ${signal} / ${unit}` && (await page.locator(`#hardware [data-signal="${signal}"][data-corner="${corner}"]`).getAttribute('class')).includes('selected'));
      if (signal === 'e') assert(`MIC ${corner} propagates listening seat`, await page.locator('#mic').inputValue() === corner);
    }
  }
  assert('viewer selections never change result identity', await page.locator('#diagnostics').textContent() === initial);
  await page.locator('#viewer [data-viewer-signal="u"][data-viewer-corner="rr"]').focus();
  await page.keyboard.press('Enter');
  assert('keyboard viewer selection reaches app callback', await page.locator('#wave-title').textContent() === 'RR · u / drive');
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('#seek').value) > 0.1);
  await page.getByRole('button', { name: '分层展开', exact: true }).click();
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const time = await page.locator('#seek').inputValue();
  await page.getByRole('button', { name: '复位视角与结构', exact: true }).click();
  assert('viewer reset leaves app result, selected signal and paused clock intact', await page.locator('#diagnostics').textContent() === initial && await page.locator('#seek').inputValue() === time && await page.locator('#wave-title').textContent() === 'RR · u / drive');
  await page.evaluate(() => { document.querySelector('#calculate').click(); document.querySelector('#cancel').click(); });
  await page.locator('#viewer [data-viewer-signal="x"][data-viewer-corner="fl"]').click();
  assert('viewer remains usable after real Worker cancellation', (await page.locator('#status').textContent()).includes('计算已取消') && await page.locator('#wave-title').textContent() === 'FL · x / m/s²' && await page.locator('#diagnostics').textContent() === initial);
  await page.screenshot({ path: 'output/playwright/a1-a2-integration.png', fullPage: true });
  assert('combined flow has no uncaught page errors', errors.length === 0);
  return { count: checks.length, checks, errors, url: page.url() };
}
