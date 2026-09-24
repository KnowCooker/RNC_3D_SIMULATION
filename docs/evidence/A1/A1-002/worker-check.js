// Real application + real Worker. Run after navigating to / and taking a CLI snapshot.
async (page) => {
  const checks = [], runs = [], errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push(name); };
  const diagnostics = () => page.locator('#diagnostics').textContent();
  await page.bringToFront();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('就绪'));
  const initial = await diagnostics();
  // Same event-loop turn guarantees cancellation before a Worker can post its result.
  await page.evaluate(() => { document.querySelector('#calculate').click(); document.querySelector('#cancel').click(); });
  assert('real Worker cancellation retains reference and reports cancelled', (await page.locator('#status').textContent()).includes('计算已取消') && await diagnostics() === initial);
  for (const [taps, seed, step] of [['32','29','0.08'], ['64','47','0']]) {
    await page.getByRole('combobox', { name: '滤波器系数数', exact: true }).selectOption(taps);
    await page.getByRole('combobox', { name: '固定随机种子', exact: true }).selectOption(seed);
    await page.getByRole('combobox', { name: '学习步长 μ', exact: true }).selectOption(step);
    const before = await diagnostics();
    await page.getByRole('button', { name: '计算新实验', exact: true }).click();
    await page.waitForFunction(previous => !document.querySelector('#calculate').disabled && document.querySelector('#diagnostics').textContent !== previous, before);
    const current = await diagnostics(); runs.push(current);
    assert(`real Worker accepts seed ${seed}, taps ${taps}, mu ${step}`, current.includes('computed-browser') && current.includes(`seed=${seed} · taps=${taps} · μ=${step}`));
    if (step === '0') assert('real mu zero produces zero aggregate reduction', (await page.locator('#aggregate').textContent()).trim() === '0.00 dB');
  }
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('#seek').value) > 0.1);
  const oldIdentity = await diagnostics();
  await page.route('**/fixtures/reference/golden_browser_fixture.json', route => route.fulfill({ status: 503, body: 'injected HTTP failure' }), { times: 1 });
  await page.getByRole('button', { name: '载入参考算例', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('HTTP 503'));
  await page.waitForFunction(() => document.querySelector('#play').textContent === '播放');
  assert('HTTP reference failure preserves actual computed experiment and stays paused', await diagnostics() === oldIdentity && await page.getByRole('button', { name: '播放', exact: true }).isEnabled());
  await page.screenshot({ path: 'output/playwright/a1-002-http-failure.png', fullPage: true });
  await page.getByRole('button', { name: '载入参考算例', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#diagnostics').textContent.includes('reference-replay'));
  assert('reference reload resets all three config controls after real Worker runs', await page.locator('#taps').inputValue() === '64' && await page.locator('#seed').inputValue() === '11' && await page.locator('#step').inputValue() === '0.08');
  assert('reference reload restores identity and resets clock without autoplay', await diagnostics() === initial && await page.locator('#seek').inputValue() === '0' && await page.getByRole('button', { name: '播放', exact: true }).isEnabled());
  assert('no uncaught page errors in real Worker flow', errors.length === 0);
  return { transport: 'real Worker; one reference HTTP response deliberately returns 503', count: checks.length, checks, runs, errors };
}
