const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/experience-refine/environment-final';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1680,height:1000}}),errors=[],failures=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
const check=(name,v)=>{checks.push({name,pass:!!v});if(!v)throw Error(name);};
try{
 await page.goto('http://127.0.0.1:5197/');await page.waitForFunction(()=>document.querySelector('#lab-viewer')?.dataset.asset==='xpeng-p7plus'&&document.querySelector('#lab-viewer').dataset.environmentReady==='coast',{},{timeout:60000});
 await page.getByRole('navigation').getByRole('button',{name:'结构与布置',exact:true}).click();
 for(const env of ['coast','mountain','desert','snow']){
  await page.locator('[data-env="'+env+'"]').evaluate(e=>e.click());await page.waitForFunction(e=>document.querySelector('#lab-viewer').dataset.environmentReady===e,env,{timeout:60000});
  await page.locator('.lab-showroom-panel').getByRole('button',{name:'前侧',exact:true}).click();await page.waitForTimeout(650);
  for(let a=0;a<4;a++){
   await page.screenshot({path:`${out}/${env}-${a}.png`});await page.mouse.move(670,480);await page.mouse.down();await page.mouse.move(920,480,{steps:20});await page.mouse.up();await page.waitForTimeout(450);
  }
  check(`${env} 360 orbit rendered`,await page.locator('#lab-viewer').getAttribute('data-environment-ready')===env);
 }
 await page.getByRole('navigation').getByRole('button',{name:'声场实验',exact:true}).click();await page.getByLabel('行驶环境',{exact:true}).selectOption('mountain');await page.waitForFunction(()=>document.querySelector('#lab-viewer').dataset.roadReady==='true',{},{timeout:60000});
 await page.locator('.cp-run').click();await page.waitForFunction(()=>Number(document.querySelector('#lab-viewer').dataset.travelDistance)>35,{},{timeout:60000});await page.locator('#lab-play').click();
 for(const env of ['mountain','coast','desert','snow']){
  await page.getByLabel('行驶环境',{exact:true}).selectOption(env);await page.waitForFunction(e=>document.querySelector('#lab-viewer').dataset.environmentReady===e,env,{timeout:60000});await page.locator('[data-view="orbit"]').click();await page.waitForTimeout(750);await page.screenshot({path:`${out}/road-${env}.png`});
  check(`${env} road resources ready`,await page.locator('#lab-viewer').getAttribute('data-road-ready')==='true');
 }
 for(const width of [390,1366,2560]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.waitForTimeout(800);
  const data=await page.evaluate(()=>{const c=document.querySelector('#lab-viewer>canvas'),r=c.getBoundingClientRect();return {buffer:[c.width,c.height],css:[r.width,r.height],overflow:document.documentElement.scrollWidth>innerWidth+2};});
  check(`${width}px native-or-better buffer`,data.buffer[0]>=data.css[0]&&data.buffer[1]>=data.css[1]);check(`${width}px no horizontal overflow`,!data.overflow);await page.screenshot({path:`${out}/screen-${width}.png`,fullPage:width===390});
 }
 check('no JS/Shader errors',errors.length===0);check('no resource failures',failures.length===0);
}catch(e){checks.push({name:String(e),pass:false});process.exitCode=1;}finally{await writeFile(`${out}/report.json`,JSON.stringify({checks,errors,failures},null,2));console.log(JSON.stringify({checks,errors,failures}));await browser.close()}
