import {chromium} from '../a2-tools/browser/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/environment-refine/browser';await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1672,height:941}}),errors=[],failed=[],checks=[],cameras=[],samples=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
const check=(name,value,detail)=>{checks.push({name,pass:!!value,detail});if(!value)throw Error(name);};
async function state(){return page.locator('#lab-viewer').evaluate(e=>({...e.dataset}));}
async function drag(dx,dy,button='left'){await page.mouse.move(510,360);await page.mouse.down({button});await page.mouse.move(510+dx,360+dy,{steps:22});await page.mouse.up({button});await page.waitForTimeout(650);}
async function environment(env){await page.locator(`[data-env="${env}"]`).evaluate(e=>e.click());await page.waitForFunction(e=>document.querySelector('#lab-viewer').dataset.environmentReady===e,env,{timeout:60000});await page.waitForTimeout(2000);}
try{
await page.goto('http://127.0.0.1:5197');await page.waitForFunction(()=>document.querySelector('#lab-viewer')?.dataset.asset==='xpeng-p7plus'&&document.querySelector('#lab-viewer').dataset.environmentReady==='coast',{},{timeout:60000});
await page.locator('.cp-header [data-page="structure"]').click();
for(const env of ['coast','mountain','desert','snow']){
 await environment(env);for(let i=0;i<4;i++){await page.screenshot({path:`${out}/gallery-${env}-${i}.png`});const row=await state();cameras.push({env,i,...row});check(`gallery ${env}/${i} camera above floor`,Number(row.cameraPosition.split(',')[1])>=.399);await drag(245,0);}
}
await drag(0,450);let row=await state();check('gallery downward orbit stops above floor',Number(row.cameraPosition.split(',')[1])>=.399,row.cameraPosition);await drag(520,300,'right');row=await state();check('gallery pan stays within clear bay',Math.abs(Number(row.cameraTarget.split(',')[0]))<=2.001&&Math.abs(Number(row.cameraTarget.split(',')[2]))<=1.501,row.cameraTarget);
await page.mouse.move(550,400);await page.mouse.wheel(0,-20000);await page.waitForTimeout(800);await page.screenshot({path:`${out}/gallery-camera-guard.png`});
await page.locator('.cp-header [data-page="field"]').click();await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.roadReady==='true',{},{timeout:60000});
for(const env of ['coast','mountain','desert','snow']){await page.getByLabel('行驶环境',{exact:true}).selectOption(env);await page.waitForFunction(e=>document.querySelector('#lab-viewer').dataset.environmentReady===e,env,{timeout:60000});await page.locator('[data-view="orbit"]').click();await page.waitForTimeout(2200);for(let i=0;i<4;i++){await page.screenshot({path:`${out}/road-${env}-${i}.png`});row=await state();check(`road ${env}/${i} camera above floor`,Number(row.cameraPosition.split(',')[1])>=.399);await drag(245,0);}}
for(const seat of ['fl','rr']){await page.locator(`[data-view="${seat}"]`).click();await page.waitForTimeout(600);row=await state();check(`${seat} cabin location preserved`,row.drivingView===seat&&row.drivingEye===row.cameraPosition.split(',').map(n=>String(Number(n))).join(','),row);await page.screenshot({path:`${out}/cabin-${seat}.png`});}
await page.locator('[data-view="orbit"]').click();await page.getByLabel('行驶环境',{exact:true}).selectOption('mountain');await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.environmentReady==='mountain');await page.waitForTimeout(2200);
// Texture callbacks / camera damping must no longer perturb a paused scene.
await page.screenshot({path:`${out}/paused-a.png`});await page.waitForTimeout(1500);await page.screenshot({path:`${out}/paused-b.png`});
await page.locator('#lab-field').selectOption('off');await page.locator('.cp-run').click();await page.waitForFunction(()=>Number(document.querySelector('#lab-viewer').dataset.travelDistance)>1,{},{timeout:60000});await page.locator('#lab-field').selectOption('off');
await page.evaluate(()=>{window.frameGaps=[];window.lastFrame=performance.now();window.trackFrames=true;function tick(t){if(!window.trackFrames)return;window.frameGaps.push(t-window.lastFrame);window.lastFrame=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);});
for(let i=0;i<24;i++){await page.waitForTimeout(700);const row=await state();samples.push({wall:Date.now(),...row});if(i%3===0)await page.screenshot({path:`${out}/moving-${i}.png`});}
const perf=await page.evaluate(()=>{window.trackFrames=false;return window.frameGaps;});check('live crosses multiple regeneration boundaries',Number(samples.at(-1).travelDistance)-Number(samples[0].travelDistance)>240,samples.map(s=>s.travelDistance));check('live grades/heading evolve',new Set(samples.map(s=>s.routeGrade)).size>10);
await page.locator('#lab-play').click();const paused=await state();await page.waitForTimeout(1400);check('pause stops world motion',(await state()).travelDistance===paused.travelDistance);
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${out}/mobile.png`});check('mobile no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
check('no shader or page errors',errors.length===0,errors);check('no failed resources',failed.length===0,failed);await writeFile(`${out}/report.json`,JSON.stringify({checks,cameras,samples,perf,errors,failed},null,2));
}catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),checks,cameras,samples,errors,failed},null,2));console.log(String(e));process.exitCode=1;}finally{await browser.close();}
