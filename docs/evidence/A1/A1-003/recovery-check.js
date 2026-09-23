// Browser lifecycle test. Observes real AudioContext; no fake clock or audio buffers.
// Playwright enables focus emulation, so this tests CDP freeze/resume, not a claim
// about document.hidden on an unmanaged user's browser.
async page => {
  const checks = [], assert = (name, ok) => { if (!ok) throw new Error(name); checks.push(name); };
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.__observedAudioContext = this; }
    };
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('就绪'));
  await page.getByRole('button', {name:'静音',exact:true}).click();
  await page.getByRole('button', {name:'播放',exact:true}).click();
  await page.waitForFunction(() => Number(document.querySelector('#seek').value)>0.3);
  const read = () => page.evaluate(() => ({
    audio:window.__observedAudioContext.currentTime, audioState:window.__observedAudioContext.state,
    ui:Number(document.querySelector('#seek').value), graph:Number(document.querySelector('#wave').dataset.endSample)/2000,
    run:document.querySelector('#diagnostics').textContent, wall:Date.now()
  }));
  const before = await read();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
  await page.waitForTimeout(2000);
  await cdp.send('Page.setWebLifecycleState',{state:'active'});
  await page.waitForFunction(previous => Number(document.querySelector('#seek').value)>previous+0.1, before.ui);
  const after = await read();
  assert('actual browser freeze lasts at least two wall-clock seconds',after.wall-before.wall>=2000);
  assert('resume preserves run and graph follows the single transport clock',after.run===before.run && Math.abs(after.ui-after.graph)<=0.1);
  assert('transport advancement matches observed AudioContext advancement',Math.abs((after.ui-before.ui)-(after.audio-before.audio))<=0.1);
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  const paused=await read();
  await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await page.waitForTimeout(1000);
  await cdp.send('Page.setWebLifecycleState',{state:'active'});
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  const resumed=await read();
  assert('paused recovery keeps playback stopped and refreshes the exact graph position',resumed.ui===paused.ui && Math.abs(resumed.ui-resumed.graph)<=0.01 && await page.locator('#play').textContent()==='播放');
  await cdp.detach();
  return {count:checks.length,checks,before,after,paused,resumed,scope:'real browser lifecycle freeze/resume plus explicit visibility handler; not physical latency or unmanaged-tab validation'};
}
