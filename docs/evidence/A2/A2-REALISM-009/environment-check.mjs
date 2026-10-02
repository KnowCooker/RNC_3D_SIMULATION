import {chromium} from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/evidence/A2/A2-REALISM-009/environments';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],failures=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText,type:r.resourceType(),after:checks.at(-1)}));
const check=(v,n)=>{assert.ok(v,n);checks.push(n)};
const nav=n=>page.getByRole('navigation').getByRole('button',{name:n,exact:true}).click();
try{
 await page.goto('http://127.0.0.1:5197/');await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.environmentReady==='coast',{},{timeout:60000});
 for(const env of ['coast','mountain','desert','snow']){
  await nav('总览');await page.locator(`[data-env="${env}"]`).click();await page.waitForFunction(e=>document.querySelector('#lab-viewer').dataset.environmentReady===e,env,{timeout:90000});check(true,`${env}: full background and HDR ready`);
  await nav('结构与布置');await page.locator('.lab-showroom-panel').getByRole('button',{name:'正前',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.cameraTransition==='idle');
  const canvas=page.locator('#lab-viewer>canvas'),box=await canvas.boundingBox();let previous;
  for(let i=0;i<8;i++){
   const current=await canvas.screenshot();if(previous)check(!current.equals(previous),`${env}: direction ${i} changes real rendered panorama`);previous=current;
   await page.screenshot({path:`${out}/${env}-${i}.png`});
   await page.mouse.move(900,480);await page.mouse.down();await page.mouse.move(900+box.height/8,480,{steps:16});await page.mouse.up();await page.waitForTimeout(650);
  }
 }
 // Return to evicted scenes; then rapid switching must finish on the latest selection.
 await nav('总览');for(const env of ['coast','mountain']){await page.locator(`[data-env="${env}"]`).click();await page.waitForFunction(e=>document.querySelector('#lab-viewer').dataset.environmentReady===e,env,{timeout:90000});check(true,`${env}: reload after texture eviction`);}
 for(const env of ['snow','desert','coast'])await page.locator(`[data-env="${env}"]`).click();await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.environmentReady==='coast',{},{timeout:90000});check(true,'rapid changes finish on selected panorama');
 check(!errors.length,'no JavaScript or shader errors');check(!failures.length,'no failed resources');await writeFile(`${out}/results.json`,JSON.stringify({passed:checks.length,checks,errors,failures},null,2));console.log(`${checks.length} environment checks passed`);
}catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),checks,errors,failures},null,2));throw e;}finally{await browser.close()}
