async page => {
  const checks = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  await page.waitForFunction(() => window.lifecycleFixture?.ready);
  await page.evaluate(() => window.lifecycleFixture.mount({ delayStart: true }));
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent.includes('实验就绪'));
  await page.locator('#lab-mode').selectOption('live');
  await page.evaluate(() => window.lifecycleFixture.delayAudio());
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => window.lifecycleFixture.state().pending.includes('start'));
  await page.evaluate(() => { const f = window.lifecycleFixture; f.setHidden(true); f.resolve('start'); f.releaseAudio(); });
  await page.waitForFunction(() => !document.querySelector('#lab-play').disabled);
  await page.waitForTimeout(220);
  const hidden = await page.evaluate(() => window.lifecycleFixture.state());
  check(hidden.status.startsWith('实时已暂停') && !hidden.status.includes('实时运行'), 'before first chunk, background status explicitly says paused');
  check(hidden.pulls === 0 && hidden.streamSamples === 0 && hidden.time.startsWith('0.00') && hidden.play === '播放', 'paused label agrees with zero pulls, samples and playback time');
  await page.evaluate(() => window.lifecycleFixture.setHidden(false));
  await page.waitForTimeout(220);
  const visible = await page.evaluate(() => window.lifecycleFixture.state());
  check(visible.status.startsWith('实时已暂停') && visible.pulls === 0, 'return to visible keeps paused status and requires explicit playback');
  check(visible.errors.length === 0, 'no script errors or unhandled rejections');
  await page.evaluate(() => window.lifecycleFixture.dispose());
  return { passed: true, scope: 'Targeted visible-status regression using real mountLab with controlled visibility and pending native audio resume.', checks, hidden, visible };
}
