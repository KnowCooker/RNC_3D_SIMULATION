import {chromium} from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='docs/evidence/A2/A2-REALISM-009/models';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const checks=[],errors=[],failures=[],counts={},picked={};
page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
const shot=async name=>{await page.mouse.move(1900,1050);await page.screenshot({path:`${out}/${name}.png`});};
try{
 await page.goto('http://127.0.0.1:5197/');await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.asset==='xpeng-p7plus');
 await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.environmentReady==='coast',{},{timeout:60000});
 await page.getByRole('navigation').getByRole('button',{name:'结构与布置',exact:true}).click();
 const panel=page.locator('.lab-showroom-panel'),canvas=page.locator('#lab-viewer>canvas'),status=page.locator('.lab-showroom-assembly p');
 for(const id of ['p7plus','x9','l03','m03','gx']){
  await page.getByLabel('展示车辆',{exact:true}).selectOption(id);await page.waitForFunction(id=>document.querySelector('#lab-viewer').dataset.asset===`xpeng-${id}`,id);await page.waitForTimeout(600);
  counts[id]=Number((await status.innerText()).match(/\/\s*(\d+)/)[1]);check(counts[id]>=38,`${id}: detailed semantic model loaded`);
  for(const [label,file] of [['前侧','quarter'],['正前','front'],['正侧','side'],['正后','rear']]){
   await panel.getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.cameraTransition==='idle');await shot(`${id}-${file}`);
  }
  await panel.getByRole('button',{name:'前侧',exact:true}).click();await page.waitForTimeout(300);
  const before=await canvas.screenshot();await page.mouse.move(870,420);await page.mouse.down();await page.mouse.move(1000,455,{steps:12});await page.mouse.up();await page.waitForTimeout(450);
  check(!before.equals(await canvas.screenshot()),`${id}: real pointer orbit changes rendered scene`);
  const rotated=await canvas.screenshot();await page.mouse.wheel(0,-180);await page.waitForTimeout(400);check(!rotated.equals(await canvas.screenshot()),`${id}: wheel zoom changes rendered scene`);
  await panel.getByRole('button',{name:'前侧',exact:true}).click();await page.waitForTimeout(200);
  const details=panel.locator('.lab-asset-inspection');if(!await details.evaluate(e=>e.open))await details.locator('summary').click();
  const parts=page.getByLabel('选择写实车部件',{exact:true});await parts.selectOption('');
  for(const [x,y] of [[960,440],[850,450],[1080,440],[800,510],[1010,510],[870,540]]){await page.mouse.click(x,y);picked[id]=await parts.inputValue();if(picked[id])break;}
  check(!!picked[id],`${id}: mesh raycast selects actual semantic part`);
  await panel.locator('.lab-asset-part-action').click();await page.waitForTimeout(650);check((await status.innerText()).includes(`1 / ${counts[id]}`),`${id}: selected mesh detaches`);
  await panel.locator('.lab-asset-part-action').click();await page.waitForTimeout(650);check((await status.innerText()).includes(`0 / ${counts[id]}`),`${id}: selected mesh reassembles`);
  await panel.getByRole('button',{name:'查看座舱',exact:true}).click();await page.waitForTimeout(450);await shot(`${id}-cabin`);
  check(await page.getByLabel('写实车外壳',{exact:true}).inputValue()==='hidden',`${id}: cabin mode hides actual shell`);
  await parts.selectOption('seat-1-1');await panel.locator('.lab-asset-part-action').click();await page.waitForTimeout(650);check((await status.innerText()).includes(`1 / ${counts[id]}`),`${id}: interior seat independently detaches`);
  await panel.getByRole('button',{name:'全部复位',exact:true}).click();await page.waitForTimeout(700);
  await page.getByLabel('写实车剖面',{exact:true}).selectOption('x');await page.waitForTimeout(300);await shot(`${id}-section`);
  check(await page.getByLabel('写实车剖面',{exact:true}).inputValue()==='x',`${id}: cross-section enabled`);
  await panel.getByRole('button',{name:'全部复位',exact:true}).click();await page.waitForTimeout(500);
  await panel.getByRole('button',{name:'展开全部',exact:true}).click();await page.waitForTimeout(2000);check((await status.innerText()).includes(`${counts[id]} / ${counts[id]}`),`${id}: all assemblies expand`);await shot(`${id}-exploded`);
  await panel.getByRole('button',{name:'全部复位',exact:true}).click();await page.waitForTimeout(1600);check((await status.innerText()).includes(`0 / ${counts[id]}`),`${id}: exact assembled UI state restored`);
 }
 for(const width of [390,740,1366,2560]){await page.setViewportSize({width,height:width>1920?1440:900});await page.waitForTimeout(500);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: no horizontal overflow`);const frame=await canvas.boundingBox();check(frame.y<160&&frame.y>=0,`${width}: vehicle canvas stays below header without collapsed top margin`);await shot(`responsive-${width}`);}
 check(errors.length===0,'no JavaScript errors');check(failures.length===0,'no failed resource requests');
 await writeFile(`${out}/browser-results.json`,JSON.stringify({passed:checks.length,checks,counts,picked,errors,failures},null,2));console.log(`${checks.length} checks passed`);
}catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),checks,errors,failures},null,2));await shot('failure');throw e;}finally{await browser.close();}
