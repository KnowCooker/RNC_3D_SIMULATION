async(page)=>{
 const records=[];
 await page.locator('#lab-waves').check();await page.locator('#lab-paths').selectOption('both');await page.locator('#lab-section').selectOption('none');await page.locator('#lab-body').selectOption('transparent');
 for(const [i,kind] of ['ice','bev','hev','erev'].entries()){
  await page.locator('#lab-vehicle').selectOption(kind);await page.locator(`[data-speaker="${i}"]`).uncheck();
  const before=await page.evaluate(()=>modQA.sent.length);await page.locator('#lab-calculate').click();await page.waitForFunction(n=>modQA.sent.length>n&&modQA.result.runId===modQA.sent.at(-1).runId,before);
  const seek=await page.locator('#lab-seek').boundingBox();await page.mouse.click(seek.x+seek.width*.72,seek.y+seek.height/2);
  await page.locator(`#lab-viewer button[data-signal="u"][data-channel="${i}"]`).click();
  const record=await page.evaluate(({i,kind})=>{
   const r=modQA.result,max=r.signals.u.map(a=>Math.max(...a.map(Math.abs))),objects=[];modQA.scene.traverse(o=>objects.push(o));
   if(max[i]!==0||max.filter((_,n)=>n!==i).some(p=>!(p>0)))throw Error('speaker physical gating mismatch');
   const disabledWaves=objects.filter(o=>o.userData.speaker===i),disabledPaths=objects.filter(o=>o.isLine&&o.userData.primary===false&&o.userData.channel===i);
   if(disabledWaves.length!==3||disabledWaves.some(o=>o.visible)||disabledPaths.length!==4||disabledPaths.some(o=>o.visible))throw Error('disabled visual mismatch');
   return {kind,disabledSpeaker:i,realRun:r.runId,speakerEnabled:r.config.speakerEnabled,uAbsMax:max,disabledWaves:disabledWaves.length,disabledPaths:disabledPaths.length,marker:document.querySelector(`#lab-viewer button[data-signal="u"][data-channel="${i}"]`).textContent,flow:document.querySelector('.sf-explanation').textContent,title:document.querySelector('#lab-signal-title').textContent,time:document.querySelector('#lab-time').textContent};
  },{i,kind});
  await page.screenshot({path:`output/playwright/modification-full/${kind}-speaker-disabled.png`,fullPage:true});
  await page.locator(`[data-speaker="${i}"]`).check();const prior=await page.evaluate(()=>modQA.sent.length);await page.locator('#lab-calculate').click();await page.waitForFunction(n=>modQA.sent.length>n&&modQA.result.runId===modQA.sent.at(-1).runId,prior);
  record.enabledAgainPeak=await page.evaluate(i=>Math.max(...modQA.result.signals.u[i].map(Math.abs)),i);if(!(record.enabledAgainPeak>0))throw Error('enabled speaker remains zero');
  records.push(record);await page.evaluate(records=>modQA.speakers=records,records);
 }
 return {records,errors:await page.evaluate(()=>modQA.errors)};
}
