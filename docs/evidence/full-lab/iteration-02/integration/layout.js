async page => {
  await page.locator('#lab-mode').selectOption('live');
  await page.getByRole('slider', {name:'车速 / km/h', exact:true}).press('Home');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => Number.parseFloat(document.querySelector('#lab-time').textContent) > 1);
  await page.locator('#lab-play').click();
  const results = [];
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await page.waitForTimeout(350);
    const state = await page.evaluate(() => {
      const inspect = selector => {
        const e = document.querySelector(selector), r = e.getBoundingClientRect();
        return {width:r.width,left:r.left,right:r.right,visible:getComputedStyle(e).display !== 'none' && r.width > 0};
      };
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,metrics:[...document.querySelectorAll('#lab-metrics > div')].map(e=>({text:e.textContent,width:e.getBoundingClientRect().width})),mode:inspect('#lab-mode'),calculate:inspect('#lab-calculate'),time:inspect('#lab-time'),status:document.querySelector('#lab-status').textContent};
    });
    const checks = {noHorizontalOverflow:state.scrollWidth <= width + 1,allFourMetrics:state.metrics.length===4 && state.metrics.every(m=>m.width>0),modeVisible:state.mode.visible && state.mode.right <= width,calculateVisible:state.calculate.visible && state.calculate.right <= width,timeVisible:state.time.visible && state.time.right <= width};
    results.push({width,checks,state});
    if (width===390) await page.screenshot({path:'output/playwright/live-lab/live-narrow.png',fullPage:true});
  }
  await page.locator('#lab-cancel').click();
  return {passed:results.flatMap(r=>Object.values(r.checks)).filter(Boolean).length,failed:results.flatMap(r=>Object.values(r.checks)).filter(v=>!v).length,results};
}
