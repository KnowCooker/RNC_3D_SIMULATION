import {chromium} from '../a2-tools/browser/node_modules/playwright-core/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out='test-results/environment-refine/temporal';await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,pass,detail)=>{checks.push({name,pass,detail});};
try{await page.goto('http://127.0.0.1:5198/test-results/environment-refine/fixture.html');await page.waitForFunction(()=>window.fixture?.ready(),{},{timeout:60000});await page.evaluate(()=>window.fixture.warm());
const hashes=await page.evaluate(()=>{const f=window.fixture,out=[];for(const x of [0,10,800,4000]){f.render(0,.8,true,x);out.push(f.hash());}return out;});check('sky pixels identical under camera translation from 0 to 4 km',new Set(hashes).size===1,hashes);await page.screenshot({path:`out/sky.png`.replace('out',out)});
const paused=await page.evaluate(()=>{const f=window.fixture,rows=[];for(let i=0;i<100;i++)f.render(8,.7);for(let i=0;i<80;i++){f.render(8,.7);rows.push(f.hash());}return rows;});check('paused road is pixel-stable over 80 renders',new Set(paused).size===1);
const cases=[];
for(const env of ['coast','mountain','desert','snow']){await page.evaluate(e=>window.fixture.environment(e),env);for(const angle of [0,Math.PI]){
 const rows=await page.evaluate(({angle})=>{const f=window.fixture,rows=[];f.reset();for(let i=0;i<100;i++){const t=8.15+i/60;f.render(t,angle);const m=f.metrics();rows.push({i,t,...m,...(m.mean>7?{image:f.renderer.domElement.toDataURL()}: {})});}return rows;},{angle});
 for(const row of rows){if(row.image){await writeFile(`${out}/${env}-${angle.toFixed(2)}-spike-${row.i}.png`,Buffer.from(row.image.split(',')[1],'base64'));delete row.image;}}
 const max=Math.max(...rows.map(r=>r.mean)),black=Math.max(...rows.map(r=>r.darkFraction));cases.push({env,angle,rows});check(`${env}/${angle.toFixed(2)} central sky stable across road chunk boundary`,max<7&&black<.03,{maxMeanPixelDelta:max,blackFraction:black});await page.screenshot({path:`${out}/${env}-${angle===0?'back':'front'}.png`});
}}
// Wrap the equirectangular longitude seam and look at both poles.
const orbit=await page.evaluate(()=>{const f=window.fixture,rows=[];f.reset();for(let i=0;i<144;i++){f.render(0,i*Math.PI/72,true);rows.push(f.metrics());}return rows;});check('all sky azimuths remain covered',orbit.every(r=>r.darkFraction<.03));
for(const env of ['coast','mountain','desert','snow']){await page.evaluate(e=>window.fixture.environment(e),env);const clearance=await page.evaluate(()=>window.fixture.clearance());check(`${env} tree crown spheres clear the entire 19m orbit over 1.2 km`,clearance>19,clearance);}
check('no WebGL or shader errors',errors.length===0,errors);await writeFile(`${out}/report.json`,JSON.stringify({checks,cases,orbit,hashes,errors},null,2));
}catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),checks,errors},null,2));console.log(String(e));process.exitCode=1;}finally{await browser.close();}
