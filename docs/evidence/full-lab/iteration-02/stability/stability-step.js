async page => {
  const before = await page.evaluate(() => ({ elapsed: (Date.now() - __liveQa.exerciseStartedAt) / 1000, restarts: __liveQa.restarts, switches: __liveQa.switches, samples: __liveQa.samples, backgroundTest: __liveQa.backgroundTest }));
  const actions = [];
  // Preserve one genuine continuous run well beyond 300 s before restarting anything.
  if (before.elapsed >= 345 && !before.backgroundTest) {
    const original = await page.evaluate(() => ({ time: parseFloat(document.querySelector('#lab-time').textContent), runId: __liveQa.currentRun, visibility: document.visibilityState }));
    const other = await page.context().newPage(); await other.goto('about:blank'); await other.bringToFront();
    await page.waitForTimeout(250);
    const hidden = await page.evaluate(() => ({ state: document.visibilityState, time: parseFloat(document.querySelector('#lab-time').textContent), play: document.querySelector('#lab-play').textContent }));
    await page.waitForTimeout(750);
    const later = await page.evaluate(() => ({ state: document.visibilityState, time: parseFloat(document.querySelector('#lab-time').textContent), play: document.querySelector('#lab-play').textContent }));
    await other.close(); await page.bringToFront();
    await page.waitForTimeout(100);
    const foreground = await page.evaluate(() => ({ state: document.visibilityState, time: parseFloat(document.querySelector('#lab-time').textContent), play: document.querySelector('#lab-play').textContent }));
    const test = { original, hidden, later, foreground, actuallyHidden: hidden.state === 'hidden', frozenWhileHidden: hidden.state === 'hidden' ? Math.abs(later.time - hidden.time) <= .03 : null, staysPausedOnReturn: hidden.state === 'hidden' ? foreground.play === '播放' : null, note: hidden.state === 'hidden' ? 'Actual browser tab visibility transition.' : 'Headless tab switch did not hide this document; background behavior remains unverified here.' };
    await page.evaluate(test => { __liveQa.backgroundTest = test; }, test);
    actions.push({ type: 'browser-tab-background', ...test });
    if (hidden.state === 'hidden' && (!test.frozenWhileHidden || !test.staysPausedOnReturn)) throw new Error('Real background pause behavior failed');
    if (foreground.play === '播放') { await page.locator('#lab-play').click(); await page.evaluate(() => __liveQa.playActions++); }
  }
  const desired = before.elapsed < 380 ? 0 : Math.min(12, Math.floor((before.elapsed - 380) / 60) + 1);
  if (before.restarts < desired) {
    const index = before.restarts, mode = index % 2 === 0 ? 'replay' : 'live', vehicle = ['ice','bev','hev','erev'][index % 4], taps = index % 3 === 0 ? '32' : '64';
    const previous = await page.evaluate(() => __liveQa.currentRun);
    await page.locator('#lab-mode').selectOption(mode);
    await page.locator('#lab-vehicle').selectOption(vehicle);
    await page.locator('#lab-taps').fill(taps); await page.locator('#lab-taps').press('Tab');
    await page.locator('#lab-step').fill(index % 5 === 4 ? '0' : '0.08'); await page.locator('#lab-step').press('Tab');
    await page.locator('[data-speaker="1"]').setChecked(index % 4 !== 2);
    await page.locator('#lab-calculate').click();
    await page.waitForFunction(({previous, mode}) => {
      const run = __liveQa.runs.find(run => run.runId === __liveQa.currentRun);
      return run && run.runId !== previous && run.ready && !document.querySelector('#lab-play').disabled && (mode === 'replay' || run.endSample >= 1200);
    }, { previous, mode }, { timeout: 20000 });
    const run = await page.evaluate(() => { __liveQa.restarts++; return structuredClone(__liveQa.runs.find(run => run.runId === __liveQa.currentRun)); });
    if (run.config.vehicle !== vehicle || String(run.config.taps) !== taps) throw new Error('Real Worker config differs from requested UI');
    actions.push({ type: 'real-worker-restart', mode, runId: run.runId, vehicle, taps, batchSampleCount: run.batchSampleCount, readyAt: run.readyAt });
    if (mode === 'replay') { await page.locator('#lab-play').click(); await page.evaluate(() => __liveQa.playActions++); }
  }
  const seat = String((before.switches + 1) % 4), comparison = before.switches % 2 === 0 ? 'd' : 'e';
  await page.locator('#lab-seat').selectOption(seat); await page.locator('#lab-comparison').selectOption(comparison);
  await page.evaluate(() => __liveQa.switches++); actions.push({ type: 'seat-and-mode-switch', seat, comparison });
  const live = await page.locator('#lab-mode').inputValue() === 'live';
  if (!live) {
    await page.locator('#lab-replay').click(); await page.evaluate(() => __liveQa.playActions++); actions.push({ type: 'batch-replay' });
  }
  // Exercise reversible spatial views without altering acoustic configuration or live state.
  const viewIndex = Math.floor(before.samples / 3);
  if (before.samples % 3 === 0) {
    await page.locator('#lab-explode').click();
    await page.locator('#lab-body').selectOption(['transparent','solid','hidden'][viewIndex % 3]);
    await page.locator('#lab-section').selectOption(['none','x','y','z'][viewIndex % 4]);
    await page.locator('#lab-field-slice').selectOption(['volume','x','y','z'][viewIndex % 4]);
    await page.locator('#lab-field').selectOption(viewIndex % 2 ? 'primary' : 'residual');
    actions.push({ type: 'spatial-view', viewIndex });
  }
  const cdp = await page.context().newCDPSession(page);
  const heap = await cdp.send('Runtime.getHeapUsage'), dom = await cdp.send('Memory.getDOMCounters'); await cdp.detach();
  const state = await page.evaluate(() => {
    const qa = __liveQa, canvas = document.querySelector('#lab-viewer canvas'), gl = canvas?.getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const status = document.querySelector('#lab-status').textContent, buffer = /缓冲\s+([\d.]+)\s+s/.exec(status), underruns = /补缓冲\s+(\d+)\s+次/.exec(status);
    const intervals = [...qa.frameIntervals].sort((a,b)=>a-b), meanFrame = intervals.reduce((sum,n)=>sum+n,0)/Math.max(1,intervals.length);
    qa.samples++;
    return {
      sampledAt: Date.now(), elapsedSeconds: (Date.now()-qa.exerciseStartedAt)/1000, monotonicElapsedSeconds: (performance.now()-qa.performanceStart)/1000,
      samples: qa.samples, restarts: qa.restarts, switches: qa.switches, playActions: qa.playActions, currentRun: qa.currentRun,
      runs: qa.runs.map(({ first16Hashes, ...run }) => ({...run, storedFirst16Hashes:Object.keys(first16Hashes).length})),
      workerCreated:qa.workerCreated, activeWorkers:qa.activeWorkers, peakWorkers:qa.peakWorkers, workerMessages:qa.workerMessages, maximumSnapshotSamples:qa.maximumSnapshotSamples,
      audio: {...qa.audio, contexts: qa.audio.contexts.map(({sources,...context})=>({...context,activeSources:sources.size}))},
      errors: [...qa.errors], rejections:[...qa.rejections], violations:[...qa.violations], glLosses:[...qa.glLosses], backgroundTest:qa.backgroundTest, visibilityEvents:[...qa.visibilityEvents],
      time:document.querySelector('#lab-time').textContent, timeSeconds:parseFloat(document.querySelector('#lab-time').textContent), play:document.querySelector('#lab-play').textContent, status,
      queuedSeconds:buffer?Number(buffer[1]):null, underruns:underruns?Number(underruns[1]):null, mode:document.querySelector('#lab-mode').value,
      fieldStatus:document.querySelector('#lab-field-status').textContent, liveElements:document.querySelectorAll('*').length, canvasCount:document.querySelectorAll('canvas').length,
      renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null, webglContextLost:gl?.isContextLost(), rendererMemory:window.__liveQaRenderer?{...__liveQaRenderer.info.memory}:null, rendererTriangles:window.__liveQaRenderer?.info.render.triangles,
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}, drawingBuffer:canvas?{width:canvas.width,height:canvas.height}:null, documentVisibility:document.visibilityState,
      recentFrames:{samples:intervals.length,meanMs:meanFrame,averageFps:1000/meanFrame,p95Ms:intervals[Math.floor(intervals.length*.95)]??null,maxMs:intervals.at(-1)??null},
    };
  });
  const failure = state.errors.length || state.rejections.length || state.violations.length || state.glLosses.length || state.webglContextLost || state.runs.some(run=>run.errors.length) || state.activeWorkers>1 || state.audio.activeSources>16 || (state.queuedSeconds!==null&&state.queuedSeconds>2.01);
  return { sampledAt:new Date().toISOString(), actions, state, heap, dom, failure:!!failure };
}
