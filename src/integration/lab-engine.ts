import type { FieldFrame, LabConfig, LabLivePacket, LabResult, Vec3 } from '../shared/lab-contracts';

export function createLabEngine() {
  let worker: Worker | null = null, runId = '', mode: 'batch' | 'live' | null = null;
  let rejectStart: ((error: Error) => void) | null = null, requestId = 0;
  const pending = new Map<number, { kind: 'field' | 'chunk'; resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  function cancel() {
    worker?.terminate(); worker = null; mode = null;
    rejectStart?.(new Error('计算已取消')); rejectStart = null;
    pending.forEach(p => p.reject(new Error('实验已更换'))); pending.clear();
  }
  function start<T>(config: LabConfig, id: string, kind: 'batch' | 'live') {
    cancel(); runId = id; mode = kind;
    return new Promise<T>((resolve, reject) => {
      rejectStart = reject;
      let active: Worker;
      try { active = new Worker(new URL('./lab.worker.ts', import.meta.url), { type: 'module' }); }
      catch (error) { rejectStart = null; mode = null; reject(error); return; }
      worker = active;
      const fail = (error: Error) => {
        if (worker !== active) return;
        rejectStart?.(error); rejectStart = null;
        active.terminate(); worker = null; mode = null;
        pending.forEach(p => p.reject(error)); pending.clear();
      };
      active.onmessage = ({ data }) => {
        if (worker !== active) return;
        if (data.runId !== undefined && data.runId !== runId) { fail(new Error('计算返回了其他实验的数据')); return; }
        if (data.type === 'result' && kind === 'batch') {
          if (data.result?.runId !== id) { fail(new Error('实验标识不匹配')); return; }
          rejectStart = null; resolve(data.result);
        } else if (data.type === 'ready' && kind === 'live') {
          rejectStart = null; resolve(undefined as T);
        } else if (data.type === 'field' || data.type === 'chunk') {
          const request = pending.get(data.id);
          if (request && request.kind === data.type) { pending.delete(data.id); request.resolve(data.type === 'field' ? data.frame : data.packet); }
        } else if (data.type === 'error') {
          const error = new Error(data.message);
          // A failed field query does not corrupt the processor. A failed processing step does.
          const request = pending.get(data.id);
          if (request?.kind === 'field') { pending.delete(data.id); request.reject(error); }
          else fail(error);
        }
      };
      active.onerror = event => fail(new Error(event.message || '计算线程停止'));
      try { active.postMessage({ type: kind === 'live' ? 'live-start' : 'calculate', config, runId: id }); }
      catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
    });
  }
  function request<T>(kind: 'field' | 'chunk', payload: object): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!worker || rejectStart) { reject(new Error('请先启动实验')); return; }
      if (kind === 'chunk' && mode !== 'live') { reject(new Error('当前不是实时实验')); return; }
      const id = ++requestId;
      pending.set(id, { kind, resolve: value => resolve(value as T), reject });
      try { worker.postMessage({ type: kind, id, ...payload }); }
      catch (error) { pending.delete(id); reject(error); }
    });
  }
  return {
    cancel,
    calculate: (config: LabConfig, id: string) => start<LabResult>(config, id, 'batch'),
    startLive: (config: LabConfig, id: string) => start<void>(config, id, 'live'),
    pullLive: (sampleCount = 200) => request<LabLivePacket>('chunk', { sampleCount }),
    field: (time: number, points: Vec3[]) => request<FieldFrame>('field', { time, points }),
  };
}
