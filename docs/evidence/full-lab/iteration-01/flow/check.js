async page => {
  const checks=[],details={};
  const check=(name,pass,data)=>{checks.push({name,pass:!!pass,...(data===undefined?{}:{data})});};
  const ready=()=>page.locator('#lab-status').filter({hasText:'实验就绪'}).waitFor({timeout:60000});
  const seek=async time=>{await page.locator('#lab-seek').evaluate((node,t)=>{node.value=String(t);node.dispatchEvent(new Event('input',{bubbles:true}));},time);await page.waitForTimeout(130);};
  await seek(8);
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-field-status').filter({hasText:'空间窗口截至'}).waitFor({timeout:10000});
  details.preDirty={time:await page.locator('#lab-time').innerText(),title:await page.locator('#lab-signal-title').innerText(),field:await page.locator('#lab-field-status').innerText()};
  for(const vehicle of ['ice','bev','hev','erev']){
    await page.locator('#lab-vehicle').selectOption(vehicle);
    check(`${vehicle}-dirty-disabled`,await page.locator('#lab-play').isDisabled()&&await page.locator('#lab-replay').isDisabled()&&await page.locator('#lab-seek').isDisabled());
    const dirty={time:await page.locator('#lab-time').innerText(),title:await page.locator('#lab-signal-title').innerText(),field:await page.locator('#lab-field-status').innerText(),status:await page.locator('#lab-status').innerText()};
    if(vehicle==='ice'){details.dirty=dirty;check('dirty-clears-old-labels',!dirty.time.includes('8.00')&&!dirty.title.includes('8.00')&&!dirty.field.includes('8.00'),dirty);}
    check(`${vehicle}-dirty-labelled`,dirty.status.includes('重新计算'));
    await page.locator('#lab-calculate').click();await ready();
    const worker=await page.evaluate(()=>window.__qaWorkers.at(-1));
    check(`${vehicle}-worker-result`,worker.config.vehicle===vehicle&&await page.locator('#lab-play').isEnabled(),worker.computeMilliseconds);
    await seek(6);
  }
  for(const signal of ['q','x','u','d','a','e'])for(let channel=0;channel<4;channel++){
    const oldSeat=await page.locator('#lab-seat').inputValue(),oldComparison=await page.locator('#lab-comparison').inputValue();
    await page.locator(`button[data-sf-signal="${signal}"][data-sf-channel="${channel}"]`).click();
    const title=await page.locator('#lab-signal-title').innerText();
    const corner=['FL','FR','RL','RR'][channel];
    if(signal==='q')check('q-description-'+channel,(await page.locator('.sf-explanation strong').innerText()).startsWith('q · 轮端源激励')&&(await page.locator('button[data-sf-signal="e"][aria-pressed="true"]').count())===0);
    check(`signal-${signal}-${channel}-plot`,title.startsWith(signal==='q'?`Q${channel+1}`:signal==='x'?`REF ${corner}`:`${signal.toUpperCase()} ${corner}`),title);
    if(signal==='d'||signal==='e')check(`signal-${signal}-${channel}-listen`,await page.locator('#lab-seat').inputValue()===String(channel)&&await page.locator('#lab-comparison').inputValue()===signal);
    else check(`signal-${signal}-${channel}-preserve-listen`,await page.locator('#lab-seat').inputValue()===oldSeat&&await page.locator('#lab-comparison').inputValue()===oldComparison);
  }
  await page.locator('#lab-seat').selectOption('1');await page.locator('#lab-comparison').selectOption('d');
  check('seat-comparison-selects-flow',(await page.locator('button[data-sf-signal="d"][data-sf-channel="1"]').getAttribute('aria-pressed'))==='true');
  await page.locator('#lab-play').click();await page.waitForTimeout(350);
  check('play-starts',await page.locator('#lab-play').innerText()==='暂停');
  await page.locator('#lab-play').click();
  const paused=await page.locator('#lab-seek').inputValue();await page.waitForTimeout(150);
  check('pause-stops-time',Math.abs(Number(paused)-Number(await page.locator('#lab-seek').inputValue()))<0.01);
  await page.locator('#lab-rnc').uncheck();
  check('rnc-toggle-dirty',await page.locator('#lab-play').isDisabled());
  await page.locator('#lab-calculate').click();await ready();await seek(8);
  const off=await page.evaluate(()=>window.__qaWorkers.at(-1));details.rncOff=off;
  check('rnc-off-real-u-a-zero',off.config.rncEnabled===false&&off.maxAbsU===0&&off.maxAbsA===0);
  check('rnc-off-real-e-equals-d',off.maxDE===0&&off.metrics.aggregateReductionDb===0);
  check('rnc-off-explanation',(await page.locator('.sf-state').innerText()).includes('u = a = 0，e = d'));
  const widths=[];
  for(const width of [1440,950,680,390,320]){
    await page.setViewportSize({width,height:1100});await page.waitForTimeout(100);
    const sizing=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflows:Array.from(document.querySelectorAll('body *')).filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1);}).slice(0,12).map(n=>({tag:n.tagName,id:n.id,cls:n.className,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right}))}));
    widths.push(sizing);check(`viewport-${width}-no-overflow`,sizing.width===sizing.scroll,sizing);
    if(width===390)await page.screenshot({path:'output/playwright/full-lab-flow/mobile-390.png',fullPage:true});
    if(width===320)await page.screenshot({path:'output/playwright/full-lab-flow/mobile-320.png',fullPage:true});
  }
  details.widths=widths;
  for(const label of ['动力类型','胎压 / kPa','温度 / °C','FxLMS 阶数','归一化步长 μ','车身','剖面','声压场','场显示','传播路径','试听座位','对比'])check(`field-accessible-${label}`,await page.getByRole(['胎压 / kPa','温度 / °C','FxLMS 阶数','归一化步长 μ'].includes(label)?'spinbutton':'combobox',{name:label,exact:true}).count()===1);
  await page.setViewportSize({width:1440,height:1100});await page.locator('#lab-header').count();await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'output/playwright/full-lab-flow/desktop.png',fullPage:true});
  details.workers=await page.evaluate(()=>window.__qaWorkers);
  details.errors=await page.evaluate(()=>window.__qaErrors);
  check('no-page-errors',details.errors.length===0,details.errors);
  return {passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,checks,details};
}
