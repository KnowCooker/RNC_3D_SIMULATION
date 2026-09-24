async (page) => {
  const checks = [];
  const assert = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
  await page.reload();
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const audit = async view => {
    const layout = await page.locator('.rnc-marker-label, .rnc-source-label').evaluateAll(labels => {
      const host = labels[0].parentElement.getBoundingClientRect();
      const rects = labels.map(el => el.getBoundingClientRect());
      return { count: labels.length, inside: labels.every((el, i) => !el.hidden && rects[i].left >= host.left && rects[i].right <= host.right && rects[i].top >= host.top && rects[i].bottom <= host.bottom), overlaps: rects.some((a, i) => rects.slice(i + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)) };
    });
    assert(layout.count === 16 && layout.inside && !layout.overlaps, `${view}: 12 hardware plus four source labels visible without overlap`);
    assert(await page.locator('[data-viewer-signal]').count() === 12, `${view}: original hardware channels unchanged`);
    for (const corner of ['fl', 'fr', 'rl', 'rr']) {
      const source = page.getByRole('button', { name: new RegExp(`^SOURCE ${corner.toUpperCase()} ·`) });
      assert((await source.getAttribute('title')).includes('不是新增测量信号'), `${view}: SOURCE ${corner} description distinguishes illustration from measurement`);
      await source.click(); await frame();
      assert((await page.locator('#wave-title').innerText()).startsWith(`${corner.toUpperCase()} · x /`), `${view}: SOURCE ${corner} opens corresponding reference x`);
      assert(await page.locator(`.rnc-marker-label[data-viewer-signal="x"][data-viewer-corner="${corner}"]`).getAttribute('aria-pressed') === 'true', `${view}: matching REF ${corner} selected`);
    }
  };
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole('button', { name: '复位视角与结构' }).click(); await frame();
  await audit('default');
  await page.screenshot({ path: 'output/playwright/a2-sources-default.png' });
  await page.getByRole('button', { name: '分层展开' }).click(); await frame();
  await audit('expanded');
  await page.screenshot({ path: 'output/playwright/a2-sources-expanded.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '复位视角与结构' }).click(); await frame();
  await audit('narrow');
  await page.locator('#viewer').screenshot({ path: 'output/playwright/a2-sources-narrow.png' });
  await page.getByRole('button', { name: /^SOURCE FL ·/ }).focus();
  await page.keyboard.press('Enter'); await frame();
  assert((await page.locator('#wave-title').innerText()).startsWith('FL · x /'), 'SOURCE keyboard action opens REF FL');
  return { assertions: checks.length, passed: checks };
}
