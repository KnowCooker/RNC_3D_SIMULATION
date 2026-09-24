async page => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('http://127.0.0.1:5183/');
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  await page.locator('#lab-section').selectOption('y');
  await page.locator('#lab-field-slice').selectOption('y');
  await page.locator('#lab-field').selectOption('residual');
  const seek = await page.locator('#lab-seek').boundingBox();
  await page.mouse.click(seek.x + seek.width * 0.25, seek.y + seek.height / 2);
  await page.waitForFunction(() => document.querySelector('#lab-field-status')?.textContent?.includes('空间窗口截至'));
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/A2/A2-FULL-010/narrow-field-note.png' });
  const result = await page.evaluate(() => {
    const host = document.querySelector('#lab-viewer'), note = host.querySelector('.lab-field-interpolation-note');
    const rect = note.getBoundingClientRect();
    const labels = [...host.querySelectorAll('.lab-marker')].filter(el => !el.hidden).map(el => el.getBoundingClientRect());
    return {
      viewer: [host.clientWidth, host.clientHeight],
      note: host.querySelector('.lab-field-note-compact').textContent, noteRect: rect.toJSON(),
      visibleLabels: labels.length,
      overlappingLabels: labels.filter(label => !(label.right <= rect.left || label.left >= rect.right || label.bottom <= rect.top || label.top >= rect.bottom)).length,
    };
  });
  if (result.overlappingLabels || !result.note.includes('固定场片')) throw Error(JSON.stringify(result));
  return result;
}
