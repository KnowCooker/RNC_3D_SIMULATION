// Run after harness-setup.js + a CLI snapshot. No @playwright/test dependency.
async (page) => {
  const checks = [], errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const assert = (name, value) => { if (!value) throw new Error(name); checks.push(name); };
  const state = () => page.evaluate(() => {
    const el = id => document.getElementById(id);
    return {
      diagnostics: el('diagnostics').textContent, status: el('status').textContent,
      source: el('source').textContent, time: el('time').textContent, play: el('play').textContent,
      params: ['taps', 'step', 'seed'].map(id => el(id).value),
      disabled: Object.fromEntries(['calculate','reference','taps','step','seed','play','replay','seek'].map(id => [id, el(id).disabled])),
      cancelHidden: el('cancel').hidden, cancelLabel: el('cancel').textContent,
      calls: window.__a1Test.calls.length, loads: window.__a1Test.loads.length, cancels: window.__a1Test.cancels
    };
  });
  const settle = (kind, index, outcome = 'resolve', change = {}) => page.evaluate(
    args => window.__a1Test.settle(...args), [kind, index, outcome, change]);
  const ready = () => page.waitForFunction(() => !document.getElementById('reference').disabled);
  const calculate = () => page.getByRole('button', { name: '计算新实验', exact: true }).click();
  const reference = () => page.getByRole('button', { name: '载入参考算例', exact: true }).click();
  const cancel = () => page.locator('#cancel').click();
  const baseline = (await state()).diagnostics;
  await calculate();
  let s = await state();
  assert('calculation locks all parameter, transport and submit controls', Object.values(s.disabled).every(Boolean) && !s.cancelHidden);
  // Dispatch an extra event to check the handler guard, even if a caller bypasses disabled UI.
  await page.locator('#calculate').dispatchEvent('click');
  assert('duplicate calculation does not reach engine', (await state()).calls === 1);
  await cancel();
  s = await state();
  assert('cancel invokes engine once, restores controls and retains previous identity', s.cancels === 1 && !s.disabled.play && s.diagnostics === baseline && s.status.includes('计算已取消'));
  await calculate();
  await settle('calls', 0); // a worker response from the cancelled job
  s = await state();
  assert('late cancelled calculation success cannot replace data or unlock newer job', s.disabled.calculate && s.diagnostics === baseline && s.status.includes('正在计算'));
  await settle('calls', 1, 'reject', { error: 'injected worker failure' });
  await ready();
  s = await state();
  assert('worker rejection retains old identity and exposes a readable retry state', s.status.includes('injected worker failure') && s.status.includes('上一次实验') && s.diagnostics === baseline && !s.disabled.play);
  for (const [name, change] of [
    ['wrong runId', { runId: 'unrelated-run' }],
    ['wrong source', { source: 'reference-replay' }],
    ['wrong config', { config: { seed: 47 } }]
  ]) {
    await calculate(); const index = (await state()).calls - 1;
    await settle('calls', index, 'resolve', change); await ready();
    s = await state();
    assert(`${name} rejected without relabelling old data`, s.status.includes('不一致') && s.diagnostics === baseline);
  }
  await reference();
  assert('reference load has its own cancel action', (await state()).cancelLabel === '取消加载');
  await cancel();
  assert('reference cancellation does not call worker cancel', (await state()).cancels === 1);
  await page.getByRole('combobox', { name: '滤波器系数数', exact: true }).selectOption('32');
  await page.getByRole('combobox', { name: '固定随机种子', exact: true }).selectOption('29');
  await calculate();
  await settle('loads', 0);
  s = await state();
  assert('late cancelled reference success cannot overwrite or unlock active calculation', s.disabled.calculate && s.diagnostics === baseline && s.params.join() === '32,0.08,29');
  await settle('calls', s.calls - 1); await ready();
  s = await state();
  assert('matching calculation accepted with correct source and chosen config', s.diagnostics.includes('computed-browser') && s.diagnostics.includes('seed=29 · taps=32') && s.source.includes('浏览器计算'));
  const computedIdentity = s.diagnostics;
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForFunction(() => Number(document.getElementById('seek').value) > 0.1);
  await reference();
  await page.waitForFunction(() => document.getElementById('play').textContent === '播放');
  await settle('loads', 1, 'reject', { error: null }); await ready();
  s = await state();
  assert('reference rejection pauses playback, retains computed source and handles non-Error rejection', s.play === '播放' && s.diagnostics === computedIdentity && s.status.includes('null') && s.status.includes('已暂停'));
  await reference(); await cancel(); await reference();
  await settle('loads', 2, 'reject', { error: 'obsolete failure' });
  s = await state();
  assert('late reference rejection cannot overwrite status or unlock current load', s.status === '正在加载参考数据…' && s.disabled.reference);
  await settle('loads', 3); await ready();
  s = await state();
  assert('successful reference resets controls to actual fixture parameters', s.params.join() === '64,0.08,11' && s.diagnostics === baseline && s.play === '播放');
  await reference(); await settle('loads', 4, 'resolve', { source: 'computed-browser' }); await ready();
  assert('reference endpoint cannot present a computed response as reference', (await state()).status.includes('不是参考算例') && (await state()).diagnostics === baseline);
  await calculate(); await cancel(); await calculate();
  s = await state();
  await settle('calls', s.calls - 2, 'reject', { error: 'late calculation error' });
  assert('late calculation rejection cannot finish newer calculation', (await state()).disabled.calculate && (await state()).status.includes('正在计算'));
  await cancel();
  await page.screenshot({ path: 'output/playwright/a1-002-cancelled.png', fullPage: true });
  await page.goto('http://127.0.0.1:5173/a1-state-harness?referenceOnly&delayedInitial');
  await page.waitForFunction(() => window.__a1Test?.loads.length === 1);
  assert('initial reference-only loading is cancellable', !(await state()).cancelHidden);
  await cancel(); s = await state();
  assert('cancel before first data keeps playback unavailable and retry available', s.disabled.play && s.disabled.replay && s.disabled.seek && !s.disabled.reference && s.status.includes('尚无'));
  await settle('loads', 0);
  assert('cancelled initial response cannot load data', (await state()).disabled.play);
  await reference(); await settle('loads', 1, 'reject', { error: 'network offline' }); await ready();
  assert('initial reference failure leaves no fake playable result', (await state()).disabled.play && (await state()).status.includes('network offline'));
  await reference(); await settle('loads', 2); await ready(); s = await state();
  assert('reference-only recovery retains locked parameters and enables playback', ['calculate','taps','step','seed'].every(id => s.disabled[id]) && !s.disabled.play && s.status.includes('参数固定'));
  assert('no uncaught page errors in injected request scenarios', errors.length === 0);
  return { transport: 'injected AppPorts; not a numeric engine test', checks, count: checks.length, errors };
}
