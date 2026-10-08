import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE ?? 'test-results/a2-tools/browser/node_modules/playwright-core/index.mjs')).href);
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.ENV011_OUTPUT ?? 'test-results/env011/browser-final';await mkdir(out,{recursive:true});
const sourceFiles=['champagne-gallery.ts','gallery-platform.ts','gallery-landscape.ts','landscape-height.ts','scenic-terrain.ts','scene-stage.ts','lab-viewer.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,createHash('sha256').update(await readFile('src/team-a/viewer/'+f)).digest('hex')])));
const sourceBefore=await hashes();
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],failed=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
const check=(name,ok,detail)=>{checks.push({name,pass:!!ok,detail});if(!ok)throw Error(name);};
const state=()=>page.locator('#lab-viewer').evaluate(e=>({...e.dataset}));
const canvas=()=>page.locator('#lab-viewer canvas').first().evaluate(e=>({width:e.width,height:e.height,cssWidth:e.clientWidth,cssHeight:e.clientHeight}));
async function drag(dx){await page.mouse.move(530,470);await page.mouse.down();await page.mouse.move(530+dx,470,{steps:24});await page.mouse.up();await page.waitForTimeout(700);}
try{
 await page.goto(process.env.ENV011_URL ?? 'http://127.0.0.1:5199');await page.waitForFunction(()=>document.querySelector('#lab-viewer')?.dataset.environmentReady==='coast',{},{timeout:60000});await page.waitForTimeout(2500);
 const gpu=await page.locator('#lab-viewer canvas').first().evaluate(e=>{const gl=e.getContext('webgl2');return {maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxRenderbufferSize:gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)}});
 let c=await canvas();check('overview renders at 2x pixels',c.width===c.cssWidth*2&&c.height===c.cssHeight*2,c);
 await page.screenshot({path:`${out}/overview-coast.png`});
 for(const env of ['mountain','desert','snow','coast']){
   await page.locator(`[data-env="${env}"]`).click();await page.waitForFunction(e=>document.querySelector('#lab-viewer').dataset.environmentReady===e,env,{timeout:60000});await page.waitForTimeout(2200);
   check(`${env} backdrop and HDR ready`,(await state()).environmentFailed==='false');await page.screenshot({path:`${out}/overview-${env}.png`});
 }
 await page.locator('.cp-header [data-page="structure"]').click();await page.waitForTimeout(1000);
 for(const env of ['coast','mountain','desert','snow']){
   await page.locator(`[data-env="${env}"]`).evaluate(e=>e.click());await page.waitForFunction(e=>document.querySelector('#lab-viewer').dataset.environmentReady===e,env,{timeout:60000});await page.waitForTimeout(2100);
   for(let angle=0;angle<4;angle++){await page.screenshot({path:`${out}/orbit-${env}-${angle}.png`});const s=await state();check(`${env} orbit ${angle} stays above platform`,Number(s.cameraPosition.split(',')[1])>=.4);await drag(270);}
 }
 await page.locator('.cp-header [data-page="field"]').click();await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.stage==='road');
 c=await canvas();check('same-size switch restores road 1.5x pixels',c.width===Math.floor(c.cssWidth*1.5),c);
 await page.locator('.cp-header [data-page="overview"]').click();await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.stage==='gallery');
 c=await canvas();check('same-size return restores gallery 2x pixels',c.width===c.cssWidth*2,c);
 await page.setViewportSize({width:2560,height:1440});await page.waitForTimeout(1200);c=await canvas();check('1440p supersampling stays within budget',c.width*c.height<=8400000&&c.width>=c.cssWidth,c);await page.screenshot({path:`${out}/overview-1440p.png`});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1200);check('390px no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${out}/overview-mobile.png`});
 check('no page or shader errors',errors.length===0,errors);check('no failed requests',failed.length===0,failed);
 const sourceAfter=await hashes();check('tested source unchanged',JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter));
 await writeFile(`${out}/report.json`,JSON.stringify({role:'A2',task:'A2-ENV-011',identitySource:'user-declared',executor:'Codex',sourceBefore,sourceAfter,gpu,checks,errors,failed},null,2));console.log(JSON.stringify({pass:checks.length,errors,failed}));
}catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),checks,errors,failed},null,2));console.log(String(e));process.exitCode=1;}finally{await browser.close();}
