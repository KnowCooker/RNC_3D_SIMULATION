async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', {name:'Start live audio'}).click();
  await page.waitForFunction(() => player.currentTime >= 2);
  const first = await page.evaluate(() => ({time:player.currentTime, buffered:player.bufferedUntil, status:player.status, underruns:player.underruns, sources:player.sources.size, queued:player.queuedSeconds}));
  await page.evaluate(() => { for (const seat of ['fl','fr','rl','rr']) for (const mode of ['d','e']) player.setComparison(seat,mode); });
  await page.waitForFunction(() => player.currentTime >= 4);
  const switched = await page.evaluate(() => ({time:player.currentTime, status:player.status, underruns:player.underruns, sources:player.sources.size}));
  await page.evaluate(() => { clearInterval(feeding); });
  await page.waitForFunction(() => player.status === 'buffering');
  const starved = await page.evaluate(() => ({time:player.currentTime, status:player.status, underruns:player.underruns, queued:player.queuedSeconds}));
  await page.waitForTimeout(250);
  const frozen = await page.evaluate(() => player.currentTime);
  await page.evaluate(() => { feed(); feeding = setInterval(feed,25); });
  await page.waitForFunction(time => player.currentTime >= time + .5, starved.time);
  const resumed = await page.evaluate(() => ({time:player.currentTime, underruns:player.underruns, status:player.status}));
  await page.evaluate(() => { clearInterval(feeding); player.pause(); });
  const paused = await page.evaluate(() => player.currentTime);
  await page.waitForTimeout(150);
  const pausedAgain = await page.evaluate(() => player.currentTime);
  await page.getByRole('button', {name:'Start live audio'}).click();
  await page.waitForFunction(time => player.currentTime >= time + .5, paused);
  const final = await page.evaluate(() => { clearInterval(feeding); const value = {time:player.currentTime,underruns:player.underruns,status:player.status,contextState:player.context.state,sources:player.sources.size}; player.dispose(); return {...value,disposed:player.status}; });
  const checks = {firstAdvances:first.time>=2, noInitialUnderrun:first.underruns===0, switchesStayLive:switched.time>=4&&switched.underruns===0, clockFreezes:frozen===starved.time, underrunObserved:starved.underruns===1, resumesMissingSamples:resumed.time>=starved.time+.5&&resumed.underruns===1, pauseFreezes:paused===pausedAgain, pauseResumeWorks:final.time>=paused+.5, boundedSources:first.sources<9&&switched.sources<9&&final.sources<9, disposed:final.disposed==='disposed', noErrors:errors.length===0};
  const result = {date:new Date().toISOString(), userAgent:await page.evaluate(()=>navigator.userAgent), checks, first, switched, starved, frozen, resumed, paused, pausedAgain, final, errors};
  if(Object.values(checks).some(value=>!value)) throw new Error('Browser live audio checks failed');
  return result;
}
