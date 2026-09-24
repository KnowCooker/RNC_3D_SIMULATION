async (page) => {
  const before = await page.evaluate(() => ({ ...window.__finalQa, elapsedMs: Date.now() - window.__finalQa.startedAt }));
  if (!before.startedAt) throw new Error('QA setup is missing');
  const actions = [];
  const desiredComputations = Math.min(10, Math.floor(before.elapsedMs / 120000) + 1);
  if (before.computations < desiredComputations) {
    const index = before.computations;
    const configuration = { taps: index % 2 ? '32' : '64', seed: ['11','29','47'][index % 3], step: index % 4 === 3 ? '0' : '0.08' };
    await page.getByRole('combobox', { name: '滤波器系数数' }).selectOption(configuration.taps);
    await page.getByRole('combobox', { name: '学习步长 μ' }).selectOption(configuration.step);
    await page.getByRole('combobox', { name: '固定随机种子' }).selectOption(configuration.seed);
    const previous = await page.locator('#diagnostics').innerText();
    await page.getByRole('button', { name: '计算新实验', exact: true }).click();
    await page.waitForFunction(previous => {
      const diagnostics = document.querySelector('#diagnostics').textContent;
      return diagnostics !== previous && diagnostics.includes('computed-browser') && !document.querySelector('#calculate').disabled;
    }, previous, { timeout: 15000 });
    const diagnostics = await page.locator('#diagnostics').innerText();
    if (!diagnostics.includes(`seed=${configuration.seed}`) || !diagnostics.includes(`taps=${configuration.taps}`) || !diagnostics.includes(`μ=${configuration.step}`)) throw new Error('Computed configuration differs from requested configuration');
    await page.evaluate(() => ++window.__finalQa.computations);
    actions.push({ type: 'real-worker-computation', index: index + 1, configuration, diagnostics });
  }
  const index = before.switches;
  const seat = ['fl','fr','rl','rr'][index % 4];
  const mode = Math.floor(index / 4) % 2 ? 'e' : 'd';
  await page.getByRole('combobox', { name: '试听座位' }).selectOption(seat);
  await page.getByRole('combobox', { name: '声音对比' }).selectOption(mode);
  actions.push({ type: 'seat-and-mode-switch', seat, mode });
  await page.evaluate(() => ++window.__finalQa.switches);
  const position = await page.locator('#seek').inputValue();
  const transport = await page.locator('#play').innerText();
  if (transport === '播放' || Number(position) >= 12) {
    await page.getByRole('button', { name: '重播', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#play')?.textContent === '暂停', null, { timeout: 10000 });
    await page.evaluate(() => ++window.__finalQa.replays);
    actions.push({ type: 'replay' });
  }
  const devtools = await page.context().newCDPSession(page);
  const heap = await devtools.send('Runtime.getHeapUsage');
  const dom = await devtools.send('Memory.getDOMCounters');
  await devtools.detach();
  const state = await page.evaluate(() => {
    const canvas = document.querySelector('#viewer canvas');
    const gl = canvas?.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    ++window.__finalQa.samples;
    return {
      ...window.__finalQa, elapsedMs: Date.now() - window.__finalQa.startedAt,
      monotonicElapsedMs: performance.now() - window.__finalQa.performanceStart,
      source: document.querySelector('#source').textContent,
      diagnostics: document.querySelector('#diagnostics').textContent,
      time: document.querySelector('#time').textContent,
      fps: document.querySelector('#fps').textContent,
      play: document.querySelector('#play').textContent,
      status: document.querySelector('#status').textContent,
      liveElements: document.querySelectorAll('*').length,
      canvasCount: document.querySelectorAll('canvas').length,
      renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null,
      rendererMemory: window.__finalQaRenderer ? { ...window.__finalQaRenderer.info.memory } : null,
      rendererTriangles: window.__finalQaRenderer?.info.render.triangles,
      webglContextLost: gl?.isContextLost(),
      documentVisibility: document.visibilityState,
    };
  });
  if (state.errors.length || state.rejections.length || state.webglContextLost || !state.source.includes('浏览器计算')) throw new Error(JSON.stringify(state));
  return { sampledAt: new Date().toISOString(), actions, state, heap, dom };
}
