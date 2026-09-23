async page => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto('http://127.0.0.1:5183/docs/evidence/A2/A2-FULL-005/viewer.html');
  await page.waitForFunction(() => window.ready === true);
  const rows = [];
  const folder = 'docs/evidence/A2/A2-FULL-005';
  const waitFrames = async count => {
    for (let i = 0; i < count; i++) {
      await page.waitForTimeout(16);
      await page.evaluate(() => qa.draw());
    }
  };
  const record = async (kind, view) => {
    const state = await page.evaluate(({ kind, view }) => {
      document.querySelector('#title').textContent = `A2 ${kind.toUpperCase()} / ${view.toUpperCase()}`;
      qa.draw(); qa.clean();
      const gpuInfo = qa.renderer.getContext().getExtension('WEBGL_debug_renderer_info');
      const gl = qa.renderer.getContext();
      const sections = qa.scene.getObjectByName('vehicle-sections');
      return {
        kind, view, camera: qa.camera.position.toArray(), target: qa.controls.target.toArray(),
        polar: qa.controls.getPolarAngle(), maxPolar: qa.controls.maxPolarAngle,
        roofLift: qa.scene.getObjectByName('roof')?.position.y ?? null,
        seatLift: qa.scene.getObjectByName('seat-1')?.position.y ?? null,
        caps: sections?.children.filter(item => item.name === 'section-cap' && item.visible).length ?? 0,
        contours: sections?.children.filter(item => item.name === 'section-contour' && item.visible).length ?? 0,
        gpu: gl.getParameter(gpuInfo?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
      };
    }, { kind, view });
    await page.screenshot({ path: `${folder}/${kind}-${view}.png` });
    rows.push(state);
  };
  for (const kind of ['ice', 'bev', 'hev', 'erev']) {
    await page.evaluate(kind => {
      qa.show(kind, [6.3, 3.9, 7.2], [0, 1, 0], 'V7 前左分层');
      qa.viewer.setBody('transparent');
    }, kind);
    await waitFrames(72); await record(kind, 'v7-closed');
    await page.evaluate(() => qa.viewer.setExploded(true));
    await waitFrames(4); await record(kind, 'v7-middle');
    await waitFrames(72); await record(kind, 'v7-open');
    await page.evaluate(() => qa.viewer.setExploded(false));
    await waitFrames(72); await record(kind, 'v7-returned');
    await page.evaluate(kind => {
      qa.show(kind, [-5.8, 3.4, -6.6], [0, 1, 0], 'V7 后右分层');
      qa.viewer.setBody('transparent');
    }, kind);
    await waitFrames(72); await record(kind, 'v7-rear-closed');
    await page.evaluate(() => qa.viewer.setExploded(true));
    await waitFrames(4); await record(kind, 'v7-rear-middle');
    await waitFrames(72); await record(kind, 'v7-rear-open');
    await page.evaluate(() => qa.viewer.setExploded(false));
    await waitFrames(72); await record(kind, 'v7-rear-returned');
    for (const [axis, cut] of [['x', 0], ['y', 1.05], ['z', 0.1]]) {
      await page.evaluate(({ axis, cut }) => {
        qa.viewer.setBody('solid'); qa.viewer.setSection(axis, cut); qa.draw(); qa.clean();
      }, { axis, cut });
      await record(kind, `v8-${axis}`);
      const latest = rows.at(-1);
      if (latest.caps < 1 || latest.polar > latest.maxPolar + 1e-5) throw Error(`Unusable section ${JSON.stringify(latest)}`);
    }
  }
  return { rows };
}
