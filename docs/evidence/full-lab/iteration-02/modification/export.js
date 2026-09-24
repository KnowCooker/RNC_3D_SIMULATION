async(page)=>await page.evaluate(()=>({
 date:new Date().toISOString(),url:location.href,viewport:[innerWidth,innerHeight],
 observation:'Actual full application; native Worker runs unmodified. Observers read sent configs, received results, and renderer scene/camera. All config, mount, deletion and selection changes use Playwright mouse/forms.',
 fourCars:modQA.fourCars,speakers:modQA.speakers,charge:modQA.charge,combinations:modQA.combinations,
 requests:modQA.sent.map(s=>({type:s.type,runId:s.runId,config:s.config})),received:modQA.received,errors:modQA.errors,
 finalStatus:document.querySelector('#lab-status').textContent
}))
