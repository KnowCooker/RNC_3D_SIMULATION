async page => {
  const url = page.url();
  const label = url.includes(':5186') ? 'baseline' : 'candidate';
  const requiredReserve = label === 'baseline' ? 0.38 : 1.18;
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.audioReserveQa = { chunks: 0, lastStart: 0, lastEnd: 0, runId: null, errors: [] };
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', ({ data }) => {
          if (data.type === 'chunk') {
            const { chunk, snapshot } = data.packet;
            audioReserveQa.chunks++;
            audioReserveQa.lastStart = snapshot.startSample;
            audioReserveQa.lastEnd = snapshot.endSample;
            audioReserveQa.runId = chunk.runId;
          } else if (data.type === 'error') audioReserveQa.errors.push(data.message);
        });
      }
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('实验就绪'));
  await page.locator('#lab-mode').selectOption('live');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => document.querySelector('#lab-status')?.textContent?.includes('缓冲'));
  await page.waitForFunction(() => Number.parseFloat(document.querySelector('#lab-time')?.textContent ?? '0') > 3);
  const sample = () => page.evaluate(() => {
    const status = document.querySelector('#lab-status').textContent;
    const time = Number.parseFloat(document.querySelector('#lab-time').textContent);
    const reserve = Number(status.match(/缓冲\s+([\d.]+)\s+s/)?.[1]);
    const underruns = Number(status.match(/补缓冲\s+(\d+)\s+次/)?.[1]);
    return { run: document.querySelector('#lab-run').textContent, time, reserve, underruns,
      samplePosition: Math.floor(time * 2000), worker: structuredClone(window.audioReserveQa), status };
  });
  await page.waitForFunction(required => {
    const status = document.querySelector('#lab-status')?.textContent ?? '';
    return Number(status.match(/缓冲\s+([\d.]+)\s+s/)?.[1]) >= required;
  }, requiredReserve);
  const before = await sample();
  await page.evaluate(() => { const begin = performance.now(); while (performance.now() - begin < 1050) {} });
  await page.waitForTimeout(1100);
  const afterStall = await sample();
  await page.locator('#lab-section').selectOption('x');
  await page.locator('#lab-field-slice').selectOption('x');
  await page.locator('#lab-field').selectOption('residual');
  await page.waitForFunction(() => document.querySelector('.lab-field-note-detail')?.textContent?.includes('当前车身剖面真实采样切片'));
  const afterView = await sample();
  await page.locator('#lab-play').click();
  const paused = await sample();
  await page.waitForTimeout(300);
  const pausedLater = await sample();
  await page.locator('#lab-play').click();
  await page.waitForFunction(value => Number.parseFloat(document.querySelector('#lab-time').textContent) > value + 0.3, paused.time);
  const resumed = await sample();
  const checks = {
    actualWorker: resumed.worker.chunks > 10 && resumed.worker.runId !== null,
    sameRun: [afterStall, afterView, paused, resumed].every(row => row.run === before.run),
    audioClockAdvanced: afterStall.time > before.time + 0.55,
    snapshotContainsDisplayedTime: [before, afterStall, afterView, resumed].every(row => row.samplePosition >= row.worker.lastStart + 1000 && row.samplePosition <= row.worker.lastEnd),
    pausedTimeFrozen: Math.abs(pausedLater.time - paused.time) < 0.02,
    resumedTimeAdvanced: resumed.time > paused.time + 0.3,
    queueBounded: [before, afterStall, afterView, paused, resumed].every(row => row.reserve >= 0 && row.reserve <= 2.01),
    noErrors: pageErrors.length === 0 && resumed.worker.errors.length === 0,
  };
  await page.screenshot({ path: `docs/evidence/A1/A1-FULL-008/${label}-after.png` });
  return { label, before, afterStall, afterView, paused, pausedLater, resumed, checks,
    avoidedSyntheticStallUnderrun: afterStall.underruns === before.underruns,
    pageErrors };
}
