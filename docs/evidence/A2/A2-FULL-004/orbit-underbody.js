async page => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.waitForFunction(() => window.ready === true);
  await page.evaluate(() => {
    qa.show('bev', [4, 3.4, 4.8], [0, 0.7, 0], 'orbit-start');
    qa.viewer.reset();
    qa.draw();
  });
  const before = await page.evaluate(() => qa.camera.position.toArray());
  await page.mouse.move(750, 790);
  await page.mouse.down();
  await page.mouse.move(750, 145, { steps: 28 });
  await page.mouse.up();
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(16);
    await page.evaluate(() => qa.draw());
  }
  const after = await page.evaluate(() => {
    qa.clean();
    document.querySelector('#title').textContent = 'A2 BEV / 用户拖动到底部';
    return { position: qa.camera.position.toArray(), target: qa.controls.target.toArray(), polar: qa.controls.getPolarAngle() };
  });
  if (after.position[1] >= 0 || after.polar <= Math.PI / 2) throw Error(`underside not reachable: ${JSON.stringify(after)}`);
  await page.screenshot({ path: 'docs/evidence/A2/A2-FULL-004/orbit-underbody.png' });
  return { before, after, reachedBelowGround: true };
}
