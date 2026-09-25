async page => {
  const config = {"durationMinimumSeconds":1200,"buildManifestSha256":"1fc91605b891fa26e70e757762709c56894932b5f99fc684ab8201eae3aed13c","sourceManifestSha256":"063c64a772e32e9c119a5d3ab8b81a4d51be5bd0c0986720cc36c8db73e5316d","session":"rnc-live-stability","revision":"2512c471e51330d692da68344d0f06a04389b111","url":"http://127.0.0.1:5187/","smokeOnly":false};
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(config => {
    const qa = window.__liveQa = {
      config, startedAt: Date.now(), performanceStart: performance.now(), errors: [], rejections: [], glLosses: [], violations: [],
      runs: [], currentRun: null, activeWorkers: 0, peakWorkers: 0, workerCreated: 0, workerMessages: 0,
      audio: { contexts: [], createdSources: 0, activeSources: 0, peakSources: 0, activeBufferBytes: 0, peakBufferBytes: 0 },
      restarts: 0, switches: 0, playActions: 0, samples: 0, visibilityEvents: [], backgroundTest: null,
      frameIntervals: [], lastFrame: 0, maximumSnapshotSamples: 0,
    };
    const record = (list, value) => { if (list.length < 200) list.push(value); };
    addEventListener('error', event => record(qa.errors, String(event.error || event.message)));
    addEventListener('unhandledrejection', event => record(qa.rejections, String(event.reason)));
    addEventListener('webglcontextlost', event => record(qa.glLosses, { at: Date.now(), status: event.statusMessage }), true);
    document.addEventListener('visibilitychange', () => record(qa.visibilityEvents, { at: Date.now(), state: document.visibilityState, time: document.querySelector('#lab-time')?.textContent, play: document.querySelector('#lab-play')?.textContent }));
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', event => { if (event.detail.isWebGLRenderer) window.__liveQaRenderer = event.detail; });
    const frame = time => {
      if (qa.lastFrame && document.visibilityState === 'visible') {
        qa.frameIntervals.push(time - qa.lastFrame); if (qa.frameIntervals.length > 600) qa.frameIntervals.shift();
      }
      qa.lastFrame = time; requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
    const hash = array => {
      const values = new Uint32Array(array.buffer, array.byteOffset, array.length);
      let value = 2166136261;
      for (const sample of values) value = Math.imul(value ^ sample, 16777619) >>> 0;
      return value.toString(16);
    };
    const NativeWorker = window.Worker;
    window.Worker = class ObservedWorker extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.qa = { number: ++qa.workerCreated, active: true, pending: new Map(), run: null };
        qa.activeWorkers++; qa.peakWorkers = Math.max(qa.peakWorkers, qa.activeWorkers);
        this.addEventListener('message', event => {
          qa.workerMessages++;
          const data = event.data, state = this.qa, run = state.run;
          if (!run) return;
          if (data.id !== undefined) state.pending.delete(data.id);
          run.pending = state.pending.size;
          if (data.type === 'ready' || data.type === 'result') {
            run.readyAt = Date.now(); run.ready = true; run.computeMilliseconds = data.result?.computeMilliseconds ?? null;
            if (data.result) run.batchSampleCount = data.result.sampleCount;
          }
          if (data.type === 'error') record(run.errors, { message: data.message, request: data.id, at: Date.now() });
          if (data.type === 'field') {
            run.fields++; run.lastFieldTime = data.frame.time; run.lastFieldValid = data.frame.valid;
            if (data.frame.valid && [data.frame.primarySpl, data.frame.residualSpl, data.frame.reductionDb].some(array => !array.every(Number.isFinite))) record(qa.violations, 'nonfinite valid field');
          }
          if (data.type !== 'chunk') return;
          const { chunk, snapshot } = data.packet;
          if (chunk.runId !== run.runId || chunk.startSample !== run.endSample) record(qa.violations, `chunk discontinuity ${run.runId}: expected ${run.endSample}, got ${chunk.startSample}`);
          if (chunk.sampleCount !== 400) record(qa.violations, `unexpected UI block size ${chunk.sampleCount}`);
          const arrays = [...chunk.sources, ...Object.values(chunk.signals).flat()];
          if (arrays.some(array => array.length !== chunk.sampleCount || !array.every(Number.isFinite))) record(qa.violations, 'invalid chunk arrays');
          if (snapshot.endSample !== chunk.startSample + chunk.sampleCount || snapshot.endSample - snapshot.startSample !== snapshot.result.sampleCount || snapshot.result.sampleCount > 4096) record(qa.violations, 'invalid bounded snapshot');
          qa.maximumSnapshotSamples = Math.max(qa.maximumSnapshotSamples, snapshot.result.sampleCount);
          const fingerprint = hash(chunk.sources[0]);
          if (chunk.startSample < 32000) run.first16Hashes[chunk.startSample] = fingerprint;
          else if (run.first16Hashes[chunk.startSample % 32000] !== undefined) {
            if (run.first16Hashes[chunk.startSample % 32000] === fingerprint) run.repeated16Blocks++;
            else run.new16Blocks++;
          }
          run.chunks++; run.endSample = chunk.startSample + chunk.sampleCount; run.lastChunkAt = Date.now();
          run.lastSnapshotStart = snapshot.startSample; run.lastSnapshotEnd = snapshot.endSample; run.lastSourceHash = fingerprint;
          run.firstChunkAt ??= Date.now();
        });
      }
      postMessage(...args) {
        const [data] = args, state = this.qa;
        if (data?.type === 'live-start' || data?.type === 'calculate') {
          const run = { runId: data.runId, mode: data.type === 'live-start' ? 'live' : 'batch', config: structuredClone(data.config), startedAt: Date.now(), ready: false, chunks: 0, endSample: 0, pending: 0, peakPending: 0, fields: 0, errors: [], first16Hashes: {}, repeated16Blocks: 0, new16Blocks: 0 };
          state.run = run; qa.runs.push(run); qa.currentRun = run.runId;
        }
        if (data?.id !== undefined) {
          state.pending.set(data.id, { type: data.type, at: Date.now() });
          if (state.run) { state.run.pending = state.pending.size; state.run.peakPending = Math.max(state.run.peakPending, state.pending.size); }
        }
        return super.postMessage(...args);
      }
      terminate() {
        if (this.qa.active) { this.qa.active = false; qa.activeWorkers--; if (this.qa.run) this.qa.run.terminatedAt = Date.now(); }
        this.qa.pending.clear(); return super.terminate();
      }
    };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class ObservedAudioContext extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        const context = { number: qa.audio.contexts.length + 1, createdAt: Date.now(), sampleRate: this.sampleRate, state: this.state, sources: new Map() };
        qa.audio.contexts.push(context);
        this.addEventListener('statechange', () => {
          context.state = this.state;
          if (this.state === 'closed') for (const source of [...context.sources.values()]) source.finish();
        });
        const nativeCreate = this.createBufferSource.bind(this);
        this.createBufferSource = (...sourceArgs) => {
          const node = nativeCreate(...sourceArgs), start = node.start.bind(node), id = ++qa.audio.createdSources;
          let counted = false, bytes = 0;
          const finish = () => {
            if (!counted) return; counted = false; qa.audio.activeSources--; qa.audio.activeBufferBytes -= bytes; context.sources.delete(id);
          };
          node.addEventListener('ended', finish, { once: true });
          node.start = (...startArgs) => {
            const result = start(...startArgs);
            bytes = node.buffer ? node.buffer.numberOfChannels * node.buffer.length * 4 : 0;
            counted = true; context.sources.set(id, { finish }); qa.audio.activeSources++; qa.audio.activeBufferBytes += bytes;
            qa.audio.peakSources = Math.max(qa.audio.peakSources, qa.audio.activeSources); qa.audio.peakBufferBytes = Math.max(qa.audio.peakBufferBytes, qa.audio.activeBufferBytes);
            return result;
          };
          return node;
        };
      }
    };
  }, config);
  await page.goto(config.url);
  await page.waitForFunction(() => !document.querySelector('#lab-play')?.disabled && /实验就绪/.test(document.querySelector('#lab-status')?.textContent ?? ''), null, { timeout: 20000 });
  await page.locator('#lab-mute').click();
  await page.locator('#lab-mode').selectOption('live');
  await page.locator('#lab-calculate').click();
  await page.waitForFunction(() => /实时/.test(document.querySelector('#lab-time')?.textContent ?? '') && parseFloat(document.querySelector('#lab-time').textContent) > 1, null, { timeout: 15000 });
  await page.locator('#lab-field').selectOption('residual');
  await page.locator('#lab-paths').selectOption('both');
  await page.locator('#lab-waves').check();
  await page.evaluate(() => { window.__liveQa.initialLiveRun = window.__liveQa.currentRun; window.__liveQa.exerciseStartedAt = Date.now(); window.__liveQa.playActions++; });
  return await page.evaluate(() => ({ config: __liveQa.config, startedAt: new Date(__liveQa.startedAt).toISOString(), exerciseStartedAt: new Date(__liveQa.exerciseStartedAt).toISOString(), userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory, initialLiveRun: __liveQa.initialLiveRun, notes: ['Real Worker messages are observed read-only; no fake clock or substituted result.', 'Muted browser transport verifies scheduling only, not physical audible output or AV latency.'] }));
}
