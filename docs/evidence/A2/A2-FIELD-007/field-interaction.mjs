import { chromium } from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manual=process.argv.includes('--manual-filter');
const out=`docs/evidence/A2/A2-FIELD-007/${manual?'manual-filter':'field'}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941}}),checks=[],errors=[],failures=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
const check=(v,n)=>{assert.ok(v,n);checks.push(n);};
const idle=()=>page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.cameraTransition==='idle');
const nav=async n=>{await page.getByRole('navigation').getByRole('button',{name:n,exact:true}).click();await idle();};
const shot=async n=>{await page.mouse.move(1640,75);await page.screenshot({path:`${out}/${n}.png`,fullPage:true});};
const hud=()=>page.locator('.lab-field-hud').evaluate(e=>({...e.dataset}));
try {
 if(manual)await page.addInitScript(()=>{const original=WebGL2RenderingContext.prototype.getExtension;WebGL2RenderingContext.prototype.getExtension=function(name){if(name==='OES_texture_float_linear'){window.manualFilterRequests=(window.manualFilterRequests||0)+1;return null;}return original.call(this,name);};});
 await page.goto('http://127.0.0.1:5197/');await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.environmentReady==='coast'&&document.querySelector('#lab-viewer').dataset.asset==='xpeng-p7plus');await idle();
 await nav('声场实验');await page.locator('.cp-settings-button:visible').first().click();
 await page.locator('#lab-mode').selectOption('replay');await page.locator('#lab-duration').selectOption('10');await page.locator('#lab-source-mode').selectOption('shaped-noise');await page.getByRole('button',{name:'关闭工况设置',exact:true}).click();await page.locator('.cp-settings').waitFor({state:'hidden'});
 await page.locator('.cp-run').click();await page.waitForFunction(()=>document.querySelector('#lab-status').textContent.startsWith('实验就绪'),{},{timeout:60000});
 await page.locator('#lab-seek').fill('9');await page.locator('#lab-seek').dispatchEvent('input');await page.waitForFunction(()=>Number(document.querySelector('.lab-field-hud').dataset.time)>8.5,{},{timeout:30000});await idle();
 const initial=await hud(),run=await page.locator('#lab-run').innerText(),time=await page.locator('#lab-time').innerText();
 check(initial.sampleCount==='280'&&initial.rendering==='volume','continuous volume retains all 280 real queried points');check(initial.range==='30,80','absolute display starts on documented standard scale');
 await shot('01-volume');await page.getByRole('button',{name:'同窗改善分布',exact:true}).click();const difference=await hud();
 check(difference.quantity==='reduction'&&difference.range==='-10,10'&&difference.time===initial.time,'signed improvement uses exact same frame and zero-centered scale');
 await shot('02-improvement');await page.getByRole('button',{name:'增强局部对比',exact:true}).click();const detailed=await hud(),[lo,hi]=detailed.range.split(',').map(Number);
 check(lo===-hi&&hi>=3&&hi<10,'improvement detail strengthens contrast while retaining zero and both signs');await shot('03-improvement-detail');
 await page.getByRole('button',{name:'同窗改善分布',exact:true}).click();const shared=(await hud()).range;
 await page.locator('#lab-field').selectOption('primary');await page.waitForTimeout(180);check((await hud()).range===shared,'primary shares the locked range with residual');
 await page.locator('#lab-field').selectOption('residual');await page.waitForTimeout(180);check((await hud()).range===shared,'residual never independently normalizes its colors');
 check(await page.locator('#lab-run').innerText()===run&&await page.locator('#lab-time').innerText()===time,'display-only controls preserve experiment identity and common clock');
 await shot('04-detail');const fieldText=await page.locator('.lab-field-hud').innerText();await page.waitForTimeout(500);check(await page.locator('.lab-field-hud').innerText()===fieldText,'paused sampled values remain stable');
 const opacity=page.getByRole('slider',{name:'声场不透明度',exact:true});await opacity.fill('50');await opacity.dispatchEvent('input');check((await hud()).time===initial.time,'opacity control does not advance or recompute acoustic time');await opacity.fill('95');await opacity.dispatchEvent('input');
 for(const axis of ['x','y','z']){await page.locator('#lab-field-slice').selectOption(axis);await page.waitForFunction(axis=>document.querySelector('.lab-field-hud').dataset.rendering===axis&&!document.querySelector('.lab-field-hud').hidden,axis);check((await hud()).rendering===axis&&await page.locator('#lab-viewer').getAttribute('data-camera-transition')==='idle',`${axis}: continuous slice changes without resetting the camera`);await shot(`05-slice-${axis}`);}
 await page.locator('#lab-field-slice').selectOption('y');await page.waitForFunction(()=>document.querySelector('.lab-field-hud').dataset.rendering==='y'&&!document.querySelector('.lab-field-hud').hidden);await page.getByRole('button',{name:'同窗改善分布',exact:true}).click();await page.getByRole('button',{name:'俯视座舱',exact:true}).click();await idle();await shot('06-overhead');
 let probe='';for(const [x,y] of [[690,440],[750,520],[650,400],[800,560],[700,600]]){await page.mouse.click(x,y);probe=await page.locator('.lab-field-hud').innerText();if(probe.includes('探针 #'))break;}
 check(probe.includes('探针 #')&&probe.includes('原声')&&probe.includes('残余'),'clicking the actual slice reads a nearest real sample with both channels');await shot('07-probe');
 await page.locator('#lab-field-slice').selectOption('volume');await nav('总览');await page.getByRole('navigation').getByRole('button',{name:'声场实验',exact:true}).click();
 await page.mouse.move(690,440);await page.mouse.down();await page.mouse.move(740,450,{steps:3});await page.mouse.up();await page.waitForTimeout(30);
 check(await page.locator('#lab-viewer').getAttribute('data-camera-transition')==='idle','manual orbit cancels the camera transition');
 await page.getByRole('navigation').getByRole('button',{name:'结构与布置',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:'总览',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:'声场实验',exact:true}).click();await idle();
 check(await page.locator('.cp-shell').getAttribute('data-page')==='field','rapid page changes settle on the latest destination');
 for(const width of [1366,740,390]){await page.setViewportSize({width,height:width===1366?768:844});await idle();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}px: no horizontal overflow`);check(await page.locator('.lab-field-hud button').first().isVisible(),`${width}px: field display controls remain reachable`);await shot(`08-${width}`);}
 const reduced=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'});await reduced.goto('http://127.0.0.1:5197/');await reduced.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.asset==='xpeng-p7plus');await reduced.getByRole('navigation').getByRole('button',{name:'声场实验',exact:true}).click();await reduced.waitForTimeout(40);
 check(await reduced.locator('#lab-viewer').getAttribute('data-camera-transition')==='idle','reduced-motion preference uses immediate camera placement');check(await reduced.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)===0,'reduced-motion preference disables panel and dialog animation');await reduced.close();
 if(manual)check(await page.evaluate(()=>window.manualFilterRequests>0),'manual trilinear fallback runs without float-linear texture filtering');
 check(errors.length===0&&failures.length===0,'no JavaScript, shader or failed-resource errors in field interactions');
 await writeFile(`${out}/results.json`,JSON.stringify({passed:checks.length,checks,initial,difference,detailed,shared,probe,errors,failures},null,2));console.log(`${checks.length} field interaction checks passed`);
}catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),checks,errors,failures},null,2));throw e;}finally{await browser.close();}
