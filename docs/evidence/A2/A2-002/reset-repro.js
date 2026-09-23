async (page) => {
  // Test-side observation only: Three.js already emits its renderer via this devtools hook.
  await page.addInitScript(() => {
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
      const renderer = event.detail;
      if (!renderer.isWebGLRenderer) return;
      const render = renderer.render;
      renderer.render = function(scene, camera) {
        window.__a2Observed = { scene, camera, renderer };
        return render.apply(this, arguments);
      };
    });
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.waitForFunction(() => Boolean(window.__a2Observed));
  const position = () => page.evaluate(() => window.__a2Observed.camera.position.toArray());
  const initial = await position();
  const box = await page.locator('#viewer canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.72, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: '复位视角与结构' }).click();
  const justReset = await position();
  await page.waitForTimeout(600);
  const later = await position();
  return { initial, justReset, later, error: Math.hypot(...later.map((x, i) => x - initial[i])) };
}
