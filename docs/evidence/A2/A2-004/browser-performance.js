async (page) => {
  await page.addInitScript(() => {
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
      const renderer = event.detail;
      if (!renderer.isWebGLRenderer) return;
      const render = renderer.render;
      renderer.render = function(scene, camera) {
        window.__a2Observed = { renderer, scene, camera };
        return render.apply(this, arguments);
      };
    });
  });
  await page.reload();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForFunction(() => Boolean(window.__a2Observed));
  // Only the test container changes: fixed 1280×720 drawing buffer for comparable measurement.
  await page.locator('#viewer').evaluate(host => { host.style.width = '1280px'; host.style.height = '720px'; });
  // Headed Chrome may retain the DPR from its initial window when the viewport changes.
  // Normalize only this benchmark renderer, without modifying production pixel-ratio policy.
  await page.evaluate(() => {
    const renderer = window.__a2Observed.renderer;
    renderer.setPixelRatio(1);
    renderer.setSize(1280, 720);
  });
  await page.getByRole('button', { name: '复位视角与结构' }).click();
  await page.waitForTimeout(500);
  const environment = await page.evaluate(() => {
    const { renderer } = window.__a2Observed;
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { userAgent: navigator.userAgent, devicePixelRatio, benchmarkPixelRatio: renderer.getPixelRatio(), viewport: [innerWidth, innerHeight], buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR) };
  });
  const measure = () => page.evaluate(() => new Promise(resolve => {
    const startedAt = new Date().toISOString(), start = performance.now(), intervals = [];
    let last = start, triangles = 0;
    function sample(now) {
      intervals.push(now - last); last = now;
      triangles = Math.max(triangles, window.__a2Observed.renderer.info.render.triangles);
      if (now - start < 15000) { requestAnimationFrame(sample); return; }
      const elapsedMs = now - start, sorted = intervals.slice(1).sort((a, b) => a - b);
      resolve({ startedAt, endedAt: new Date().toISOString(), elapsedMs, frames: intervals.length, averageFps: intervals.length * 1000 / elapsedMs, p95FrameMs: sorted[Math.floor(sorted.length * 0.95)], maxRenderedTriangles: triangles, memory: { ...window.__a2Observed.renderer.info.memory } });
    }
    requestAnimationFrame(sample);
  }));
  const defaultView = await measure();
  await page.getByRole('button', { name: '分层展开' }).click();
  const expandedView = await measure();
  return { environment, defaultView, expandedView, totalAverageFps: (defaultView.frames + expandedView.frames) * 1000 / (defaultView.elapsedMs + expandedView.elapsedMs), scope: 'Local browser frame sampling only; GPU identity determines whether this is a target integrated-GPU result. Not an audio latency or second-machine test.' };
}
