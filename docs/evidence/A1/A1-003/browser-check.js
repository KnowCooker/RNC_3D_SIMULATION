async page => {
  const checks = [], errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push(name); };
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('就绪'));
  const run = await page.locator('#diagnostics').textContent();
  await page.getByRole('combobox', { name: '声音对比', exact: true }).selectOption('d');
  await page.locator('#hardware [data-signal="e"][data-corner="rr"]').click();
  assert('MIC click selects residual for graph and audio after original-noise mode', await page.locator('#comparison').inputValue() === 'e' && await page.locator('#mic').inputValue() === 'rr' && await page.locator('#wave-title').textContent() === 'RR · e / Pa');
  await page.getByRole('combobox', { name: '声音对比', exact: true }).selectOption('d');
  assert('original-noise comparison retains MIC highlight and honest legend', (await page.locator('#hardware [data-signal="e"][data-corner="rr"]').getAttribute('class')).includes('selected') && await page.locator('#wave-legend').textContent() === '原噪声 d 灰色');
  for (const [signal, unit] of [['x','m/s²'], ['u','drive']]) {
    for (const corner of ['fl','fr','rl','rr']) {
      await page.locator(`#hardware [data-signal="${signal}"][data-corner="${corner}"]`).click();
      await page.waitForFunction(({signal,corner}) => document.querySelector('#wave').dataset.signal === signal && document.querySelector('#wave').dataset.channel === corner, {signal,corner});
      assert(`${signal}/${corner} uses correct unit and keeps prior RR original-noise audition explicit`, (await page.locator('#wave-title').textContent()).includes(unit) && (await page.locator('#psd-unit').textContent()).includes(unit) && await page.locator('#mic').inputValue() === 'rr' && await page.locator('#comparison').inputValue() === 'd' && (await page.locator('#selection-note').textContent()).includes('试听保持原座位'));
    }
  }
  for (const corner of ['fl','fr','rl','rr']) {
    await page.getByRole('combobox', { name: '试听座位', exact: true }).selectOption(corner);
    assert(`seat ${corner} maps d graph and MIC highlight`, await page.locator('#wave-title').textContent() === `${corner.toUpperCase()} · d / Pa` && (await page.locator(`#hardware [data-signal="e"][data-corner="${corner}"]`).getAttribute('class')).includes('selected'));
  }
  const seek = async value => {
    await page.locator('#seek').fill(String(value));
    await page.waitForFunction(value => Number(document.querySelector('#wave').dataset.endSample) === Math.floor(value * 2000), value);
  };
  await seek(0.49);
  assert('RMS and PSD show warming up before their windows', await page.locator('#metrics b').allTextContents().then(a => a.every(x => x === '准备中')) && (await page.locator('#spectrum-status').textContent()).includes('准备中'));
  await seek(0.5);
  assert('RMS becomes available at 0.5s while PSD still waits', await page.locator('#metrics b').allTextContents().then(a => a.every(x => x.includes('dB'))) && (await page.locator('#spectrum-status').textContent()).includes('准备中'));
  await seek(0.52);
  assert('PSD available at first supported slider tick beyond 1024 samples', !(await page.locator('#spectrum-status').textContent()).includes('准备中'));
  await seek(16);
  assert('end-position graph shares playback sample and run identity without autoplay', await page.locator('#play').textContent() === '播放' && (await page.locator('#diagnostics').textContent()) === run && (await page.locator('#wave').getAttribute('data-run-id')) === (await page.locator('#spectrum').getAttribute('data-run-id')));
  const layouts = [];
  for (const width of [1440, 900, 801, 800, 390, 320]) {
    await page.setViewportSize({width,height:900});
    await page.waitForFunction(width => innerWidth === width && document.documentElement.scrollWidth <= width, width, {timeout:5000});
    const size = await page.evaluate(() => ({width:innerWidth,documentWidth:document.documentElement.scrollWidth})); layouts.push(size);
    assert(`viewport ${width} has no horizontal overflow and retains metrics/controls`, size.documentWidth <= width && await page.locator('#metrics').isVisible() && await page.locator('#play').isVisible() && await page.locator('#comparison').isVisible());
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#metrics').scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/a1-003-narrow-metrics.png'});
  await page.locator('#play').scrollIntoViewIfNeeded();
  await page.screenshot({path:'output/playwright/a1-003-narrow-player.png'});
  await page.setViewportSize({width:1440,height:1100});
  await seek(2);
  await page.getByRole('button', {name:'播放',exact:true}).click();
  await page.waitForFunction(() => Number(document.querySelector('#seek').value) > 2.2);
  const samples = [];
  for (let i=0;i<10;i++) {
    samples.push(await page.evaluate(() => ({time:Number(document.querySelector('#seek').value),end:Number(document.querySelector('#wave').dataset.endSample)})));
    await page.waitForTimeout(150);
  }
  assert('rendered graph and transport stay within 100ms in foreground samples', samples.every(s => Math.abs(s.time-s.end/2000)<=0.1));
  await page.getByRole('button', {name:'暂停',exact:true}).click();
  assert('no uncaught page error', errors.length===0);
  return {count:checks.length,checks,layouts,samples,errors,scope:'UI clock observation, not physical audio/visual latency'};
}
