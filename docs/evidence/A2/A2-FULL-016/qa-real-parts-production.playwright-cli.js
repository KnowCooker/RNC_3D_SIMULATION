// playwright-cli run-code --filename docs/evidence/A2/A2-FULL-016/qa-real-parts-production.playwright-cli.js
async (page) => {
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('http://127.0.0.1:5182/');
  await page.getByRole('combobox', { name: '动力类型' }).selectOption('ice');
  await page.getByRole('button', { name: '打开写实 SUV 外观范例' }).click();
  await page.getByRole('button', { name: '返回四类动力教学模型和声学实验' }).waitFor();
  const workshop=page.getByRole('button', { name: '车间三维场景' });
  const road=page.getByRole('button', { name: '道路三维场景' });
  await workshop.click();
  const panel=page.locator('.lab-showroom-assembly');
  const partCount=await panel.locator('.lab-assembly-list button').count();
  await panel.locator('[data-part="hood"]').click();
  await panel.locator('[data-part="wheel-fl"]').click();
  const before=await panel.locator('p').innerText();
  await road.click(); await workshop.click();
  const after=await panel.locator('p').innerText();
  const loaded=await page.evaluate(()=>performance.getEntriesByType('resource').filter(resource=>resource.name.includes('range-rover-sport-svr')&&resource.name.startsWith(location.origin)).length);
  const external=await page.evaluate(()=>performance.getEntriesByType('resource').filter(resource=>!resource.name.startsWith(location.origin)).map(resource=>resource.name));
  if(partCount!==14||!before.startsWith('已拆 2')||after!==before||loaded!==1||errors.length||external.length)throw new Error(JSON.stringify({partCount,before,after,loaded,errors,external}));
  return {partCount,before,after,loaded,errors,external};
}
