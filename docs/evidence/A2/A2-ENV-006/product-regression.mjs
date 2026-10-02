import { chromium } from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/evidence/A2/A2-ENV-006/product-regression';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941}}),errors=[],failures=[],requests=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));page.on('request',r=>requests.push(r.url()));
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
const shot=async name=>{await page.mouse.move(1660,930);await page.screenshot({path:`${out}/${name}.png`,fullPage:true});};
const nav=async name=>{await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();await page.waitForTimeout(180);};
const settings=async()=>{await page.locator('.cp-settings-button:visible').first().click();await page.locator('.cp-settings[open]').waitFor();};
const closeSettings=async()=>{await page.getByRole('button',{name:'关闭工况设置',exact:true}).click();};
try{
 await page.goto('http://127.0.0.1:5197/');await page.waitForFunction(()=>{const s=document.querySelector('[aria-label="展示车辆"]');return s&&!s.disabled;});await page.waitForTimeout(1200);
 check(await page.locator('.cp-header nav button').count()===4,'four design navigation pages');
 check(await page.getByLabel('展示车辆',{exact:true}).inputValue()==='p7plus','P7+ preserved as initial display');check(await page.locator('#lab-viewer').getAttribute('data-asset')==='xpeng-p7plus','actual loaded geometry is P7+, not only selector label');
 check(await page.locator('[data-level="reduction"]').innerText()==='—','no fabricated design numbers before experiment');
 check(await page.locator('#lab-viewer>canvas').count()===1,'one main WebGL renderer');
 await shot('01-overview');
 const speed=await page.locator('#lab-speed').inputValue(),road=await page.locator('#lab-road').inputValue();
 for(const [id,name] of [['mountain','山地'],['desert','沙漠'],['snow','雪山'],['coast','海岸']]){
   const before=await page.locator('#lab-viewer>canvas').screenshot();await page.locator(`[data-env="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('#lab-viewer').dataset.environmentReady===id,id,{timeout:60000});await page.waitForTimeout(250);
   check(!before.equals(await page.locator('#lab-viewer>canvas').screenshot()),`${name}: actual scene pixels change`);
   check(await page.locator('#lab-speed').inputValue()===speed && await page.locator('#lab-road').inputValue()===road,`${name}: acoustic conditions unchanged`);
 }
 await page.locator('[data-mode="transparent"]').click();check(await page.locator('#lab-body').inputValue()==='transparent','transparent mode uses actual model');
 await page.locator('[data-mode="solid"]').click();
 await page.locator('[data-mode="explode"]').click();await page.waitForTimeout(1900);
 check(await page.locator('.cp-shell').getAttribute('data-page')==='structure','disassembly enters structure page');
 check((await page.locator('.lab-showroom-assembly p').innerText()).includes('38 / 38'),'all P7+ parts detached');
 await shot('03-structure-exploded');await page.locator('#lab-reset').click();await page.waitForTimeout(1800);
 check((await page.locator('.lab-showroom-assembly p').innerText()).startsWith('已拆 0'),'exact assembly restore through shared controls');
 await page.locator('.lab-showroom-assembly [data-part="hood"]').click();await page.waitForTimeout(450);check((await page.locator('.lab-showroom-assembly p').innerText()).includes('1 / 38'),'individual hood detach');await page.locator('#lab-reset').click();
 await nav('声场实验');check(await page.getByRole('button',{name:'切换 P7+ 实验车',exact:true}).isHidden(),'P7+ acoustic layout ready without SUV fallback');check(await page.getByLabel('展示车辆',{exact:true}).inputValue()==='p7plus','navigation retains P7+');
 check(await page.locator('[aria-label="展示车辆"] option').count()===5,'only five XPeng display models');
 check(await page.locator('#lab-vehicle option').count()===1,'only registered P7+ acoustic vehicle');
 await settings();await page.locator('#lab-mode').selectOption('replay');await page.locator('#lab-duration').selectOption('10');await page.locator('#lab-source-mode').selectOption('shaped-noise');
 await closeSettings();await page.locator('.cp-run').click();await page.waitForFunction(()=>document.querySelector('#lab-status').textContent.startsWith('实验就绪'),{},{timeout:60000});
 check(true,'real Worker precomputed P7+ experiment completes');check((await page.locator('#lab-run').innerText()).includes('xpeng-p7plus-bev-v1'),'Worker result stamped with P7+ layout');check(await page.getByLabel('展示车辆',{exact:true}).inputValue()==='p7plus','field never substitutes a SUV');
 await page.locator('#lab-seek').fill('9');await page.locator('#lab-seek').dispatchEvent('input');
 await page.locator('#lab-field').selectOption('residual');await page.waitForFunction(()=>document.querySelector('#lab-field-status').textContent.includes('声场截至'),{},{timeout:20000});
 check(await page.locator('#lab-metrics>div').count()===4,'four real computed seat metrics');
 const run=await page.locator('#lab-run').innerText(),time=await page.locator('#lab-time').innerText();
 await shot('02-acoustic-field');
 for(const axis of ['x','y','z']) {await page.locator('#lab-field-slice').selectOption(axis);await page.waitForTimeout(250);check(await page.locator('#lab-run').innerText()===run,`${axis}: slice preserves experiment`);}
 await nav('总览');check(await page.locator('[data-level="reduction"]').innerText()!=='—','overview reads current experiment metrics');check(await page.locator('#lab-time').innerText()===time,'page navigation preserves playback clock');await shot('01-overview-results');
 await nav('方案对比');await page.locator('#lab-case-save').click();check((await page.locator('#lab-case-state').innerText()).includes('基线'),'save actual experiment baseline');
 await settings();await page.locator('#lab-step').fill('0.04');await page.locator('#lab-step').dispatchEvent('change');await closeSettings();
 check(await page.locator('[data-level="reduction"]').innerText()==='—','config changes clear obsolete overview values');
 await nav('声场实验');await page.locator('.cp-run').click();await page.waitForFunction(()=>document.querySelector('#lab-status').textContent.startsWith('实验就绪'),{},{timeout:60000});await nav('方案对比');
 check(await page.locator('#lab-case-results table tbody tr, #lab-case-results table>tr').count()===5,'real A/B comparison contains four seat rows');await shot('04-scenario-comparison');
 await page.locator('.lab-case-evidence>summary').click();
 const download=page.waitForEvent('download');await page.locator('#lab-case-export').click();await download;check(true,'actual review summary download');
 await nav('声场实验');await settings();await page.getByLabel('展示场景',{exact:true}).selectOption('road');await closeSettings();await page.waitForTimeout(250);check(true,'legacy 3D road remains reachable');
 await settings();await page.getByLabel('道路材质与声学预设',{exact:true}).selectOption('coarse');check(await page.locator('#lab-road').inputValue()==='1.2','road preset retains actual config connection');await page.getByLabel('展示场景',{exact:true}).selectOption('gallery');await closeSettings();
 await nav('总览');await page.locator('[data-card="paths"]').click();check(await page.locator('.cp-paths-dialog[open]').isVisible(),'path mechanism dialog opens');await page.keyboard.press('Escape');check(await page.locator('.cp-paths-dialog').isHidden(),'Escape closes native modal');
 await page.getByRole('button',{name:'帮助与数据来源'}).click();check(await page.locator('.cp-attribution').isVisible(),'local environment attribution shown');await page.keyboard.press('Escape');
 await nav('声场实验');await settings();await page.locator('#lab-mode').selectOption('live');await closeSettings();await page.locator('.cp-run').click();
 await page.waitForFunction(()=>document.querySelector('#lab-play').textContent==='暂停' && !document.querySelector('#lab-time').textContent.includes('00:00.'),{},{timeout:20000});
 check(true,'live Worker and playback clock advance');await page.locator('#lab-play').click();await page.waitForTimeout(150);const paused=await page.locator('#lab-time').innerText();await page.waitForTimeout(500);check(await page.locator('#lab-time').innerText()===paused,'live pause freezes common clock');
 await page.locator('#lab-play').click();await page.waitForTimeout(1000);check(await page.locator('#lab-time').innerText()!==paused,'live resume continues common clock');await page.locator('.cp-stop').click();check((await page.locator('.cp-run-status').innerText()).includes('结束'),'live stop remains available');await nav('总览');
 await page.getByLabel('展示车辆',{exact:true}).selectOption('p7plus');await page.waitForTimeout(450);
 for(const width of [3840,2560,1920,1366,1024,740,390]){
   await page.setViewportSize({width,height:width===390?844:width===3840?2160:width===2560?1440:width===1366?768:1000});await nav('总览');
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${width}px: no horizontal overflow`);
   check(await page.locator('#lab-viewer>canvas').evaluate(c=>c.width>=Math.floor(c.clientWidth)&&c.height>=Math.floor(c.clientHeight)),`${width}px: native drawing buffer resolution`);
   check(await page.locator('.cp-cta').isVisible(),`${width}px: main action available`);await shot(`responsive-${width}`);
 }
 await nav('声场实验');await settings();check(await page.locator('#lab-calculate').isVisible(),'mobile settings retain execution controls');await page.keyboard.press('Escape');
 check(errors.length===0,'no JavaScript exceptions');check(failures.length===0,'no failed resource requests');check(requests.every(u=>u.startsWith('http://127.0.0.1:5197/')||u.startsWith('blob:')||u.startsWith('data:')),'runtime uses local assets only');
 await writeFile(`${out}/browser-results.json`,JSON.stringify({passed:checks.length,checks,errors,failures,requestCount:requests.length},null,2));console.log(`${checks.length} checks passed`);
}catch(error){await shot('failure');await writeFile(`${out}/failure.json`,JSON.stringify({checks,errors,failures,error:String(error)},null,2));throw error;}finally{await browser.close();}
