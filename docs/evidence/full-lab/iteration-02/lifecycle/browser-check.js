async page => {
  const checks = [], states = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const state = () => page.evaluate(() => window.lifecycleFixture.state());
  const settled = () => page.waitForTimeout(220);
  const mount = async options => {
    await page.evaluate(options => window.lifecycleFixture.mount(options), options);
    await page.waitForTimeout(60);
  };
  const ready = () => page.waitForFunction(() => document.querySelector('#lab-status')?.textContent.includes('实验就绪'));
  const pending = kind => page.waitForFunction(kind => window.lifecycleFixture.state().pending.includes(kind), kind);
  const empty = async label => {
    await settled(); const value = await state(); states.push({ label, ...value });
    check(value.nodes === 0, `${label}: disposed root stays empty`);
    check(value.lateDomWrites === 0, `${label}: no late DOM writes`);
    check(value.errors.length === 0, `${label}: no script error or unhandled rejection`);
  };
  try {
    await page.waitForFunction(() => window.lifecycleFixture?.ready);
    await page.setViewportSize({ width: 1500, height: 1050 });

    await mount({ delayStart: true }); await ready();
    await page.locator('#lab-mode').selectOption('live');
    await page.evaluate(() => window.lifecycleFixture.delayAudio());
    await page.locator('#lab-calculate').click(); await pending('start');
    check((await state()).audioResumeCalls === 1, 'startup has an actual pending AudioContext.resume');
    await page.evaluate(() => { const f = window.lifecycleFixture; f.setHidden(true); f.resolve('start'); f.releaseAudio(); });
    await page.waitForFunction(() => !document.querySelector('#lab-play').disabled);
    await settled(); let value = await state(); states.push({ label: 'startup-hidden', ...value });
    check(value.pulls === 0 && value.streamSamples === 0, 'startup hidden: producer did not calculate ahead');
    check(value.play === '播放' && value.time.startsWith('0.00'), 'startup hidden: playback remains paused at zero');
    await page.evaluate(() => window.lifecycleFixture.setHidden(false)); await settled();
    check((await state()).pulls === 0, 'returning from startup background does not auto-resume');
    await page.locator('#lab-play').click();
    await page.waitForFunction(() => parseFloat(document.querySelector('#lab-time').textContent) > 0.6);
    await page.locator('#lab-play').click(); await settled();
    const beforeResume = await state();
    await page.evaluate(() => window.lifecycleFixture.delayAudio());
    await page.locator('#lab-play').click();
    await page.waitForFunction(() => document.querySelector('#lab-play').textContent === '启动中');
    await page.evaluate(() => { const f = window.lifecycleFixture; f.setHidden(true); f.releaseAudio(); });
    await settled(); value = await state(); states.push({ label: 'resume-hidden', ...value });
    check(value.play === '播放', 'resume hidden: pending resume cannot revive playback');
    check(Math.abs(parseFloat(value.time) - parseFloat(beforeResume.time)) < 0.02, 'resume hidden: simulation time stays frozen');
    check(value.pulls === beforeResume.pulls, 'resume hidden: no extra chunk request');
    await page.evaluate(() => window.lifecycleFixture.setHidden(false)); await settled();
    check((await state()).play === '播放', 'return from resume background still requires explicit play');
    await page.evaluate(() => window.lifecycleFixture.dispose()); await empty('normal-live-dispose');

    await mount({ delayCalculate: true }); await pending('calculate');
    await page.evaluate(() => window.lifecycleFixture.dispose()); await empty('calculate-reject-after-dispose');

    await mount({ delayCalculate: true, holdCancel: true }); await pending('calculate');
    await page.evaluate(async () => { await window.lifecycleFixture.dispose(); window.lifecycleFixture.resolve('calculate'); });
    await empty('calculate-success-after-dispose');

    await mount({ delayField: true, holdCancel: true }); await ready();
    await page.locator('#lab-seek').focus(); await page.keyboard.press('End');
    await page.locator('#lab-field').selectOption('residual'); await pending('field');
    await page.evaluate(async () => { await window.lifecycleFixture.dispose(); window.lifecycleFixture.resolve('field'); });
    await empty('field-success-after-dispose');

    await mount({ delayStart: true, holdCancel: true }); await ready();
    await page.locator('#lab-mode').selectOption('live');
    await page.evaluate(() => window.lifecycleFixture.delayAudio());
    await page.locator('#lab-calculate').click(); await pending('start');
    await page.evaluate(async () => {
      const f = window.lifecycleFixture; await f.dispose(); f.resolve('start'); f.releaseAudio();
    });
    await empty('start-and-audio-resume-after-dispose');

    await mount({}); await ready();
    await page.locator('#lab-speed').focus(); await page.keyboard.press('Home'); await page.locator('#lab-taps').focus();
    check(await page.locator('#lab-speed').inputValue() === '0', 'parked case uses actual speed zero input');
    await page.locator('#lab-calculate').click(); await ready();
    await page.locator('#lab-seek').focus(); await page.keyboard.press('End');
    await page.locator('#lab-field').selectOption('residual');
    await page.waitForFunction(() => document.querySelector('#lab-field-status').textContent.includes('低于计算底限'));
    value = await state(); states.push({ label: 'parked-real-engine', ...value });
    check(value.time.startsWith('16.00'), 'parked: window is complete at 16 seconds');
    check(value.metric.split('声压低于计算底限').length - 1 === 4 && !value.metric.includes('准备中'), 'parked: all four metrics distinguish energy floor from warm-up');
    check(value.field.includes('无有效声场') && !value.field.includes('需要0.5秒'), 'parked: field states no excitation rather than insufficient window');
    check(value.errors.length === 0, 'all cases have no browser script errors');
    await page.screenshot({ path: 'output/playwright/live-lifecycle/parked.png', fullPage: true });
    await page.evaluate(() => window.lifecycleFixture.dispose()); await empty('final-dispose');
    return { passed: true, scope: 'Real mountLab, WebGL, AudioContext and physical engine; controlled promise delays and visibilitychange injection. No claim of OS/tab background timing.', checks, states };
  } catch (error) {
    return { passed: false, checks, states, error: String(error), finalState: await state() };
  }
}
