async page => {
  const stage = page.url().includes('stage=before') ? 'before' : 'after';
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('http://127.0.0.1:5183/docs/evidence/A2/A2-FULL-005/viewer.html');
  await page.waitForFunction(() => window.ready === true);
  await page.addStyleTag({ content: '.lab-part-picker,.lab-part-card,.lab-field-interpolation-note{display:none!important}' });
  const folder = 'docs/evidence/A2/A2-FULL-008';
  const views = [
    ['v1-front', [6.3, 3.9, 7.2], [0, 1, 0], 'solid'],
    ['v2-side', [7, 1.8, 0], [0, 1, 0], 'solid'],
    ['v3-rear', [-5.8, 3.4, -6.6], [0, 1, 0], 'solid'],
    ['v4-cabin', [3.7, 5, 4.4], [0, 1, 0], 'hidden'],
  ];
  const closeups = [
    ['front-detail', [3.4, 2.35, 4], [0, 1, 1.8], 'solid'],
    ['wheel-detail', [3, 1.5, 2.1], [0.8, 0.6, 1.45], 'solid'],
    ['cabin-detail', [2.2, 2.8, 2.35], [0, 1.25, 0.2], 'hidden'],
  ];
  const records = [];
  const kinds = stage === 'before' ? ['bev'] : ['ice', 'bev', 'hev', 'erev'];
  for (const kind of kinds) for (const [view, position, target, body] of [...views, ...(kind === 'bev' ? closeups : [])]) {
    const state = await page.evaluate(({ stage, kind, view, position, target, body }) => {
      qa.show(kind, position, target, view);
      qa.viewer.setBody(body);
      qa.draw(); qa.clean();
      const model = qa.scene.getObjectByName(`teaching-suv-${kind}`);
      let triangles = 0, meshes = 0;
      model.traverse(item => { if (item.isMesh) { meshes++; triangles += (item.geometry.index?.count ?? item.geometry.getAttribute('position').count) / 3; } });
      const gl = qa.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
      return { stage, kind, view, body, camera: qa.camera.position.toArray(), target: qa.controls.target.toArray(),
        triangles, meshes, gpu: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) };
    }, { stage, kind, view, position, target, body });
    await page.screenshot({ path: `${folder}/${stage}-${kind}-${view}.png` });
    records.push(state);
  }
  return { stage, records };
}
