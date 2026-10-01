import {chromium} from '../../../../test-results/a2-tools/browser/node_modules/playwright-core/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage(),failures=[];let phase='start';
p.on('requestfailed',r=>failures.push({phase,url:r.url(),error:r.failure()?.errorText}));
await p.route('**/diag',r=>r.fulfill({body:'<html>HDR transfer diagnostic</html>',contentType:'text/html'}));
await p.route('**/diag-three/**',async r=>{const path=new URL(r.request().url()).pathname.slice('/diag-three/'.length);if(path.includes('..'))throw Error('path');await r.fulfill({body:await readFile(resolve('node_modules/three/src',path)),contentType:'text/javascript'});});
await p.goto('http://127.0.0.1:5197/diag');
const sizes={};for(const kind of ['native','three']){phase=kind;sizes[kind]=await p.evaluate(async kind=>{const {FileLoader}=await import('/diag-three/loaders/FileLoader.js'),sizes=[];for(let i=0;i<15;i++){const url='/assets/lakes_2k-Cp9fVIm5.hdr';const data=kind==='native'?await(await fetch(url)).arrayBuffer():await new FileLoader().setResponseType('arraybuffer').loadAsync(url);sizes.push(data.byteLength);}return sizes;},kind);}
await writeFile('docs/evidence/A2/A2-REALISM-009/hdr-transfer-diagnostic.json',JSON.stringify({sizes,failures},null,2));console.log(JSON.stringify({sizes,failures}));await b.close();
