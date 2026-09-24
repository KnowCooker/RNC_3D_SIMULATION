async page => {
  const stage = page.url().includes('stage=before') ? 'before' : 'after';
  const folder = 'docs/evidence/A2/A2-FULL-015';
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('http://127.0.0.1:5183/docs/evidence/A2/A2-FULL-005/viewer.html');
  await page.waitForFunction(() => window.ready === true);
  await page.addStyleTag({ content: '.lab-part-picker,.lab-part-card,.lab-field-interpolation-note{display:none!important}' });
  const views = [
    ['side', [7, 1.8, 0], [0, 1, 0]],
    ['front-quarter', [6.3, 3.9, 7.2], [0, 1, 0]],
    ['rear-quarter', [-5.8, 3.4, -6.6], [0, 1, 0]],
    ['front-arch', [3.0, 1.45, 2.2], [0.9, 0.65, 1.45]],
    ['rear-arch', [3.0, 1.45, -2.2], [0.9, 0.65, -1.45]],
    ['rocker', [3.1, 1.15, 0], [0.9, 0.7, 0]],
  ];
  const records = [];
  for (const kind of ['ice', 'bev', 'hev', 'erev']) for (const [view, camera, target] of views) {
    if (['front-arch', 'rear-arch', 'rocker'].includes(view) && kind !== 'bev') continue;
    const state = await page.evaluate(({ kind, view, camera, target }) => {
      qa.show(kind, camera, target, view); qa.viewer.setBody('solid');
      qa.controls.target.set(...target); qa.camera.position.set(...camera); qa.controls.update(); qa.draw(); qa.clean();
      const model = qa.scene.getObjectByName(`teaching-suv-${kind}`);
      let triangles = 0, meshes = 0;
      model.traverse(item => { if (item.isMesh) { meshes++; triangles += (item.geometry.index?.count ?? item.geometry.getAttribute('position').count) / 3; } });
      const gl = qa.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
      return { kind, view, camera: qa.camera.position.toArray(), target: qa.controls.target.toArray(), triangles, meshes,
        gpu: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER), contextLost: gl.isContextLost() };
    }, { kind, view, camera, target });
    if (state.contextLost) throw Error(`${kind} ${view}: WebGL context lost`);
    await page.screenshot({ path: `${folder}/${stage}-${kind}-${view}.png` });
    records.push(state);
  }
  return { stage, records };
}
