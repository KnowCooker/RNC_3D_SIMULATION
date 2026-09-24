import { mountLab } from '/src/team-a/lab/index.ts';
import { analyzeLab, calculateLab, createLabStream, sampleField } from '/src/team-b/lab/index.ts';

const root = document.querySelector('#fixture-root');
const NativeAudioContext = window.AudioContext;
const events = [], errors = [], contexts = [], jobs = [];
let dispose = null, options = {}, hidden = false, audioGate = null, activeResult = null, stream = null;
let canceled = 0, pulls = 0, mountNumber = 0, lateDomWrites = 0, disposed = false;
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
window.addEventListener('error', event => errors.push({ type: 'error', message: event.message }));
window.addEventListener('unhandledrejection', event => errors.push({ type: 'unhandledrejection', message: String(event.reason) }));
const observer = new MutationObserver(records => { if (disposed) lateDomWrites += records.length; });
observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });

function deferred(kind, calculate) {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  const job = { kind, number: mountNumber, settled: false, resolve() {
    if (job.settled) return; job.settled = true;
    try { resolve(calculate?.()); } catch (error) { reject(error); }
  }, reject() { if (job.settled) return; job.settled = true; reject(new Error(`controlled ${kind} canceled`)); } };
  jobs.push(job); return promise;
}
class ControlledAudioContext extends NativeAudioContext {
  constructor(...args) { super(...args); contexts.push(this); }
  resume() {
    events.push({ event: 'audio-resume', number: mountNumber });
    const gate = audioGate;
    return gate ? gate.then(() => super.resume()) : super.resume();
  }
}
window.AudioContext = ControlledAudioContext;

function fieldAt(time, points) {
  if (stream) {
    const snapshot = stream.snapshot(32000), offset = snapshot.startSample / 2000;
    const frame = sampleField(snapshot.result, time - offset, points); frame.time += offset; return frame;
  }
  return sampleField(activeResult, time, points);
}
const fixture = {
  ready: false,
  async mount(next = {}) {
    dispose?.(); dispose = null;
    await Promise.resolve();
    options = next; hidden = false; disposed = false; lateDomWrites = 0;
    activeResult = null; stream = null; audioGate = null; mountNumber++; pulls = 0;
    dispose = mountLab(root, {
      analyze: analyzeLab,
      calculate(config, runId) {
        const compute = () => { activeResult = calculateLab(config, runId); return activeResult; };
        return options.delayCalculate ? deferred('calculate', compute) : Promise.resolve(compute());
      },
      startLive(config, runId) {
        const start = () => { stream = createLabStream(config, runId); };
        return options.delayStart ? deferred('start', start) : Promise.resolve(start());
      },
      pullLive(count) { pulls++; return Promise.resolve({ chunk: stream.process(count), snapshot: stream.snapshot(4096) }); },
      field(time, points) { return options.delayField ? deferred('field', () => fieldAt(time, points)) : Promise.resolve(fieldAt(time, points)); },
      cancel() {
        canceled++;
        if (!options.holdCancel) for (const job of jobs) if (job.number === mountNumber) job.reject();
      },
    });
    return mountNumber;
  },
  setHidden(value) { hidden = value; document.dispatchEvent(new Event('visibilitychange')); },
  delayAudio() {
    let resolve; audioGate = new Promise(yes => { resolve = yes; }); fixture.releaseAudio = () => { audioGate = null; resolve(); };
  },
  resolve(kind) { for (const job of jobs) if (job.number === mountNumber && job.kind === kind) job.resolve(); },
  async dispose() {
    dispose?.(); dispose = null;
    // Discard the intentional removal mutation; all later mutations are forbidden stale callbacks.
    observer.takeRecords(); disposed = true;
    await Promise.resolve();
  },
  state() {
    return { number: mountNumber, hidden, disposed, pulls, canceled, lateDomWrites, nodes: root.childElementCount,
      status: root.querySelector('#lab-status')?.textContent ?? null,
      time: root.querySelector('#lab-time')?.textContent ?? null,
      play: root.querySelector('#lab-play')?.textContent ?? null,
      metric: root.querySelector('#lab-metrics')?.textContent ?? null,
      field: root.querySelector('#lab-field-status')?.textContent ?? null,
      errors: [...errors], pending: jobs.filter(job => job.number === mountNumber && !job.settled).map(job => job.kind),
      streamSamples: stream?.sampleCount ?? 0,
      audioResumeCalls: events.filter(event => event.number === mountNumber).length };
  },
};
window.lifecycleFixture = fixture;
await fixture.mount();
fixture.ready = true;
