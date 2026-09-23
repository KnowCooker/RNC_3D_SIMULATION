async (page) => {
  const results = [];
  const check = (condition, name) => { if (!condition) throw new Error(name); results.push(name); };
  const settle = async () => page.waitForTimeout(500);
  const audit = async (name) => {
    const layout = await page.locator('.rnc-marker-label').evaluateAll(labels => {
      const host = labels[0].parentElement.getBoundingClientRect();
      const bounds = labels.map(el => ({ text: el.textContent, r: el.getBoundingClientRect(), hidden: el.hidden }));
      const overlaps = [];
      for (let i = 0; i < bounds.length; i++) for (let j = i + 1; j < bounds.length; j++) {
        const a = bounds[i].r, b = bounds[j].r;
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlaps.push([bounds[i].text, bounds[j].text]);
      }
      return { count: bounds.length, overlaps, inside: bounds.every(({ r, hidden }) => !hidden && r.left >= host.left && r.top >= host.top && r.right <= host.right && r.bottom <= host.bottom) };
    });
    check(layout.count === 12 && layout.inside && layout.overlaps.length === 0, `${name}: 12 visible labels inside viewport without overlap`);
    for (const [prefix, signal] of [['REF', 'x'], ['OUT', 'u'], ['MIC', 'e']]) {
      for (const corner of ['fl', 'fr', 'rl', 'rr']) {
        const label = page.getByRole('button', { name: new RegExp(`^${prefix} ${corner.toUpperCase()} ·`) });
        await label.click();
        await page.waitForFunction(({ signal, corner }) => document.querySelector('#wave-title').textContent.startsWith(`${corner.toUpperCase()} · ${signal} /`), { signal, corner });
        await page.waitForFunction(({ signal, corner }) => [...document.querySelectorAll('.rnc-marker-label')].some(el => el.dataset.viewerSignal === signal && el.dataset.viewerCorner === corner && el.getAttribute('aria-pressed') === 'true'), { signal, corner });
        check(await label.getAttribute('aria-pressed') === 'true', `${name}: ${prefix} ${corner} click updates chart and marker`);
        if (signal === 'e') check(await page.getByRole('combobox', { name: '试听座位' }).inputValue() === corner, `${name}: MIC ${corner} updates listening seat`);
      }
    }
  };
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole('button', { name: '复位视角与结构' }).click();
  await settle();
  const firstAnchor = await page.locator('.rnc-marker-leaders line').first().evaluate(line => {
    const host = line.closest('.rnc-viewer').getBoundingClientRect();
    return { x: host.left + Number(line.getAttribute('x1')), y: host.top + Number(line.getAttribute('y1')) };
  });
  await page.mouse.click(firstAnchor.x, firstAnchor.y);
  check((await page.locator('#wave-title').innerText()).startsWith('FL · x /'), 'sphere raycast still selects REF FL');
  await audit('default');
  await page.screenshot({ path: 'output/playwright/a2-default.png' });
  const canvas = page.locator('#viewer canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.75, { steps: 25 });
  await page.mouse.up();
  await settle();
  check((await page.locator('#wave-title').innerText()).startsWith('RR · e /'), 'orbit drag preserves selected channel');
  await audit('rotated');
  await page.screenshot({ path: 'output/playwright/a2-rotated.png' });
  await page.getByRole('button', { name: '复位视角与结构' }).click();
  await page.getByRole('button', { name: '分层展开' }).click();
  await settle();
  await audit('exploded');
  await page.screenshot({ path: 'output/playwright/a2-exploded.png' });
  await page.getByRole('combobox', { name: '车身显示' }).selectOption('solid');
  await audit('solid-exploded');
  await page.getByRole('button', { name: '复位视角与结构' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await settle();
  check((await canvas.boundingBox()).width <= 390, 'narrow viewer fits the viewport');
  await audit('narrow');
  await page.locator('#viewer').screenshot({ path: 'output/playwright/a2-narrow.png' });
  const keyboard = page.getByRole('button', { name: /^REF FL ·/ });
  await keyboard.focus(); await page.keyboard.press('Enter'); await settle();
  check((await page.locator('#wave-title').innerText()).startsWith('FL · x /'), 'keyboard Enter selects REF FL');
  await page.keyboard.press('Tab'); await page.keyboard.press('Space'); await settle();
  check((await page.locator('#wave-title').innerText()).startsWith('FR · x /'), 'keyboard Tab and Space select REF FR');
  return { assertions: results.length, results };
}
