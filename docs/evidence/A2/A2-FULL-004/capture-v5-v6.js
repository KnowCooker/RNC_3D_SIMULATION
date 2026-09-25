async page => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.waitForFunction(() => window.ready === true);
  const views = {
    'v5-front': { position: [1.9, 2.1, 3.7], target: [0, 0.9, 1.5] },
    'v5-rear': { position: [-1.9, -1.05, -3.55], target: [0, 0.64, -1.46] },
    'v6-underbody': { position: [-2.8, -2.3, 2.0], target: [0, 0.48, 0] },
  };
  const captures = [];
  for (const kind of ['ice', 'bev', 'hev', 'erev']) {
    for (const [view, setting] of Object.entries(views)) {
      const state = await page.evaluate(({ kind, view, setting }) => {
        qa.show(kind, setting.position, setting.target, view);
        const gl = qa.renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          kind, view, body: 'hidden', camera: qa.camera.position.toArray(),
          target: qa.controls.target.toArray(), maxPolarAngle: qa.controls.maxPolarAngle,
          gpu: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
        };
      }, { kind, view, setting });
      await page.screenshot({ path: `docs/evidence/A2/A2-FULL-004/${kind}-${view}.png` });
      captures.push(state);
    }
  }
  for (const kind of ['ice', 'bev', 'hev', 'erev']) {
    await page.evaluate(kind => {
      qa.show(kind, [-2.1, 1.0, -3.6], [0, 0.8, -1.45], 'v5-rear-open');
      qa.viewer.setExploded(true);
    }, kind);
    for (let i = 0; i < 70; i++) {
      await page.waitForTimeout(16);
      await page.evaluate(() => qa.draw());
    }
    const state = await page.evaluate(kind => {
      qa.clean();
      const gl = qa.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        kind, view: 'v5-rear-open', body: 'hidden', exploded: true,
        camera: qa.camera.position.toArray(), target: qa.controls.target.toArray(),
        motorOffset: qa.scene.getObjectByName('traction-motor-rear')?.position.toArray() ?? null,
        gpu: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      };
    }, kind);
    await page.screenshot({ path: `docs/evidence/A2/A2-FULL-004/${kind}-v5-rear-open.png` });
    captures.push(state);
  }
  return { captures };
}
