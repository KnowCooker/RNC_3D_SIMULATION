const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/experience-refine/live-final';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1680,height:1000}}),errors=[],failures=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)throw Error(name);};
const state=()=>page.evaluate(()=>({distance:Number(document.querySelector('#lab-viewer').dataset.travelDistance),stage:document.querySelector('#lab-viewer').dataset.stage,asset:document.querySelector('#lab-viewer').dataset.asset,field:Number(document.querySelector('.lab-field-hud').dataset.time),grade:Number(document.querySelector('#lab-viewer').dataset.routeGrade),heading:Number(document.querySelector('#lab-viewer').dataset.routeHeading),run:document.querySelector('#lab-run').textContent}));
try{
 await page.goto('http://127.0.0.1:5197/');await page.waitForFunction(()=>document.querySelector('#lab-viewer')?.dataset.asset==='xpeng-p7plus');
 await page.getByRole('navigation').getByRole('button',{name:'声场实验',exact:true}).click();
 for(const id of ['p7plus','x9','l03','m03','gx']){
  await page.getByLabel('展示车辆',{exact:true}).selectOption(id);await page.waitForFunction(id=>document.querySelector('#lab-viewer').dataset.asset===`xpeng-${id}`,id);
  check(`${id} previous result cleared`,(await page.locator('#lab-run').textContent())==='待计算配置');
  await page.locator('.cp-run').click();await page.waitForFunction(()=>Number(document.querySelector('#lab-viewer').dataset.travelDistance)>20,{},{timeout:60000});
  const a=await state();await page.locator('[data-stage="inspect"]').click();await page.waitForFunction(()=>!document.querySelector('.lab-field-hud').hidden&&Number(document.querySelector('.lab-field-hud').dataset.time)>.5,{},{timeout:60000});
  await page.waitForTimeout(1500);const b=await state();check(`${id} inspect stays driving`,b.stage==='road');check(`${id} clock advances during inspection`,b.distance>a.distance+5);check(`${id} live field advances`,b.field>a.field);check(`${id} layout remains paired`,b.run.includes(`xpeng-${id}`));check(`${id} grade and curve evolve`,Math.abs(b.heading-a.heading)>1e-5&&Number.isFinite(b.grade));
  await page.locator('#lab-play').click();await page.waitForTimeout(250);const paused=await state();await page.waitForTimeout(650);const still=await state();check(`${id} pause freezes world`,Math.abs(still.distance-paused.distance)<.001);
  const v=['x9','gx'].includes(id)?'tr':'fr';await page.locator(`[data-view="${v}"]`).click();await page.waitForTimeout(500);check(`${id} seat marker matches`,await page.locator('.lab-driving-location').getAttribute('data-seat')===(v==='fr'?'seat-1-2':id==='x9'?'seat-3-3':'seat-3-2'));
  check(`${id} view change preserves paused time`,Math.abs((await state()).distance-paused.distance)<.001);
  await page.locator('[data-stage="inspect"]').click();await page.locator('#lab-play').click();await page.waitForFunction(d=>Number(document.querySelector('#lab-viewer').dataset.travelDistance)>d+5,paused.distance,{timeout:30000});
  await page.screenshot({path:`${out}/${id}-live.png`});await page.locator('.cp-stop').click();check(`${id} stop clears field`,await page.locator('.lab-field-hud').isHidden());
 }
 await page.getByRole('navigation').getByRole('button',{name:'结构与布置',exact:true}).click();
 for(const id of ['p7plus','x9','l03','m03','gx']){
  await page.getByLabel('展示车辆',{exact:true}).selectOption(id);await page.waitForFunction(id=>document.querySelector('#lab-viewer').dataset.asset===`xpeng-${id}`,id);
  const panel=page.locator('.lab-showroom-assembly');await panel.evaluate(e=>e.open=true);
  await panel.getByRole('button',{name:'拆下一件',exact:true}).click();await page.waitForTimeout(350);check(`${id} disassembly works`,(await panel.textContent()).includes('已拆 1 /'));
  await panel.getByRole('button',{name:'逆序回装',exact:true}).click();await page.waitForTimeout(350);check(`${id} assembly restored`,(await panel.textContent()).includes('已拆 0 /'));
 }
 check('no JS/Shader errors',errors.length===0);check('no failed resources',failures.length===0);
}catch(e){checks.push({name:String(e),pass:false});process.exitCode=1;}finally{await writeFile(`${out}/report.json`,JSON.stringify({checks,errors,failures},null,2));console.log(JSON.stringify({checks,errors,failures}));await browser.close();}
