async page => {
  const stage = page.url().includes('stage=before') ? 'before' : 'after';
  const folder = 'docs/evidence/A2/A2-FULL-014';
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('http://127.0.0.1:5183/docs/evidence/A2/A2-FULL-005/viewer.html');
  await page.waitForFunction(() => window.ready === true);
  await page.addStyleTag({ content: '.lab-part-picker,.lab-part-card,.lab-field-interpolation-note{display:none!important}' });
  const views = [
    ['side', [7, 1.8, 0], [0, 1, 0], 'solid'],
    ['roof', [4, 4.6, 2.7], [0, 1.7, -0.2], 'solid'],
    ['cabin', [3.7, 5, 4.4], [0, 1, 0], 'hidden'],
    ['front-seat', [1.55, 2.15, 0.3], [0.48, 1.28, 0.55], 'hidden'],
    ['rear-seat', [1.3, 2.0, -1.5], [0, 1.25, -0.8], 'hidden'],
    ['rear-bench', [0, 2.25, 1.4], [0, 1.25, -0.79], 'hidden'],
    ['door-close', [2.3, 1.55, 0.2], [0.9, 1.05, 0.3], 'solid'],
  ];
  const records = [];
  for (const kind of ['ice', 'bev', 'hev', 'erev']) for (const [view, camera, target, body] of views) {
    if (['front-seat', 'rear-seat', 'rear-bench', 'door-close'].includes(view) && kind !== 'bev') continue;
    const state = await page.evaluate(({ kind, view, camera, target, body }) => {
      qa.show(kind, camera, target, view); qa.viewer.setBody(body);
      if (view === 'rear-bench') for (const id of ['seat-1', 'seat-2']) qa.scene.getObjectByName(id).visible = false;
      qa.controls.target.set(...target); qa.camera.position.set(...camera); qa.controls.update(); qa.draw(); qa.clean();
      const model = qa.scene.getObjectByName(`teaching-suv-${kind}`);
      let triangles = 0, meshes = 0;
      model.traverse(item => { if (item.isMesh) { meshes++; triangles += (item.geometry.index?.count ?? item.geometry.getAttribute('position').count) / 3; } });
      const gl = qa.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
      return { kind, view, body, frontSeatsHiddenForInspection: view === 'rear-bench', camera: qa.camera.position.toArray(), target: qa.controls.target.toArray(), triangles, meshes,
        gpu: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER), contextLost: gl.isContextLost() };
    }, { kind, view, camera, target, body });
    if (state.contextLost) throw Error(`${kind} ${view}: WebGL context lost`);
    await page.screenshot({ path: `${folder}/${stage}-${kind}-${view}.png` });
    records.push(state);
  }
  return { stage, records };
}
