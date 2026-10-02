const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/cp-audit/browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1672,height:941},acceptDownloads:true});
const page=await context.newPage(),checks=[],errors=[],failures=[];page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name);};
const nav=async id=>{await page.locator(`.cp-header [data-page="${id}"]`).click();await page.waitForTimeout(450);};
const settings=async()=>{await page.locator('.cp-settings-button:visible').first().click();};
const close=async()=>{await page.locator('.cp-settings [data-close]').click();await page.waitForTimeout(180);};
const range=async(id,v)=>page.locator(`#lab-${id}`).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},v);
const ready=()=>page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.environmentReady,{},{timeout:60000});
try{
 await page.goto('http://127.0.0.1:5197/');await ready();await page.waitForTimeout(800);
 check('no simulated readout before running',(await page.locator('[data-level="reduction"]').innerText())==='—');
 for(const [w,h] of [[1672,941],[1440,900],[1920,1080],[390,844]]){
  await page.setViewportSize({width:w,height:h});await page.waitForTimeout(600);
  for(const view of ['overview','field','structure','compare']){
   await nav(view);const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:[document.querySelector('#lab-viewer>canvas').width,document.querySelector('#lab-viewer>canvas').clientWidth]}));check(`${w} ${view} no horizontal overflow`,layout.scroll<=w+1,layout);check(`${w} ${view} native canvas`,layout.canvas[0]>=layout.canvas[1]);await page.screenshot({path:`${out}/${w}-${view}.png`});
  }
 }
 await page.setViewportSize({width:1672,height:941});await nav('field');await page.getByLabel('展示车辆',{exact:true}).selectOption('x9');await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.asset==='xpeng-x9');
 await settings();const mode=await page.locator('#lab-mode option').evaluateAll(es=>es.find(o=>o.value!=='live').value);await page.locator('#lab-mode').selectOption(mode);await page.locator('#lab-duration').selectOption('10');await close();
 await page.locator('.cp-run').click();await page.waitForFunction(()=>!document.querySelector('#lab-play').disabled&&document.querySelector('#lab-run').textContent.includes('xpeng-x9'),{},{timeout:60000});
 await range('seek',10);await page.locator('#lab-field').selectOption('primary');await page.locator('#lab-field-slice').selectOption('y');await page.waitForFunction(()=>!document.querySelector('.lab-field-hud').hidden);const run=await page.locator('#lab-run').innerText();
 await nav('structure');await nav('field');check('field quantity preserved',await page.locator('#lab-field').inputValue()==='primary');check('slice preserved',await page.locator('#lab-field-slice').inputValue()==='y');check('run preserved across pages',await page.locator('#lab-run').innerText()===run);check('paused time preserved',Number(await page.locator('#lab-seek').inputValue())===10);
 await nav('compare');await page.locator('#lab-case-save').click();check('case uses X9 identity',(await page.locator('[data-case="A"]').innerText()).includes('小鹏 X9'));check('case labels actual half-second window',(await page.locator('[data-case="A"]').innerText()).includes('9.5–10.0'));
 await settings();await range('road',2.2);await close();check('parameter edit clears stale run',(await page.locator('#lab-run').innerText())==='待计算配置');await nav('field');await page.locator('.cp-run').click();await page.waitForFunction(()=>!document.querySelector('#lab-play').disabled&&document.querySelector('#lab-run').textContent.includes('xpeng-x9'),{},{timeout:60000});await nav('compare');
 check('controlled road mismatch blocks delta',(await page.locator('#lab-case-state').innerText()).includes('路面粗糙度')&&await page.locator('#lab-case-results').isHidden());await page.locator('#lab-case-mode').selectOption('scenario');check('scenario differences visible',await page.locator('#lab-case-results').isVisible());await page.locator('.lab-case-evidence').evaluate(e=>e.open=true);check('scenario cannot imply ANC gain',(await page.locator('#lab-case-review-current').innerText()).includes('不能解释为 ANC'));
 await page.locator('.lab-case-evidence').evaluate(e=>e.open=true);const downloadWait=page.waitForEvent('download');await page.locator('#lab-case-export').click();const download=await downloadWait;await download.saveAs(`${out}/scenario-summary.json`);
 await page.locator('#lab-case-import').setInputFiles(`${out}/scenario-summary.json`);await page.waitForFunction(()=>!document.querySelector('#lab-case-imported').hidden);check('import does not alter run',(await page.locator('#lab-run').innerText()).includes('xpeng-x9'));await page.screenshot({path:`${out}/scenario-comparison.png`});
 await settings();await page.keyboard.press('Escape');await page.waitForTimeout(200);check('Escape closes dialog',await page.locator('.cp-settings').evaluate(e=>!e.open));check('dialog returns keyboard focus',await page.evaluate(()=>document.activeElement?.classList.contains('cp-settings-button')));
 await page.emulateMedia({reducedMotion:'reduce'});await nav('overview');check('reduced motion no active animation',await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length===0));
 await page.locator('.cp-more').click();await page.locator('#lab-guide-toggle').click();await page.locator('#lab-guide-action').click();await page.waitForTimeout(400);check('guide closes help and opens real work page',await page.locator('.cp-help').evaluate(e=>!e.open));check('road guide selects descriptive scenario mode',await page.locator('#lab-case-mode').inputValue()==='scenario');await nav('overview');
 const combo=[];for(const id of ['p7plus','x9','l03','m03','gx']){
  await page.getByLabel('展示车辆',{exact:true}).selectOption(id);await page.waitForFunction(id=>document.querySelector('#lab-viewer').dataset.asset===`xpeng-${id}`,id);
  for(const env of ['coast','mountain','desert','snow']){await page.locator(`[data-env="${env}"]`).click();await page.waitForFunction(env=>document.querySelector('#lab-viewer').dataset.environmentReady===env,env,{timeout:60000});combo.push([id,env]);check(`${id}/${env} available`,await page.locator('#lab-viewer').getAttribute('data-environment-failed')==='false');}
 }
 check('all 20 model/environment combinations checked',combo.length===20);
 check('no page errors',errors.length===0,errors);check('no resource failures',failures.length===0,failures);
}catch(e){await page.screenshot({path:`${out}/failure.png`});errors.push(String(e));process.exitCode=1;}
await writeFile(`${out}/report.json`,JSON.stringify({checks,errors,failures},null,2));console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),errors,failures}));await browser.close();
