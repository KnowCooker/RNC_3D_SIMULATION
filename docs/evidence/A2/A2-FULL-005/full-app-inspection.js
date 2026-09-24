async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5183/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  const folder = 'docs/evidence/A2/A2-FULL-005';
  const states = [];
  async function save(view) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    const state = await page.evaluate(view => {
      const host = document.querySelector('#lab-viewer');
      const box = host.getBoundingClientRect();
      const labels = [...host.querySelectorAll('.lab-marker')].filter(button => !button.hidden).map(button => {
        const rect = button.getBoundingClientRect();
        return { signal: button.dataset.signal, channel: button.dataset.channel, x: rect.left - box.left, y: rect.top - box.top };
      });
      return {
        view, vehicle: document.querySelector('#lab-vehicle').value,
        section: document.querySelector('#lab-section').value,
        cut: Number(document.querySelector('#lab-section-position').value),
        body: document.querySelector('#lab-body').value,
        exploded: document.querySelector('#lab-explode').getAttribute('aria-pressed'),
        labels, leaderCount: [...host.querySelectorAll('.lab-marker-leaders line')].filter(line => line.style.display !== 'none').length,
        status: document.querySelector('#lab-status').textContent,
        fieldStatus: document.querySelector('#lab-field-status').textContent,
      };
    }, view);
    const width = await page.locator('#lab-viewer').evaluate(el => el.clientWidth);
    if (state.labels.some(label => label.x > 70 && label.x < width - 70)) throw Error(`Label covers car: ${JSON.stringify(state)}`);
    if (state.leaderCount !== state.labels.length) throw Error(`Missing label leader: ${JSON.stringify(state)}`);
    await page.screenshot({ path: `${folder}/full-${view}.png` });
    states.push(state);
  }
  await save('default-bev');
  await page.locator('.lab-marker[data-signal="x"][data-channel="0"]').click();
  const selection = await page.locator('#lab-signal-title').textContent();
  if (!selection.includes('REF FL')) throw Error(`Rail label did not select x: ${selection}`);
  await page.locator('#lab-body').selectOption('solid');
  await page.locator('#lab-section').selectOption('x');
  await save('bev-x');
  await page.locator('#lab-section').selectOption('y');
  const slider = page.locator('#lab-section-position');
  await slider.focus(); for (let i = 0; i < 21; i++) await slider.press('ArrowRight');
  await save('bev-y');
  await page.locator('#lab-section').selectOption('z');
  for (let i = 0; i < 19; i++) await slider.press('ArrowLeft');
  await save('bev-z');
  await page.locator('#lab-section').selectOption('none');
  await page.locator('#lab-body').selectOption('transparent');
  await page.locator('#lab-explode').click();
  await page.locator('#lab-paths').selectOption('both');
  await page.locator('#lab-field').selectOption('residual');
  const seek = page.locator('#lab-seek');
  const seekBox = await seek.boundingBox();
  await page.mouse.click(seekBox.x + seekBox.width * 0.25, seekBox.y + seekBox.height / 2);
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('空间窗口截至'));
  await save('bev-exploded-field');
  await page.locator('#lab-vehicle').selectOption('hev');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  const seekBox2 = await seek.boundingBox();
  await page.mouse.click(seekBox2.x + seekBox2.width * 0.25, seekBox2.y + seekBox2.height / 2);
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('空间窗口截至'));
  await page.locator('#lab-explode').click();
  await page.locator('#lab-body').selectOption('solid');
  await page.locator('#lab-section').selectOption('x');
  await slider.focus(); await slider.press('ArrowLeft'); await slider.press('ArrowLeft');
  await save('hev-x');
  return { selection, states };
}
