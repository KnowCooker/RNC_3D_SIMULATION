async (page) => {
  const checks = [];
  const pageErrors = [];
  const onError = error => pageErrors.push(error.message);
  page.on('pageerror', onError);
  const button = name => page.getByRole('button', { name, exact: true });
  const progress = page.getByRole('slider', { name: '播放进度', exact: true });
  const time = async () => Number.parseFloat(await page.locator('#time').textContent());
  const assert = (ok, label, detail = {}) => {
    if (!ok) throw new Error(`${label}: ${JSON.stringify(detail)}`);
    checks.push({ check: label, passed: true, ...detail });
  };
  const waitLabel = async label => {
    await page.waitForFunction(value => document.querySelector('#play').textContent === value, label);
  };
  try {
    await page.bringToFront();
    await page.reload();
    await button('播放').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#play').disabled);
    const run = await page.locator('#diagnostics').textContent();
    await button('播放').click();
    await waitLabel('暂停');
    await page.waitForFunction(() => Number.parseFloat(document.querySelector('#time').textContent) >= 0.5);
    await button('暂停').click();
    await waitLabel('播放');
    const paused = await time();
    await page.waitForTimeout(300);
    assert(await time() === paused, 'pause freezes time', { time: paused });
    await button('播放').click();
    await waitLabel('暂停');
    assert(await time() >= paused, 'resume keeps position');
    for (const channel of ['fl', 'fr', 'rl', 'rr']) {
      await page.getByRole('combobox', { name: '试听座位', exact: true }).selectOption(channel);
      for (const mode of ['d', 'e']) {
        const before = await time();
        await page.getByRole('combobox', { name: '声音对比', exact: true }).selectOption(mode);
        await page.waitForTimeout(60);
        const after = await time();
        assert(after >= before && after < 16, `continuous ${channel}/${mode}`, { before, after });
        assert((await page.locator('#wave-title').textContent()).startsWith(`${channel.toUpperCase()} · ${mode}`), `selected signal ${channel}/${mode}`);
      }
    }
    await button('静音').click();
    const volume = page.getByRole('slider', { name: '音量', exact: true });
    await volume.press('Home');
    await volume.press('PageUp');
    const mutedVolume = await volume.inputValue();
    assert(await button('取消静音').count() === 1, 'volume adjustment retains mute');
    await button('取消静音').click();
    assert(await volume.inputValue() === mutedVolume, 'unmute retains selected volume', { volume: mutedVolume });
    await progress.press('End');
    await waitLabel('播放');
    await progress.press('Home');
    await page.waitForFunction(() => document.querySelector('#time').textContent.startsWith('00.00'));
    await page.waitForTimeout(200);
    assert(await time() === 0 && await button('播放').count() === 1, 'seek after end stays paused');
    await button('播放').click();
    await waitLabel('暂停');
    await button('重播').click();
    await page.waitForTimeout(150);
    assert(await time() < 1 && await button('暂停').count() === 1, 'replay while playing restarts');
    await button('暂停').click();
    await button('重播').click();
    await waitLabel('暂停');
    assert(await time() < 1, 'replay while paused starts');
    // Wait for one full natural completion, instead of treating seek-to-end as completion.
    await page.waitForFunction(() => document.querySelector('#time').textContent.startsWith('16.00') && document.querySelector('#play').textContent === '播放', null, { timeout: 20000 });
    await progress.press('Home');
    await page.waitForFunction(() => document.querySelector('#time').textContent.startsWith('00.00'));
    await page.waitForTimeout(200);
    assert(await time() === 0 && await button('播放').count() === 1, 'natural end followed by seek stays paused');
    await button('重播').click();
    await waitLabel('暂停');
    assert(await time() < 1, 'replay after natural completion');
    await button('暂停').click();

    // Delay only the browser audio resume boundary to exercise the real UI's pending state.
    await page.evaluate(() => {
      const original = AudioContext.prototype.resume;
      window.__restoreResume = () => { AudioContext.prototype.resume = original; };
      AudioContext.prototype.resume = function () {
        return original.call(this).then(() => new Promise(resolve => { window.__releaseResume = resolve; }));
      };
    });
    await button('播放').click();
    await waitLabel('取消启动');
    await page.waitForFunction(() => typeof window.__releaseResume === 'function');
    await button('取消启动').click();
    await page.evaluate(() => window.__releaseResume());
    await waitLabel('播放');
    await page.waitForTimeout(150);
    assert(await button('播放').count() === 1, 'cancel pending audio start');
    await button('播放').click();
    await waitLabel('取消启动');
    await button('载入参考算例').click();
    await page.waitForFunction(() => !document.querySelector('#play').disabled);
    await page.evaluate(() => { window.__releaseResume(); window.__restoreResume(); });
    await page.waitForTimeout(150);
    assert(await time() === 0 && await button('播放').count() === 1, 'load cancels pending audio start');
    await button('播放').click();
    await waitLabel('暂停');
    await button('暂停').click();
    assert(pageErrors.length === 0, 'no uncaught page errors', { pageErrors });
    return { checkedAt: new Date().toISOString(), userAgent: await page.evaluate(() => navigator.userAgent), run, checks };
  } finally {
    await page.evaluate(() => { window.__releaseResume?.(); window.__restoreResume?.(); });
    page.off('pageerror', onError);
  }
}
