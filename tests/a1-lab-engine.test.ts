import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createLabEngine } from '../src/integration/lab-engine';
import { defaultLabConfig, TEACHING_LAYOUT_ID, type LabConfig } from '../src/shared/lab-contracts';

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
const startedConfig = (worker: FakeWorker): LabConfig => structuredClone(worker.messages[0].config);
const ready = (worker: FakeWorker, runId: string, config = startedConfig(worker)) =>
  worker.receive({ type: 'ready', runId, layoutId: config.layoutId, config });
const packetFor = (worker: FakeWorker, runId: string, marker: string, config = startedConfig(worker)) => ({
  marker, chunk: { runId }, snapshot: { result: { runId, config } },
});

test('live Worker cancellation rejects pending work and late old errors cannot kill the new run', async t => {
  const engine = setup(t), config = defaultLabConfig();
  const first = engine.startLive(config, 'first'), old = FakeWorker.instances.at(-1)!;
  ready(old, 'first'); await first;
  const chunk = engine.pullLive(400), field = engine.field(1, [[0, 1, 0]]), control = engine.setLiveRnc(false);
  const chunkError = assert.rejects(chunk, /实验已更换/), fieldError = assert.rejects(field, /实验已更换/), controlError = assert.rejects(control, /实验已更换/);
  const second = engine.startLive(config, 'second'), current = FakeWorker.instances.at(-1)!;
  await Promise.all([chunkError, fieldError, controlError]); assert.equal(old.terminated, true);
  old.onerror?.({ message: 'retired worker error' }); old.receive({ type: 'error', message: 'obsolete', runId: 'first' });
  ready(current, 'second'); await second;
  assert.equal(current.terminated, false);
  const next = engine.pullLive(200), id = current.messages.at(-1).id;
  const packet = packetFor(current, 'second', 'current data'); current.receive({ type: 'chunk', id, runId: 'second', packet });
  assert.equal(await next, packet); engine.cancel();
});

test('field failure is recoverable but a processor failure rejects every pending query', async t => {
  const engine = setup(t), started = engine.startLive(defaultLabConfig(), 'live'), worker = FakeWorker.instances.at(-1)!;
  ready(worker, 'live'); await started;
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
  worker.receive({ type: 'result', runId: 'batch', result: { runId: 'batch', config: startedConfig(worker) } }); await batch;
  await assert.rejects(engine.pullLive(), /不是实时/);
  await assert.rejects(engine.setLiveRnc(false), /不是实时/);
  const field = engine.field(1, [[0, 1, 0]]), fieldError = assert.rejects(field, /其他实验/);
  worker.receive({ type: 'field', runId: 'foreign', id: worker.messages.at(-1).id, frame: {} }); await fieldError;
  assert.equal(worker.terminated, true);
});

test('live RNC control returns the exact sample boundary and a rejected switch preserves the running worker', async t => {
  const engine = setup(t), started = engine.startLive(defaultLabConfig(), 'switch'), worker = FakeWorker.instances.at(-1)!;
  ready(worker, 'switch'); await started;
  const change = engine.setLiveRnc(false), message = worker.messages.at(-1);
  assert.equal(message.type, 'rnc'); assert.equal(message.enabled, false);
  worker.receive({ type: 'rnc', id: message.id, runId: 'switch', change: { enabled: false, effectiveSample: 12345 } });
  assert.deepEqual(await change, { enabled: false, effectiveSample: 12345 });
  const rejected = engine.setLiveRnc(true), id = worker.messages.at(-1).id;
  const failure = assert.rejects(rejected, /已结束/);
  worker.receive({ type: 'error', id, runId: 'switch', message: '实时实验已结束' }); await failure;
  assert.equal(worker.terminated, false);
  const next = engine.pullLive(200), packet = packetFor(worker, 'switch', 'still running', { ...startedConfig(worker), rncEnabled: false });
  worker.receive({ type: 'chunk', id: worker.messages.at(-1).id, runId: 'switch', packet });
  assert.equal(await next, packet); engine.cancel();
});

test('legacy layout is stamped and unimplemented layouts fail before replacing a running experiment', async t => {
  const engine = setup(t), legacy = defaultLabConfig(); delete legacy.layoutId;
  const started = engine.startLive(legacy, 'legacy'), worker = FakeWorker.instances.at(-1)!;
  assert.equal(worker.messages[0].config.layoutId, TEACHING_LAYOUT_ID);
  ready(worker, 'legacy'); await started;
  await assert.rejects(engine.calculate({ ...legacy, layoutId: 'showroom-unverified-v1' }, 'wrong'), /尚未接入声学路径/);
  assert.equal(FakeWorker.instances.length, 1);
  assert.equal(worker.terminated, false);
  const chunk = engine.pullLive(200);
  const preserved = packetFor(worker, 'legacy', 'preserved');
  worker.receive({ type: 'chunk', id: worker.messages.at(-1).id, runId: 'legacy', packet: preserved });
  assert.deepEqual(await chunk, preserved); engine.cancel();
});

test('field frames without the active physical layout are rejected without killing the experiment', async t => {
  const engine = setup(t), started = engine.startLive(defaultLabConfig(), 'layout-field'), worker = FakeWorker.instances.at(-1)!;
  ready(worker, 'layout-field'); await started;
  for (const layoutId of ['other-asset-v1', undefined]) {
    const field = engine.field(1, [[0, 1, 0]]), id = worker.messages.at(-1).id;
    const failure = assert.rejects(field, /物理布局身份/);
    worker.receive({ type: 'field', id, runId: 'layout-field', frame: { layoutId } }); await failure;
    assert.equal(worker.terminated, false);
  }
  const field = engine.field(1, [[0, 1, 0]]), id = worker.messages.at(-1).id;
  const frame = { layoutId: TEACHING_LAYOUT_ID, time: 1, valid: true };
  worker.receive({ type: 'field', id, runId: 'layout-field', frame });
  assert.equal(await field, frame);
  engine.cancel();
});

test('batch results and live packets cannot switch physical layout inside an accepted run', async t => {
  const engine = setup(t), config = defaultLabConfig();
  const batch = engine.calculate(config, 'batch-layout'), batchWorker = FakeWorker.instances.at(-1)!;
  const rejectedBatch = assert.rejects(batch, /计算结果物理布局身份/);
  batchWorker.receive({ type: 'result', runId: 'batch-layout', result: { runId: 'batch-layout', config: { ...startedConfig(batchWorker), layoutId: 'other-asset-v1' } } });
  await rejectedBatch; assert.equal(batchWorker.terminated, true);

  const live = engine.startLive(config, 'live-layout'), liveWorker = FakeWorker.instances.at(-1)!;
  const rejectedReady = assert.rejects(live, /实时实验物理布局身份/);
  ready(liveWorker, 'live-layout', { ...startedConfig(liveWorker), layoutId: 'other-asset-v1' });
  await rejectedReady; assert.equal(liveWorker.terminated, true);

  const retry = engine.startLive(config, 'live-valid'), worker = FakeWorker.instances.at(-1)!;
  ready(worker, 'live-valid'); await retry;
  const chunk = engine.pullLive(200), id = worker.messages.at(-1).id;
  const rejectedChunk = assert.rejects(chunk, /实时数据包.*身份/);
  worker.receive({ type: 'chunk', id, runId: 'live-valid', packet: packetFor(worker, 'live-valid', 'wrong layout', { ...startedConfig(worker), layoutId: 'other-asset-v1' }) });
  await rejectedChunk; assert.equal(worker.terminated, true);
});

test('same-layout responses cannot substitute another vehicle or physical experiment configuration', async t => {
  const engine = setup(t), config = defaultLabConfig();
  const batch = engine.calculate(config, 'batch-config'), batchWorker = FakeWorker.instances.at(-1)!;
  const badBatch = assert.rejects(batch, /计算结果配置/);
  batchWorker.receive({ type: 'result', runId: 'batch-config', result: { runId: 'batch-config', config: { ...startedConfig(batchWorker), vehicle: 'ice' } } });
  await badBatch; assert.equal(batchWorker.terminated, true);

  const live = engine.startLive(config, 'live-config'), readyWorker = FakeWorker.instances.at(-1)!;
  const badReady = assert.rejects(live, /实时实验配置/);
  ready(readyWorker, 'live-config', { ...startedConfig(readyWorker), roadRoughness: 2.2 });
  await badReady; assert.equal(readyWorker.terminated, true);

  const retry = engine.startLive(config, 'live-correct'), worker = FakeWorker.instances.at(-1)!;
  ready(worker, 'live-correct'); await retry;
  const chunk = engine.pullLive(200), badChunk = assert.rejects(chunk, /实时数据包配置/);
  const altered = startedConfig(worker);
  const [x, y, z] = altered.references[0].position;
  altered.references[0] = { ...altered.references[0], position: [x + 0.25, y, z] };
  worker.receive({ type: 'chunk', id: worker.messages.at(-1).id, runId: 'live-correct', packet: packetFor(worker, 'live-correct', 'wrong reference', altered) });
  await badChunk; assert.equal(worker.terminated, true);
});

test('Worker replies without the active run identity cannot enter results or field views', async t => {
  const engine = setup(t);
  const batch = engine.calculate(defaultLabConfig(), 'batch-identity'), batchWorker = FakeWorker.instances.at(-1)!;
  const missingBatch = assert.rejects(batch, /缺少实验标识/);
  batchWorker.receive({ type: 'result', result: { runId: 'batch-identity', config: startedConfig(batchWorker) } });
  await missingBatch; assert.equal(batchWorker.terminated, true);

  const live = engine.startLive(defaultLabConfig(), 'live-identity'), worker = FakeWorker.instances.at(-1)!;
  ready(worker, 'live-identity'); await live;
  const field = engine.field(1, [[0, 1, 0]]), missingField = assert.rejects(field, /缺少实验标识/);
  worker.receive({ type: 'field', id: worker.messages.at(-1).id, frame: { layoutId: TEACHING_LAYOUT_ID } });
  await missingField; assert.equal(worker.terminated, true);
});
