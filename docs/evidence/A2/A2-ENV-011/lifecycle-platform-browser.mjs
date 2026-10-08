import { chromium } from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files=['champagne-gallery.ts','gallery-platform.ts','scenic-terrain.ts','gallery-landscape.ts','landscape-height.ts','panorama-sky.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(`src/team-a/viewer/${file}`)).digest('hex')])));
const result={sourceBefore:await hashes(),errors:[],views:[]};
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:960,height:600}});
page.on('pageerror',error=>result.errors.push(String(error)));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5198/docs/evidence/A2/A2-ENV-011/lifecycle.html');
  await page.waitForFunction(()=>window.fixtureReady===true,null,{timeout:60000});
  result.setup=await page.evaluate(()=>window.preparePlatformCapture());
  for(const view of ['whole','stairs-east','stairs-west']){
    result.views.push(await page.evaluate(view=>window.setPlatformCaptureView(view),view));
    await page.screenshot({path:`docs/evidence/A2/A2-ENV-011/lifecycle-platform-${view}.png`});
  }
  await page.evaluate(()=>window.finishPlatformCapture());result.sourceAfter=await hashes();
  result.passed=result.errors.length===0&&JSON.stringify(result.sourceBefore)===JSON.stringify(result.sourceAfter);
}catch(error){result.failure=String(error.stack??error);result.passed=false;}
await writeFile('docs/evidence/A2/A2-ENV-011/lifecycle-platform-results.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));await browser.close();if(!result.passed)process.exitCode=1;
