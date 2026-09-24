import { calculateLab, createLabStream, sampleField } from '../team-b/lab';
import type { LabResult } from '../shared/lab-contracts';
let result: LabResult | null = null;
let live: ReturnType<typeof createLabStream> | null = null;
let runId = '';
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'calculate') {
      live = null; runId = data.runId;
      result = calculateLab(data.config, runId);
      self.postMessage({ type: 'result', runId, result });
    } else if (data.type === 'live-start') {
      result = null; runId = data.runId;
      live = createLabStream(data.config, runId);
      self.postMessage({ type: 'ready', runId });
    } else if (data.type === 'chunk') {
      if (!live) throw new Error('实时计算尚未启动');
      const chunk = live.process(data.sampleCount);
      self.postMessage({ type: 'chunk', id: data.id, runId, packet: { chunk, snapshot: live.snapshot(4096) } });
    } else if (data.type === 'field') {
      if (live) {
        const snapshot = live.snapshot(32000), offset = snapshot.startSample / snapshot.result.config.sampleRateHz;
        const localTime = data.time - offset;
        if (localTime < 0 || (snapshot.startSample > 0 && localTime < 0.6)) throw new Error('所选声场时间已离开实时历史窗口');
        const frame = sampleField(snapshot.result, localTime, data.points);
        frame.time += offset;
        self.postMessage({ type: 'field', id: data.id, runId, frame });
      } else if (result) {
        self.postMessage({ type: 'field', id: data.id, runId, frame: sampleField(result, data.time, data.points) });
      } else throw new Error('尚无实验结果');
    }
  } catch (error) { self.postMessage({ type: 'error', id: data.id, runId, message: error instanceof Error ? error.message : String(error) }); }
};
