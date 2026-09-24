async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent.includes('实验就绪'));

  const environment = await page.evaluate(() => {
    const canvas = document.querySelector('#lab-viewer canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
      gpu: gl ? gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
      vendor: gl ? gl.getParameter(info?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR) : null,
    };
  });

  const sample = async (label, durationMs) => {
    const measured = await page.evaluate(duration => new Promise(resolve => {
      const canvas = document.querySelector('#lab-viewer canvas');
      const rect = canvas.getBoundingClientRect();
      const started = performance.now(), frameMs = [];
      let previous = null;
      function frame(now) {
        if (previous !== null) frameMs.push(now - previous);
        previous = now;
        if (now - started < duration) { requestAnimationFrame(frame); return; }
        const sorted = [...frameMs].sort((a, b) => a - b);
        const percentile = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
        resolve({ elapsedMs: now - started, frames: frameMs.length,
          averageFps: frameMs.length * 1000 / (now - started),
          p95FrameMs: percentile(0.95), p99FrameMs: percentile(0.99),
          maxFrameMs: sorted.at(-1),
          canvasCss: { width: rect.width, height: rect.height },
          drawingBuffer: { width: canvas.width, height: canvas.height },
          documentVisibility: document.visibilityState,
          status: document.querySelector('#lab-status')?.textContent,
          fieldStatus: document.querySelector('#lab-field-status')?.textContent,
          clock: document.querySelector('#lab-time')?.textContent,
        });
      }
      requestAnimationFrame(frame);
    }), durationMs);
    return { label, ...measured };
  };

  const runs = [];
  runs.push(await sample('BEV default transparent, field off, replay paused', 8000));
  await page.locator('#lab-body').selectOption('solid');
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-paths').selectOption('both');
  await page.locator('#lab-waves').check();
  await page.locator('#lab-explode').click();

  for (const vehicle of ['ice', 'bev', 'hev', 'erev']) {
    await page.locator('#lab-vehicle').selectOption(vehicle);
    await page.locator('#lab-calculate').click();
    await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent.includes('实验就绪'));
    await page.locator('#lab-seek').focus();
    await page.keyboard.press('End');
    await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent.includes('空间窗口截至 16.00'));
    await page.waitForTimeout(500);
    runs.push({ vehicle, ...await sample(`${vehicle} solid, expanded, residual field, both paths, waves`, 8000) });
  }

  await page.locator('#lab-vehicle').selectOption('bev');
  await page.locator('#lab-mode').selectOption('live');
  await page.locator('#lab-mute').click();
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => parseFloat(document.querySelector('#lab-time')?.textContent ?? '0') > 2.5);
  await page.waitForTimeout(500);
  runs.push({ vehicle: 'bev', ...await sample('BEV live, solid, expanded, residual field, both paths, waves', 12000) });
  await page.locator('#lab-play').click();

  return { sourceCommit: 'b8ec8918ae87f7febc5eee59150027655ef658f4',
    scope: 'Production dist, full application and real Worker at 1920x1080. Browser requestAnimationFrame is a presentation cadence, not GPU timing or target integrated-GPU acceptance.',
    environment, runs, errors, passed: errors.length === 0 && runs.every(run => run.frames > 0) };
}
