async page => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.integrationQA = { results: [], fields: [], errors: [] };
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', ({ data }) => {
          if (data.type === 'result') {
            let u0Peak = 0;
            for (const value of data.result.signals.u[0]) u0Peak = Math.max(u0Peak, Math.abs(value));
            integrationQA.results.push({ runId: data.runId, vehicle: data.result.config.vehicle,
              references: data.result.config.references.length, xCount: data.result.signals.x.length,
              speakers: data.result.config.speakerEnabled, stepSize: data.result.config.stepSize,
              reductionDb: data.result.metrics.reductionDbByMic, u0Peak });
          } else if (data.type === 'field') integrationQA.fields.push({ runId: data.runId, time: data.frame.time,
            valid: data.frame.valid, x: data.frame.points?.[120]?.[0], count: data.frame.points?.length });
          else if (data.type === 'error') integrationQA.errors.push(data.message);
        });
      }
      postMessage(data, ...rest) {
        if (data.type === 'field') integrationQA.fields.push({ request: true, runId: this.runId, time: data.time,
          x: data.points[120][0], count: data.points.length });
        else if (data.type === 'calculate') this.runId = data.runId;
        return super.postMessage(data, ...rest);
      }
    };
  });
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(String(error)));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5185/');
  await page.waitForFunction(() => window.integrationQA?.results.length === 1);
  const records = [];
  const state = () => page.evaluate(() => {
    const canvas = document.querySelector('#lab-viewer canvas'), gl = canvas.getContext('webgl2'), info = gl.getExtension('WEBGL_debug_renderer_info');
    return { run: document.querySelector('#lab-run').textContent, time: document.querySelector('#lab-time').textContent,
      body: document.querySelector('#lab-body').value, section: document.querySelector('#lab-section').value,
      position: document.querySelector('#lab-section-position').value, field: document.querySelector('#lab-field-status').textContent,
      note: document.querySelector('.lab-field-note-detail')?.textContent,
      markers: document.querySelectorAll('#lab-viewer .lab-marker[data-signal]').length,
      exploded: document.querySelector('#lab-explode').getAttribute('aria-pressed'), contextLost: gl.isContextLost(),
      gpu: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) };
  });
  for (const kind of ['ice', 'hev', 'erev', 'bev']) {
    await page.locator('#lab-vehicle').selectOption(kind);
    const previous = await page.evaluate(() => integrationQA.results.length);
    await page.locator('#lab-calculate').click();
    await page.waitForFunction(previous => integrationQA.results.length > previous, previous);
    const result = await page.evaluate(() => integrationQA.results.at(-1));
    if (result.vehicle !== kind || result.references !== 4 || result.xCount !== 4) throw Error(`Wrong four-car result: ${JSON.stringify(result)}`);
    await page.evaluate(() => { const seek = document.querySelector('#lab-seek'); seek.value = '3.9'; seek.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#lab-body').selectOption('solid');
    await page.locator('#lab-field-slice').selectOption('x');
    await page.locator('#lab-section').selectOption('x');
    await page.locator('#lab-field').selectOption('residual');
    await page.evaluate(() => { const slider = document.querySelector('#lab-section-position'); slider.value = '0.6'; slider.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => document.querySelector('.lab-field-note-detail')?.textContent?.includes('X=0.60 m 当前车身剖面真实采样切片'));
    const solid = await state();
    const fields = await page.evaluate(runId => integrationQA.fields.filter(row => row.runId === runId && row.request && row.count === 280 && row.time === 3.9 && row.x === 0.6), result.runId);
    if (solid.contextLost || solid.markers !== 16 || solid.time !== '3.90 / 16 s' || fields.length < 1) throw Error(`${kind} combined field/vehicle mismatch: ${JSON.stringify({ solid, fields })}`);
    records.push({ kind, runId: result.runId, result, solid, fieldRequests: fields.length });
    if (kind === 'bev') {
      await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/full-lab/integration-021/bev-solid-x.png' });
      for (const mode of ['transparent', 'hidden']) {
        await page.locator('#lab-body').selectOption(mode);
        const current = await state();
        if (current.run !== solid.run || current.contextLost || current.markers !== 16 || !current.note?.includes('X=0.60 m')) throw Error(`${mode} lost current field: ${JSON.stringify(current)}`);
        records.push({ kind, mode, ...current });
        await page.locator('#lab-viewer').screenshot({ path: `docs/evidence/full-lab/integration-021/bev-${mode}-x.png` });
      }
      await page.locator('#lab-body').selectOption('solid');
      await page.locator('#lab-explode').click();
      const exploded = await state();
      if (exploded.run !== solid.run || exploded.exploded !== 'true' || exploded.contextLost || !exploded.note?.includes('X=0.60 m')) throw Error(`Exploded field mismatch: ${JSON.stringify(exploded)}`);
      records.push({ kind, mode: 'exploded', ...exploded });
      await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/full-lab/integration-021/bev-exploded-x.png' });
      await page.locator('#lab-explode').click();
    }
  }
  const changes = [];
  async function recalculate(label) {
    const previous = await page.evaluate(() => integrationQA.results.length);
    await page.locator('#lab-calculate').click();
    await page.waitForFunction(previous => integrationQA.results.length > previous, previous);
    const result = await page.evaluate(() => integrationQA.results.at(-1));
    changes.push({ label, result, run: await page.locator('#lab-run').textContent() });
    return result;
  }
  await page.locator('[data-speaker="0"]').uncheck();
  const disabled = await recalculate('speaker-0-disabled');
  if (disabled.speakers[0] !== false || disabled.u0Peak !== 0) throw Error(`Disabled speaker still drives: ${JSON.stringify(disabled)}`);
  await page.locator('[data-speaker="0"]').check();
  await recalculate('speaker-0-restored');
  await page.locator('#lab-step').fill('0');
  const zeroStep = await recalculate('zero-step');
  if (zeroStep.stepSize !== 0 || zeroStep.u0Peak !== 0) throw Error(`Zero step still drives: ${JSON.stringify(zeroStep)}`);
  await page.locator('#lab-step').fill('0.08');
  await recalculate('step-restored');
  await page.locator('#lab-edit').check();
  await page.locator('#lab-references .lab-reference-row button[aria-label^="移除"]').first().click();
  const removed = await recalculate('reference-removed');
  if (removed.references !== 3 || removed.xCount !== 3 || (await state()).markers !== 15) throw Error(`Reference topology not updated: ${JSON.stringify(removed)}`);
  await page.locator('#lab-viewer').screenshot({ path: 'docs/evidence/full-lab/integration-021/bev-reference-removed.png' });
  const errors = await page.evaluate(() => integrationQA.errors);
  if (errors.length || pageErrors.length) throw Error(`Real page/Worker errors: ${JSON.stringify({ errors, pageErrors })}`);
  return { records, changes, errors, pageErrors };
}
