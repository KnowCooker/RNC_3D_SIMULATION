import { chromium } from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/evidence/A2/A2-P7-002'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1720,height:1100}}), errors=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
try {
 await page.goto('http://127.0.0.1:5197/#p7plus');await page.locator('.lab-xpeng-picker:not([hidden])').waitFor();
 const viewer=page.locator('#lab-viewer'),canvas=viewer.locator('canvas'),panel=page.locator('.lab-showroom-panel'),assembly=page.locator('.lab-showroom-assembly');
 check(await page.getByLabel('选择小鹏车型',{exact:true}).inputValue()==='p7plus','P7+ direct entry');
 check(await page.locator('.lab-p7-reference').isVisible(),'Dongchedi source visible');
 await page.getByRole('button',{name:'车间三维场景',exact:true}).click();await viewer.scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 await viewer.screenshot({path:`${out}/front-quarter.png`});
 for(const [label,file] of [['正前','front'],['正侧','side'],['正后','rear']]) {
  await panel.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(250);
  const rect=await canvas.boundingBox();await canvas.click({position:{x:rect.width*.5,y:rect.height*.60}});
  check((await page.getByLabel('选择写实车部件',{exact:true}).inputValue()).length>0,`${label}: model in view and actual raycast succeeds`);
  await page.getByLabel('选择写实车部件',{exact:true}).selectOption('');
  await panel.locator('summary').click();
  await viewer.screenshot({path:`${out}/${file}.png`});
 }
 await panel.getByRole('button',{name:'后侧',exact:true}).click();await viewer.screenshot({path:`${out}/rear-quarter.png`});
 await panel.getByRole('button',{name:'查看座舱',exact:true}).click();
 check(await page.getByLabel('写实车外壳',{exact:true}).inputValue()==='hidden','cabin hides external shell');
 await viewer.screenshot({path:`${out}/cabin.png`});
 await panel.getByRole('button',{name:'全部复位',exact:true}).click();await panel.locator('summary').click();
 await page.getByLabel('写实车外壳',{exact:true}).selectOption('transparent');
 check(await page.getByLabel('写实车外壳',{exact:true}).inputValue()==='transparent','transparent body');
 for(const axis of ['x','y','z']) { await page.getByLabel('写实车剖面',{exact:true}).selectOption(axis);check((await panel.locator('output').innerText()).startsWith(axis.toUpperCase()),`${axis}: section control`); }
 await page.getByLabel('写实车剖面',{exact:true}).selectOption('x'); await viewer.screenshot({path:`${out}/section.png`});
 await page.getByLabel('写实车剖面',{exact:true}).selectOption('none');await page.getByLabel('写实车外壳',{exact:true}).selectOption('solid');
 for(const id of ['hood','tailgate','bumper-rear','spoiler','wheel-1-1']) {
  await page.getByLabel('选择写实车部件',{exact:true}).selectOption(id);await panel.locator('.lab-asset-part-action').click();await page.waitForTimeout(450);
  check((await panel.locator('.lab-asset-part-action').innerText()).includes('回装'),`${id}: independent detach`);
  await panel.locator('.lab-asset-part-action').click();
 }
 await panel.getByRole('button',{name:'全部复位',exact:true}).click();await panel.locator('summary').click();await page.waitForTimeout(1800);
 const before=await canvas.screenshot();await page.getByRole('button',{name:'深红车漆',exact:true}).click();
 check(!before.equals(await canvas.screenshot()),'paint changes rendered pixels');
 await page.getByRole('button',{name:'珍珠白车漆',exact:true}).click();
 await panel.getByRole('button',{name:'展开全部',exact:true}).click();await page.waitForTimeout(2100);
 check((await assembly.locator('p').innerText()).includes('31 / 31'),'all 31 assemblies expanded');await viewer.screenshot({path:`${out}/exploded.png`});
 await panel.getByRole('button',{name:'全部复位',exact:true}).click();await page.waitForTimeout(2100);
 check((await assembly.locator('p').innerText()).startsWith('已拆 0'),'all assemblies restored');
 await assembly.getByRole('button',{name:'自动拆解',exact:true}).click();await page.waitForFunction(()=>/已拆 [1-9]/.test(document.querySelector('.lab-showroom-assembly p').textContent));
 await assembly.getByRole('button',{name:'暂停自动拆解',exact:true}).click();const paused=await assembly.locator('p').innerText();await page.waitForTimeout(950);
 check(await assembly.locator('p').innerText()===paused,'auto detach pause');
 await assembly.getByRole('button',{name:'自动回装',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.lab-showroom-assembly p').textContent.startsWith('已拆 0'));
 check(true,'automatic reverse assembly completes');
 for(const id of ['x9','l03','m03','gx']) {
  await page.getByLabel('选择小鹏车型',{exact:true}).selectOption(id);await page.waitForTimeout(170);
  check(await page.locator('.lab-p7-reference').isHidden(),`${id}: P7-specific panel hidden`);
 }
 await page.getByLabel('选择小鹏车型',{exact:true}).selectOption('p7plus');await page.waitForTimeout(300);
 check((await panel.locator('strong').innerText()).includes('P7+'),'return to P7+ after other models');
 const orbitBefore=await canvas.screenshot(),rect=await canvas.boundingBox();
 await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.60);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.56,rect.y+rect.height*.65,{steps:10});await page.mouse.up();await page.waitForTimeout(300);
 check(!orbitBefore.equals(await canvas.screenshot()),'real drag orbit');
 await canvas.hover();await page.mouse.wheel(0,-150);await page.waitForTimeout(300);check(!orbitBefore.equals(await canvas.screenshot()),'real wheel zoom');
 await page.setViewportSize({width:740,height:1000});await viewer.scrollIntoViewIfNeeded();await panel.getByRole('button',{name:'全部复位',exact:true}).click();
 check(await assembly.evaluate(element=>!element.open),'P7 narrow assembly panel starts collapsed');
 await viewer.screenshot({path:`${out}/narrow.png`});check(await panel.getByRole('button',{name:'查看座舱',exact:true}).isVisible(),'narrow controls available');
 check(errors.length===0,'no JavaScript runtime errors');await writeFile(`${out}/browser-results.json`,JSON.stringify({passed:checks.length,checks,errors},null,2));console.log(`${checks.length} browser checks passed`);
} catch(error) {await writeFile(`${out}/failure.json`,JSON.stringify({checks,errors,error:String(error)},null,2));throw error;} finally {await browser.close();}
