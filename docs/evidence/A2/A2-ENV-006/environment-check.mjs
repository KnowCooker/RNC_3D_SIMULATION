import {chromium} from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/evidence/A2/A2-ENV-006/environments';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941}}),errors=[],failed=[],requests=[],checks=[],trace=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>{const item={url:r.url(),error:r.failure()?.errorText,type:r.resourceType(),phase:checks.length};failed.push(item);trace.push(item);});page.on('requestfinished',r=>{if(r.url().endsWith('.hdr'))trace.push({url:r.url(),done:true,type:r.resourceType(),phase:checks.length});});page.on('request',r=>requests.push(r.url()));
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
const ready=id=>page.waitForFunction(id=>document.querySelector('#lab-viewer').dataset.environmentReady===id,id,{timeout:60000});
const nav=label=>page.getByRole('navigation').getByRole('button',{name:label,exact:true}).click();
try {
 await page.goto('http://127.0.0.1:5197/');await ready('coast');await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.asset==='xpeng-p7plus');
 check(requests.filter(u=>u.endsWith('.hdr')).length===1,'initial load fetches only the selected HDR');
 const config=await page.locator('#lab-speed').inputValue();
 await page.evaluate(()=>{for(const id of ['mountain','desert','snow','mountain'])document.querySelector(`[data-env="${id}"]`).click();});
 await ready('mountain');await page.waitForTimeout(1800);
 check(await page.locator('#lab-viewer').getAttribute('data-environment-ready')==='mountain','rapid switching: late responses do not overwrite latest choice');
 for(const id of ['coast','mountain','desert','snow']) {
  await page.locator(`[data-env="${id}"]`).click();await ready(id);await page.waitForTimeout(300);
  check(await page.locator('.cp-app').getAttribute('data-environment')===id,`${id}: scene and theme agree`);
  check(await page.locator('#lab-viewer').getAttribute('data-asset')==='xpeng-p7plus'&&await page.locator('#lab-speed').inputValue()===config,`${id}: vehicle and experiment conditions unchanged`);
  await page.mouse.move(1660,930);await page.screenshot({path:`${out}/${id}.png`});
 }
 for(const label of ['声场实验','结构与布置','方案对比','总览']) {await nav(label);check(await page.locator('#lab-viewer').getAttribute('data-environment-ready')==='snow',`${label}: same loaded environment retained`);}
 await page.locator('[data-env="coast"]').click();await ready('coast');
 const before=await page.locator('#lab-viewer>canvas').screenshot();await page.mouse.move(500,470);await page.mouse.down();await page.mouse.move(780,465,{steps:16});await page.mouse.up();await page.waitForTimeout(450);
 check(!before.equals(await page.locator('#lab-viewer>canvas').screenshot()),'landscape and vehicle remain part of the rotatable live 3D scene');
 check(await page.locator('.cp-model-preview').evaluate(c=>c.getContext('2d').getImageData(0,0,1,1).data[3])===0,'vehicle preview has actual transparent pixels');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(450);await page.screenshot({path:`${out}/responsive-390.png`,fullPage:true});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'390px has no horizontal overflow');
 check(await page.locator('#lab-viewer>canvas').evaluate(c=>c.getBoundingClientRect().top<150),'narrow viewport keeps 3D stage at the top');
 check(requests.every(u=>u.startsWith('http://127.0.0.1:5197/')||u.startsWith('data:')||u.startsWith('blob:')),'runtime resources are local: no external CDN request');
 check(errors.length===0&&failed.length===0,'no JS/WebGL errors or failed resources');
 // Deliberately reject one local panorama: the scene must remain usable with a visible fallback.
 const failurePage=await browser.newPage({viewport:{width:1366,height:768}}),fallbackErrors=[];
 failurePage.on('pageerror',e=>fallbackErrors.push(String(e)));
 await failurePage.route('**/*alps_field*.hdr',route=>route.abort('failed'));
 await failurePage.goto('http://127.0.0.1:5197/');await failurePage.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.environmentReady==='coast');
 await failurePage.locator('[data-env="mountain"]').click();await failurePage.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.environmentFailed==='true');
 check(await failurePage.locator('#lab-viewer').getAttribute('data-asset')==='xpeng-p7plus','missing HDR preserves the live model');
 check(await failurePage.locator('#lab-viewer').evaluate(e=>getComputedStyle(e,'::before').content.includes('环境资源加载失败')),'missing HDR displays an explanatory fallback');
 await failurePage.locator('[data-env="coast"]').click();await failurePage.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.environmentReady==='coast'&&document.querySelector('#lab-viewer').dataset.environmentFailed==='false');
 check(fallbackErrors.length===0,'returning to a cached environment recovers after resource failure');
 await failurePage.close();
 await writeFile(`${out}/results.json`,JSON.stringify({passed:checks.length,checks,errors,failed,hdrRequests:requests.filter(u=>u.endsWith('.hdr'))},null,2));console.log(JSON.stringify({passed:checks.length,errors,failed}));
} catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({message:String(e),checks,errors,failed,trace},null,2));throw e;}finally{await browser.close();}
