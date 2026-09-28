import { calculateLab, createLabStream, sampleField, decodeRecordedNoise } from '../team-b/lab';
import recordedNoiseUrl from '../team-b/lab/data/recorded-primary.f32?url';
import { LAB_STREAM_CABIN_PREROLL_SAMPLES } from '../team-b/lab/stream';
import { LAB_LIVE_HISTORY_SAMPLES, supportedLabLayoutId, type LabConfig, type LabResult } from '../shared/lab-contracts';
let result: LabResult | null = null;
let live: ReturnType<typeof createLabStream> | null = null;
let runId = '';
async function loadSource(config: LabConfig) {
  if (config.sourceMode !== 'recorded-noise') return undefined;
  const response = await fetch(recordedNoiseUrl);
  if (!response.ok) throw new Error(`实录噪声加载失败（${response.status}）`);
  return decodeRecordedNoise(await response.arrayBuffer());
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'calculate') {
      const layoutId = supportedLabLayoutId(data.config);
      const config: LabConfig = { ...data.config, layoutId };
      live = null; runId = data.runId;
      result = calculateLab(config, runId, await loadSource(config));
      self.postMessage({ type: 'result', runId, result });
    } else if (data.type === 'live-start') {
      const layoutId = supportedLabLayoutId(data.config);
      const config: LabConfig = { ...data.config, layoutId };
      result = null; runId = data.runId;
      live = createLabStream(config, runId, LAB_LIVE_HISTORY_SAMPLES, await loadSource(config));
      self.postMessage({ type: 'ready', runId, layoutId });
    } else if (data.type === 'chunk') {
      if (!live) throw new Error('实时计算尚未启动');
      const chunk = live.process(data.sampleCount);
      self.postMessage({ type: 'chunk', id: data.id, runId, packet: { chunk, snapshot: live.snapshot(LAB_LIVE_HISTORY_SAMPLES) } });
    } else if (data.type === 'rnc') {
      if (!live) throw new Error('实时计算尚未启动');
      self.postMessage({ type: 'rnc', id: data.id, runId, change: live.setRncEnabled(data.enabled) });
    } else if (data.type === 'field') {
      if (live) {
        const snapshot = live.snapshot(LAB_LIVE_HISTORY_SAMPLES), offset = snapshot.startSample / snapshot.result.config.sampleRateHz;
        const localTime = data.time - offset;
        if (localTime < 0 || (snapshot.startSample > 0 && localTime < 0.5 + LAB_STREAM_CABIN_PREROLL_SAMPLES / snapshot.result.config.sampleRateHz)) throw new Error('所选声场时间已离开实时历史窗口');
        const frame = sampleField(snapshot.result, localTime, data.points, data.weighting);
        frame.layoutId = supportedLabLayoutId(snapshot.result.config);
        frame.time += offset;
        self.postMessage({ type: 'field', id: data.id, runId, frame });
      } else if (result) {
        const frame = sampleField(result, data.time, data.points, data.weighting);
        frame.layoutId = supportedLabLayoutId(result.config);
        self.postMessage({ type: 'field', id: data.id, runId, frame });
      } else throw new Error('尚无实验结果');
    }
  } catch (error) { self.postMessage({ type: 'error', id: data.id, runId: data.runId ?? runId, message: error instanceof Error ? error.message : String(error) }); }
};
