async page => {
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const card = page.locator('.lab-part-card');
  const picker = page.locator('.lab-part-picker select');
  const cases = [
    ['ice', 'transmission', '前轮'],
    ['bev', 'traction-battery', '后轮'],
    ['hev', 'power-split', 'MG1'],
    ['erev', 'range-generator', '发动机不机械驱动车轮'],
  ];
  const result = [];
  for (const [vehicle, part, expected] of cases) {
    await page.selectOption('#lab-vehicle', vehicle);
    assert(await card.isHidden(), `${vehicle}: old guide must clear`);
    await picker.selectOption(part);
    assert(await card.isVisible(), `${vehicle}: selected part card must open`);
    const text = await card.innerText();
    assert(text.includes(expected), `${vehicle}: expected energy path ${expected}`);
    const href = await card.locator('a').getAttribute('href');
    assert(href?.startsWith('https://'), `${vehicle}: source link`);
    result.push({ vehicle, part, text, href });
    if (vehicle === 'bev') await page.screenshot({ path: 'docs/evidence/A2/A2-FULL-006/bev-guide.png', fullPage: true });
    if (vehicle === 'erev') await page.screenshot({ path: 'docs/evidence/A2/A2-FULL-006/erev-guide.png', fullPage: true });
  }
  await card.locator('button').click();
  assert(await card.isHidden(), 'close button hides guide');
  const canvas = page.locator('#lab-viewer canvas');
  const rect = await canvas.boundingBox();
  let picked = false;
  for (const y of [0.48, 0.55, 0.4]) for (const x of [0.5, 0.42, 0.58]) {
    await page.mouse.click(rect.x + rect.width * x, rect.y + rect.height * y);
    if (await card.isVisible()) { picked = true; break; }
  }
  assert(picked, 'a real click on visible vehicle geometry opens the guide');
  const clickTitle = await card.locator('h3').innerText();
  await page.locator('#lab-edit').check();
  assert(await card.isHidden(), 'edit mode hides guide');
  assert(await picker.isDisabled(), 'edit mode disables guide picker');
  await page.locator('#lab-edit').uncheck();
  assert(await picker.isEnabled(), 'leaving edit mode restores guide picker');
  const marker = page.locator('#lab-viewer button.lab-marker[data-signal="x"]').first();
  await marker.click();
  assert(await card.isHidden(), 'hardware selection does not open a part guide');
  return { cases: result, geometryClickTitle: clickTitle, editAndMarkerPassed: true };
}
