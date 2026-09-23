async page => {
  const stage = page.url().includes('stage=before') ? 'before' : 'after';
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('http://127.0.0.1:5183/docs/evidence/A2/A2-FULL-005/viewer.html');
  await page.waitForFunction(() => window.ready === true);
  // Fixed-camera visual comparison; product zoom reachability is checked separately.
  await page.evaluate(() => { qa.controls.minDistance = 0.6; });
  await page.addStyleTag({ content: '.lab-part-picker,.lab-part-card,.lab-field-interpolation-note{display:none!important}' });
  const views = [
    ['overview', [3.7, 5, 4.4], [0, 1, 0]],
    ['driver', [0.05, 1.85, -0.25], [0.1, 1.25, 1.15]],
    ['instrument', [0, 1.6, 0.55], [0.18, 1.37, 1.15]],
    ['console', [0.2, 2.2, 0.1], [0, 1.05, 0.35]],
  ];
  const records = [];
  for (const kind of ['ice', 'bev', 'hev', 'erev']) for (const [view, position, target] of views) {
    if ((view === 'console' || view === 'instrument') && kind !== 'bev') continue;
    const state = await page.evaluate(({ kind, view, position, target }) => {
      qa.show(kind, position, target, view);
      const model = qa.scene.getObjectByName(`teaching-suv-${kind}`);
      let triangles = 0, meshes = 0;
      model.traverse(item => { if (item.isMesh) { meshes++; triangles += (item.geometry.index?.count ?? item.geometry.getAttribute('position').count) / 3; } });
      const gl = qa.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
      return { kind, view, body: 'hidden', camera: qa.camera.position.toArray(), target: qa.controls.target.toArray(),
        triangles, meshes, gpu: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER), contextLost: gl.isContextLost() };
    }, { kind, view, position, target });
    if (state.contextLost) throw Error(`${kind} ${view}: WebGL context lost`);
    await page.screenshot({ path: `docs/evidence/A2/A2-FULL-012/${stage}-${kind}-${view}.png` });
    records.push(state);
  }
  return { stage, records };
}
