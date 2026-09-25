async page => {
  const cdp=await page.context().newCDPSession(page);
  const {targetInfo}=await cdp.send('Target.getTargetInfo');
  const window=await cdp.send('Browser.getWindowForTarget',{targetId:targetInfo.targetId});
  const sample=()=>page.evaluate(()=>({at:Date.now(),visibility:document.visibilityState,hidden:document.hidden,time:parseFloat(document.querySelector('#lab-time').textContent),play:document.querySelector('#lab-play').textContent,...structuredClone(__visibilityQa)}));
  const before=await sample();
  let hiddenFirst,hiddenLater,returned,stillPaused,resumed,minimizedBounds;
  try {
    await cdp.send('Browser.setWindowBounds',{windowId:window.windowId,bounds:{windowState:'minimized'}});
    minimizedBounds=await cdp.send('Browser.getWindowBounds',{windowId:window.windowId});
    await page.waitForTimeout(400);hiddenFirst=await sample();
    await page.waitForTimeout(1500);hiddenLater=await sample();
  } finally {
    await cdp.send('Browser.setWindowBounds',{windowId:window.windowId,bounds:{windowState:'normal'}});
    await page.bringToFront();
  }
  await page.waitForTimeout(250);returned=await sample();await page.waitForTimeout(500);stillPaused=await sample();
  if(stillPaused.play==='播放')await page.locator('#lab-play').click();
  await page.waitForFunction(time=>parseFloat(document.querySelector('#lab-time').textContent)>time+.8,stillPaused.time,{timeout:10000});resumed=await sample();
  await cdp.detach();
  const checks={actualMinimized:minimizedBounds.bounds.windowState==='minimized',actuallyHidden:hiddenFirst.hidden&&hiddenLater.hidden,realHiddenEvent:resumed.events.slice(before.events.length).some(event=>event.hidden),noChunksWhileHidden:hiddenFirst.chunks===hiddenLater.chunks,timeFrozenWhileHidden:hiddenFirst.time===hiddenLater.time,returnedVisible:returned.visibility==='visible',returnWaitsForUser:returned.play==='播放'&&stillPaused.play==='播放'&&returned.time===stillPaused.time,noWallTimeJumpOnReturn:returned.time-before.time<.2,explicitResumeAdvances:resumed.time>=stillPaused.time+.8&&resumed.chunks>stillPaused.chunks,keepsSameExperiment:resumed.runId===before.runId&&resumed.starts.length===before.starts.length,contiguousSamples:resumed.gaps.length===0,noErrors:resumed.errors.length===0&&resumed.rejections.length===0};
  return {date:new Date().toISOString(),window, minimizedBounds,checks,passed:Object.values(checks).every(Boolean),before,hiddenFirst,hiddenLater,returned,stillPaused,resumed,note:'Actual Chrome window minimization through Browser.setWindowBounds; no visibility override or synthetic event. Window restored in finally.'};
}
