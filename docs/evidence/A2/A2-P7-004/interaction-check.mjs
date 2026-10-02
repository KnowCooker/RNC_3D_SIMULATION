import {chromium} from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});
const checks=[],errors=[];const check=(v,name)=>{assert.ok(v,name);checks.push(name)};
page.on('pageerror',e=>errors.push(String(e)));
try {
 await page.goto('http://127.0.0.1:5197/');
 await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.asset==='xpeng-p7plus');await page.waitForTimeout(1500);
 const size=await page.locator('#lab-viewer>canvas').evaluate(c=>({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight,dpr:devicePixelRatio}));
 check(size.dpr===2&&size.width===size.cssWidth*2&&size.height===size.cssHeight*2,'HiDPI 1920 screen renders at physical 3840 width');
 await page.getByRole('navigation').getByRole('button',{name:'结构与布置',exact:true}).click();
 const canvas=page.locator('#lab-viewer>canvas');await page.waitForTimeout(400);const before=await canvas.screenshot();
 await page.mouse.move(810,480);await page.mouse.down();await page.mouse.move(980,510,{steps:12});await page.mouse.up();await page.waitForTimeout(600);
 check(!before.equals(await canvas.screenshot()),'pointer drag rotates actual vehicle');
 const rotated=await canvas.screenshot();await page.mouse.wheel(0,-350);await page.waitForTimeout(700);check(!rotated.equals(await canvas.screenshot()),'wheel zoom changes actual vehicle');
 await page.locator('#lab-reset').click();await page.waitForTimeout(500);
 let picked='';
 for(const [x,y] of [[740,520],[850,500],[670,480],[950,560],[760,440]]){await page.mouse.click(x,y);picked=await page.getByLabel('选择写实车部件',{exact:true}).inputValue();if(picked)break;}
 check(!!picked,'clicking rendered mesh selects a semantic P7 part');
 await page.locator('.lab-asset-part-action').click();await page.waitForTimeout(700);check((await page.locator('.lab-showroom-assembly p').innerText()).includes('1 / 38'),'picked part can be detached');
 await page.locator('.lab-asset-part-action').click();await page.waitForTimeout(700);check((await page.locator('.lab-showroom-assembly p').innerText()).includes('0 / 38'),'picked part can be reassembled');
 await page.screenshot({path:'docs/evidence/A2/A2-P7-004/hidpi-interaction.png',fullPage:true});
 for(const id of ['x9','l03','m03','gx','p7plus']){await page.getByLabel('展示车辆',{exact:true}).selectOption(id);await page.waitForFunction(id=>document.querySelector('#lab-viewer').dataset.asset===`xpeng-${id}`,id);check(true,`${id}: actual XPeng model loaded`);}
 check(errors.length===0,'no runtime errors during switching and picking');
 await writeFile('docs/evidence/A2/A2-P7-004/interaction-results.json',JSON.stringify({passed:checks.length,checks,size,picked,errors},null,2));console.log(`${checks.length} interaction checks passed`);
}finally{await browser.close()}
