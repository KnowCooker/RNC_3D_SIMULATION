async (page) => {
  const checks = [];
  const assert = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
  // This hook and observation state exist only in the test browser, never in production.
  await page.addInitScript(() => {
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
      const renderer = event.detail;
      if (!renderer.isWebGLRenderer) return;
      const render = renderer.render;
      renderer.render = function(scene, camera) {
        window.__a2Observed = { scene, camera, renderer };
        return render.apply(this, arguments);
      };
    });
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.waitForFunction(() => Boolean(window.__a2Observed));
  const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const snapshot = () => page.evaluate(() => {
    const { scene, camera, renderer } = window.__a2Observed;
    const objects = [];
    scene.traverse(object => {
      if (!object.isMesh) return;
      objects.push({ id: object.id, position: object.position.toArray(), rotation: object.rotation.toArray().slice(0, 3), scale: object.scale.toArray(), visible: object.visible, opacity: object.material.opacity });
    });
    return { camera: [...camera.position.toArray(), ...camera.quaternion.toArray()], objects, memory: { ...renderer.info.memory }, triangles: renderer.info.render.triangles };
  });
  const equal = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-10 :
    Array.isArray(a) ? a.length === b.length && a.every((x, i) => equal(x, b[i])) :
    a && typeof a === 'object' ? Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => equal(a[key], b[key])) : a === b;
  const seek = async time => {
    await page.getByRole('slider', { name: '播放进度' }).evaluate((input, value) => {
      input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true }));
    }, time);
    await frame();
  };
  const motion = () => page.evaluate(() => {
    const { scene } = window.__a2Observed;
    const wheelAngles = [], roadPositions = [];
    scene.traverse(object => {
      if (object.geometry?.type === 'CylinderGeometry' && object.geometry.parameters.radiusTop === 0.4) wheelAngles.push(object.rotation.x);
      if (object.geometry?.type === 'BoxGeometry' && object.geometry.parameters.width === 0.035) roadPositions.push(object.position.z);
    });
    return { wheelAngles, roadPositions };
  });
  await seek(0);
  await page.getByRole('button', { name: '复位视角与结构' }).click(); await frame();
  const baseline = await snapshot();
  assert(baseline.objects.length > 70 && baseline.triangles < 50000, 'baseline contains vehicle and road, fewer than 50000 rendered triangles');
  await page.screenshot({ path: 'output/playwright/a2-stability-initial.png' });
  let expandedReference = null;
  const rounds = [];
  for (let round = 1; round <= 20; round++) {
    const time = round * 0.75;
    await seek(time);
    const moving = await motion();
    assert(moving.wheelAngles.length === 4 && moving.wheelAngles.every(x => Math.abs(x - time * (60 / 3.6) / 0.4) < 1e-9), `round ${round}: four wheels follow supplied time ${time}`);
    assert(moving.roadPositions.length === 44 && moving.roadPositions.every((z, i) => Math.abs(z - ((Math.floor(i / 2) * 3 + time * (60 / 3.6)) % 66 - 33)) < 1e-9), `round ${round}: all 44 road marks follow supplied time`);
    await frame();
    assert(equal(await motion(), moving), `round ${round}: paused frame does not advance wheel or road time`);
    await page.getByRole('combobox', { name: '车身显示' }).selectOption('solid');
    await page.getByRole('button', { name: '分层展开' }).click(); await frame();
    let state = await snapshot();
    assert(state.objects.some(object => object.opacity === 1) && state.objects.length === baseline.objects.length, `round ${round}: solid expanded scene keeps object count`);
    await page.getByRole('combobox', { name: '车身显示' }).selectOption('hidden'); await frame();
    state = await snapshot();
    assert(state.objects.filter(object => !object.visible).length === 13, `round ${round}: hide changes only 13 shell meshes`);
    await page.getByRole('combobox', { name: '车身显示' }).selectOption('transparent');
    await seek(0); await frame();
    state = await snapshot();
    if (expandedReference === null) expandedReference = state.objects;
    assert(equal(state.objects, expandedReference), `round ${round}: expanded positions/materials are identical without accumulated drift`);
    if (round === 1) await page.screenshot({ path: 'output/playwright/a2-stability-expanded.png' });
    await page.getByRole('button', { name: '收起结构' }).click();
    await page.getByRole('button', { name: '分层展开' }).click();
    const box = await page.locator('#viewer canvas').boundingBox();
    const button = round % 2 ? 'left' : 'right';
    await page.mouse.move(box.x + box.width * 0.84, box.y + box.height * 0.8);
    await page.mouse.down({ button });
    await page.mouse.move(box.x + box.width * 0.57, box.y + box.height * 0.68, { steps: 4 });
    await page.mouse.up({ button });
    await page.mouse.wheel(0, round % 2 ? -100 : 100);
    await page.getByRole('button', { name: '复位视角与结构' }).click(); await frame();
    const reset = await snapshot();
    assert(equal(reset.camera, baseline.camera), `round ${round}: immediate reset restores exact default camera after ${button === 'left' ? 'orbit' : 'pan'} and zoom`);
    assert(equal(reset.objects, baseline.objects), `round ${round}: reset restores all mesh transforms/visibility/opacity`);
    assert(reset.memory.geometries <= baseline.objects.length && reset.memory.textures === baseline.memory.textures, `round ${round}: allocated geometries stay within fixed scene topology; texture count unchanged`);
    await page.waitForTimeout(120); await frame();
    const settled = await snapshot();
    assert(equal(settled.camera, baseline.camera), `round ${round}: no residual camera motion after reset`);
    assert(await page.locator('.rnc-marker-label:visible').count() === 12, `round ${round}: all 12 labels restored`);
    rounds.push({ round, camera: reset.camera, meshes: reset.objects.length, memory: reset.memory });
  }
  await page.screenshot({ path: 'output/playwright/a2-stability-round20.png' });
  // Non-monotonic seeks prove render consumes absolute external time, not a local accumulator.
  await seek(16); const atEnd = await motion(); await seek(0); await seek(16);
  assert(equal(atEnd, await motion()), 'seeking backward then to the end reproduces wheel/road pose exactly');
  const beforeResetAtEnd = await motion();
  await page.getByRole('button', { name: '复位视角与结构' }).click(); await frame();
  assert(equal(beforeResetAtEnd, await motion()), 'view reset preserves externally supplied playback time');
  await seek(0);
  return { assertions: checks.length, passed: checks, rounds, baseline: { meshes: baseline.objects.length, memory: baseline.memory, triangles: baseline.triangles }, note: 'Controlled slider input tests external time consumption, not measured audio/visual latency or target GPU performance.' };
}
