async page => {
  await page.setViewportSize({width:1440,height:900});
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#lab-run')?.textContent?.includes('BEV') || document.querySelector('#lab-status')?.textContent?.includes('实验就绪'), {timeout:30000});
  await page.locator('#lab-body').selectOption('solid');
  await page.waitForTimeout(300);
  await page.screenshot({path:'output/playwright/a2-full-003/full-app-default.png',fullPage:true});
  const before=await page.evaluate(()=>({vehicle:document.querySelector('#lab-vehicle').value,status:document.querySelector('#lab-status').textContent,markers:document.querySelectorAll('.lab-marker').length,canvas:document.querySelector('.lab-viewport canvas')?.getBoundingClientRect().toJSON()}));
  await page.locator('#lab-vehicle').selectOption('hev');
  await page.waitForTimeout(350);
  const after=await page.evaluate(()=>({vehicle:document.querySelector('#lab-vehicle').value,status:document.querySelector('#lab-status').textContent,markers:document.querySelectorAll('.lab-marker').length}));
  await page.screenshot({path:'output/playwright/a2-full-003/full-app-hev.png',fullPage:true});
  if(before.markers<12||after.markers<12||after.vehicle!=='hev')throw Error('full app viewer linkage failed');
  return {before,after};
}
