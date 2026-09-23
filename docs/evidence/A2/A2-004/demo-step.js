async (page) => {
  // Invoke six times in the same fresh page. Each chapter uses 50 seconds of real time.
  const step = await page.evaluate(() => window.__a2DemoStep ?? 0);
  if (step >= 6) throw new Error('Six chapters already complete; reload before recording again.');
  const titles = [
    '1/6 结构：原创教学SUV、车身与内部部件（合成模型）',
    '2/6 结构展开、绕车观察、缩放与一键复位',
    '3/6 四个REF与四个OUT：点位对应真实参考/驱动通道',
    '4/6 四轮SOURCE是示意；点选查看同角REF，不新增测量信号',
    '5/6 四个MIC与d/e试听选择；录像不验证实物音质或延迟',
    '6/6 播放与道路/轮胎同步；复位结构保持播放时间'
  ];
  const started = Date.now();
  await page.evaluate(title => {
    let caption = document.getElementById('a2-demo-caption');
    if (!caption) {
      caption = document.createElement('div'); caption.id = 'a2-demo-caption';
      caption.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:8px;text-align:center;background:#101827;color:white;font:15px sans-serif;pointer-events:none';
      document.body.append(caption);
    }
    caption.textContent = title;
  }, titles[step]);
  const corners = ['FL', 'FR', 'RL', 'RR'];
  const reset = () => page.getByRole('button', { name: '复位视角与结构' }).click();
  const body = mode => page.getByRole('combobox', { name: '车身显示' }).selectOption(mode);
  const label = name => page.getByRole('button', { name: new RegExp(`^${name} ·`) }).click();
  const orbit = async () => {
    const box = await page.locator('#viewer canvas').boundingBox();
    await page.mouse.move(box.x + box.width * 0.84, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.57, box.y + box.height * 0.68, { steps: 18 });
    await page.mouse.up();
  };
  for (let slot = 0; slot < 10; slot++) {
    if (step === 0) {
      if (slot === 0) await reset();
      if (slot === 1) await body('solid');
      if (slot === 3) await orbit();
      if (slot === 5) await body('hidden');
      if (slot === 7) await body('transparent');
      if (slot === 9) await reset();
    } else if (step === 1) {
      if (slot === 0 || slot === 6) await page.getByRole('button', { name: '分层展开' }).click();
      if (slot === 2 || slot === 7) await orbit();
      if (slot === 3) await page.mouse.wheel(0, -100);
      if (slot === 4 || slot === 9) await reset();
    } else if (step === 2) {
      if (slot < 8) await label(`${slot < 4 ? 'REF' : 'OUT'} ${corners[slot % 4]}`);
    } else if (step === 3) {
      if (slot === 4) await page.getByRole('button', { name: '分层展开' }).click();
      if (slot < 8) await label(`SOURCE ${corners[slot % 4]}`);
      if (slot === 9) await reset();
    } else if (step === 4) {
      if (slot % 2 === 0 && slot < 8) {
        await label(`MIC ${corners[slot / 2]}`);
        await page.getByRole('button', { name: '重播', exact: true }).click();
      } else if (slot < 8) {
        await page.getByRole('combobox', { name: '声音对比' }).selectOption('d');
      }
    } else {
      if (slot === 0 || slot === 4 || slot === 8) await page.getByRole('button', { name: '重播', exact: true }).click();
      if (slot === 1) await page.getByRole('button', { name: '分层展开' }).click();
      if (slot === 2) await body('hidden');
      if (slot === 3 || slot === 9) await reset();
      if (slot === 5) await page.getByRole('button', { name: '暂停', exact: true }).click();
      if (slot === 6) await page.getByRole('button', { name: '播放', exact: true }).click();
      if (slot === 7) await page.getByRole('combobox', { name: '声音对比' }).selectOption('e');
    }
    await page.waitForTimeout(Math.max(0, started + (slot + 1) * 5000 - Date.now()));
  }
  await page.evaluate(next => { window.__a2DemoStep = next; }, step + 1);
  return { chapter: step + 1, title: titles[step], actualElapsedMs: Date.now() - started, hardware: await page.locator('[data-viewer-signal]').count(), sources: await page.locator('.rnc-source-label').count() };
}
