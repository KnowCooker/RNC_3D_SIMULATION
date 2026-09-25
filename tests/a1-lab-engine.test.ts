import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createLabEngine } from '../src/integration/lab-engine';
import { defaultLabConfig } from '../src/shared/lab-contracts';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  messages: any[] = [];
  terminated = false;
  constructor() { FakeWorker.instances.push(this); }
  terminate() { this.terminated = true; }
  postMessage(message: any) { this.messages.push(message); }
  receive(data: any) { this.onmessage?.({ data }); }
}
function setup(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  FakeWorker.instances = [];
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'Worker', previous); else Reflect.deleteProperty(globalThis, 'Worker'); });
  return createLabEngine();
}

test('live Worker cancellation rejects pending work and late old errors cannot kill the new run', async t => {
  const engine = setup(t), config = defaultLabConfig();
  const first = engine.startLive(config, 'first'), old = FakeWorker.instances.at(-1)!;
  old.receive({ type: 'ready', runId: 'first' }); await first;
  const chunk = engine.pullLive(400), field = engine.field(1, [[0, 1, 0]]);
  const chunkError = assert.rejects(chunk, /实验已更换/), fieldError = assert.rejects(field, /实验已更换/);
  const second = engine.startLive(config, 'second'), current = FakeWorker.instances.at(-1)!;
  await Promise.all([chunkError, fieldError]); assert.equal(old.terminated, true);
  old.onerror?.({ message: 'retired worker error' }); old.receive({ type: 'error', message: 'obsolete', runId: 'first' });
  current.receive({ type: 'ready', runId: 'second' }); await second;
  assert.equal(current.terminated, false);
  const next = engine.pullLive(200), id = current.messages.at(-1).id;
  const packet = { marker: 'current data' }; current.receive({ type: 'chunk', id, runId: 'second', packet });
  assert.equal(await next, packet); engine.cancel();
});

test('field failure is recoverable but a processor failure rejects every pending query', async t => {
  const engine = setup(t), started = engine.startLive(defaultLabConfig(), 'live'), worker = FakeWorker.instances.at(-1)!;
  worker.receive({ type: 'ready', runId: 'live' }); await started;
  const field = engine.field(0, [[0, 1, 0]]), fieldId = worker.messages.at(-1).id;
  const failure = assert.rejects(field, /history expired/);
  worker.receive({ type: 'error', id: fieldId, runId: 'live', message: 'history expired' }); await failure;
  assert.equal(worker.terminated, false);
  const chunk = engine.pullLive(200), id = worker.messages.at(-1).id;
  const waitingField = engine.field(1, [[0, 1, 0]]);
  const failures = [assert.rejects(chunk, /unstable/), assert.rejects(waitingField, /unstable/)];
  worker.receive({ type: 'error', id, runId: 'live', message: 'unstable' }); await Promise.all(failures);
  assert.equal(worker.terminated, true); await assert.rejects(engine.pullLive(200), /先启动/);
});

test('start cancellation and foreign run identities fail explicitly; batch mode cannot produce live chunks', async t => {
  const engine = setup(t), started = engine.startLive(defaultLabConfig(), 'pending');
  const failure = assert.rejects(started, /已取消/); engine.cancel(); await failure;
  const batch = engine.calculate(defaultLabConfig(), 'batch'), worker = FakeWorker.instances.at(-1)!;
  worker.receive({ type: 'result', runId: 'batch', result: { runId: 'batch' } }); await batch;
  await assert.rejects(engine.pullLive(), /不是实时/);
  const field = engine.field(1, [[0, 1, 0]]), fieldError = assert.rejects(field, /其他实验/);
  worker.receive({ type: 'field', runId: 'foreign', id: worker.messages.at(-1).id, frame: {} }); await fieldError;
  assert.equal(worker.terminated, true);
});
