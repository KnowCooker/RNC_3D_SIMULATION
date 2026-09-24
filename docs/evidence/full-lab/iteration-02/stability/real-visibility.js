async page => {
  await page.setViewportSize({width:1440,height:960});
  await page.addInitScript(() => {
    const qa = window.__visibilityQa = {events:[],errors:[],rejections:[],starts:[],chunks:0,endSample:0,gaps:[],runId:null};
    addEventListener('error',event=>qa.errors.push(String(event.error||event.message)));
    addEventListener('unhandledrejection',event=>qa.rejections.push(String(event.reason)));
    document.addEventListener('visibilitychange',()=>qa.events.push({at:Date.now(),state:document.visibilityState,hidden:document.hidden,time:document.querySelector('#lab-time')?.textContent,play:document.querySelector('#lab-play')?.textContent}));
    const NativeWorker=Worker;
    window.Worker=class extends NativeWorker {
      constructor(...args){super(...args);this.addEventListener('message',({data})=>{
        if(data.type==='chunk'){
          const chunk=data.packet.chunk;
          if(qa.runId!==null&&(qa.runId!==chunk.runId||qa.endSample!==chunk.startSample))qa.gaps.push({expected:qa.endSample,actual:chunk.startSample,runId:chunk.runId});
          qa.runId=chunk.runId;qa.endSample=chunk.startSample+chunk.sampleCount;qa.chunks++;
        }
      });}
      postMessage(...args){if(args[0]?.type==='live-start')qa.starts.push({runId:args[0].runId,at:Date.now()});return super.postMessage(...args);}
    };
  });
  await page.goto('http://127.0.0.1:5180/');
  await page.waitForFunction(()=>!document.querySelector('#lab-play')?.disabled,null,{timeout:20000});
  await page.locator('#lab-mute').click();await page.locator('#lab-mode').selectOption('live');await page.locator('#lab-calculate').click();
  await page.waitForFunction(()=>parseFloat(document.querySelector('#lab-time').textContent)>3,null,{timeout:15000});
  const snapshot=()=>page.evaluate(()=>({at:Date.now(),visibility:document.visibilityState,hidden:document.hidden,time:parseFloat(document.querySelector('#lab-time').textContent),play:document.querySelector('#lab-play').textContent,status:document.querySelector('#lab-status').textContent,...structuredClone(__visibilityQa)}));
  const before=await snapshot();
  const other=await page.context().newPage();await other.goto('about:blank');await other.bringToFront();
  try{await page.waitForFunction(()=>document.hidden,null,{polling:100,timeout:5000});}catch{}
  await page.waitForTimeout(350);const hiddenFirst=await snapshot();
  await page.waitForTimeout(1500);const hiddenLater=await snapshot();
  await page.bringToFront();
  await page.waitForFunction(()=>!document.hidden,null,{polling:100,timeout:5000});
  await page.waitForTimeout(250);const returned=await snapshot();
  await page.waitForTimeout(500);const stillPaused=await snapshot();
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'output/playwright/live-stability/real-visibility-paused.png',scale:'css'});
  if(stillPaused.play==='播放')await page.locator('#lab-play').click();
  await page.waitForFunction(time=>parseFloat(document.querySelector('#lab-time').textContent)>time+.8,stillPaused.time,{timeout:10000});
  const resumed=await snapshot();await other.close();
  const checks={
    actuallyHidden:hiddenFirst.hidden&&hiddenFirst.visibility==='hidden'&&hiddenLater.hidden,
    realHiddenEvent:resumed.events.some(event=>event.hidden&&event.state==='hidden'),
    noChunksWhileHidden:hiddenFirst.chunks===hiddenLater.chunks,
    timeFrozenWhileHidden:hiddenFirst.time===hiddenLater.time,
    returnedVisible:returned.visibility==='visible'&&!returned.hidden,
    returnWaitsForUser:returned.play==='播放'&&stillPaused.play==='播放'&&returned.time===stillPaused.time,
    noWallTimeJumpOnReturn:returned.time-before.time<.2,
    explicitResumeAdvances:resumed.time>=stillPaused.time+.8&&resumed.chunks>stillPaused.chunks,
    keepsSameExperiment:resumed.starts.length===1&&resumed.runId===before.runId,
    contiguousSourceSamples:resumed.gaps.length===0,
    noErrors:resumed.errors.length===0&&resumed.rejections.length===0,
  };
  return {date:new Date().toISOString(),url:page.url(),userAgent:await page.evaluate(()=>navigator.userAgent),headed:true,checks,passed:Object.values(checks).every(Boolean),before,hiddenFirst,hiddenLater,returned,stillPaused,resumed,note:'Actual browser tab activation changes only; no document.hidden override, fake visibility event, fake clock, or mocked Worker. Muted scheduling is not physical audio or AV latency evidence.'};
}
