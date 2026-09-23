async page => {
  await page.locator('#lab-mode').selectOption('live');
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-field-slice').selectOption('y');
  await page.locator('#lab-paths').selectOption('both');
  await page.locator('#lab-waves').check();
  await page.locator('#lab-calculate').click();
  await page.locator('#lab-time').filter({hasText:'实时'}).waitFor({timeout:30000});
  await page.waitForTimeout(3000);
  return {time:await page.locator('#lab-time').innerText(),status:await page.locator('#lab-status').innerText(),field:await page.locator('#lab-field-status').innerText(),data:await page.evaluate(()=>({runs:window.__liveQA.runs,chunks:window.__liveQA.chunks.slice(-2),errors:window.__liveQA.errors}))};
}
