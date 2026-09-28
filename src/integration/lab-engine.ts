import { supportedLabLayoutId, type AcousticWeighting, type FieldFrame, type LabConfig, type LabLivePacket, type LabResult, type LabRncChange, type Vec3 } from '../shared/lab-contracts';

function configIdentity(config: unknown): string {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return '';
  const ordered = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
    return value;
  };
  return JSON.stringify(ordered(config)) ?? '';
}

export function createLabEngine() {
  let worker: Worker | null = null, runId = '', activeLayoutId = '', activeConfigIdentity = '', mode: 'batch' | 'live' | null = null;
  let activeConfig: LabConfig | null = null;
  let rejectStart: ((error: Error) => void) | null = null, requestId = 0;
  const pending = new Map<number, { kind: 'field' | 'chunk' | 'rnc'; enabled?: boolean; resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  function cancel() {
    worker?.terminate(); worker = null; mode = null; activeLayoutId = ''; activeConfigIdentity = ''; activeConfig = null;
    rejectStart?.(new Error('计算已取消')); rejectStart = null;
    pending.forEach(p => p.reject(new Error('实验已更换'))); pending.clear();
  }
  function start<T>(config: LabConfig, id: string, kind: 'batch' | 'live') {
    return new Promise<T>((resolve, reject) => {
      let layoutId: string;
      try { layoutId = supportedLabLayoutId(config); }
      catch (error) { reject(error); return; }
      const startedConfig: LabConfig = structuredClone({ ...config, layoutId });
      cancel(); runId = id; activeLayoutId = layoutId; activeConfig = startedConfig; activeConfigIdentity = configIdentity(startedConfig); mode = kind;
      rejectStart = reject;
      let active: Worker;
      try { active = new Worker(new URL('./lab.worker.ts', import.meta.url), { type: 'module' }); }
      catch (error) { rejectStart = null; mode = null; activeLayoutId = ''; activeConfigIdentity = ''; activeConfig = null; reject(error); return; }
      worker = active;
      const fail = (error: Error) => {
        if (worker !== active) return;
        rejectStart?.(error); rejectStart = null;
        active.terminate(); worker = null; mode = null; activeLayoutId = ''; activeConfigIdentity = ''; activeConfig = null;
        pending.forEach(p => p.reject(error)); pending.clear();
      };
      active.onmessage = ({ data }) => {
        if (worker !== active) return;
        if (data.runId !== undefined && data.runId !== runId) { fail(new Error('计算返回了其他实验的数据')); return; }
        if (data.type === 'result' && kind === 'batch') {
          if (data.result?.runId !== id) { fail(new Error('实验标识不匹配')); return; }
          if (data.result?.config?.layoutId !== activeLayoutId) { fail(new Error('计算结果物理布局身份与启动配置不一致')); return; }
          if (configIdentity(data.result?.config) !== activeConfigIdentity) { fail(new Error('计算结果配置与启动配置不一致')); return; }
          rejectStart = null; resolve(data.result);
        } else if (data.type === 'ready' && kind === 'live') {
          if (data.layoutId !== activeLayoutId) { fail(new Error('实时实验物理布局身份与启动配置不一致')); return; }
          if (configIdentity(data.config) !== activeConfigIdentity) { fail(new Error('实时实验配置与启动配置不一致')); return; }
          rejectStart = null; resolve(undefined as T);
        } else if (data.type === 'field' || data.type === 'chunk' || data.type === 'rnc') {
          const request = pending.get(data.id);
          if (request && request.kind === data.type) {
            if (data.type === 'chunk' && (data.packet?.chunk?.runId !== runId || data.packet?.snapshot?.result?.runId !== runId || data.packet?.snapshot?.result?.config?.layoutId !== activeLayoutId)) {
              fail(new Error('实时数据包的实验或物理布局身份不一致')); return;
            }
            if (data.type === 'chunk' && configIdentity(data.packet?.snapshot?.result?.config) !== activeConfigIdentity) {
              fail(new Error('实时数据包配置与启动配置不一致')); return;
            }
            if (data.type === 'rnc') {
              if (data.change?.enabled !== request.enabled || !activeConfig) { fail(new Error('实时RNC开关回执与请求不一致')); return; }
              activeConfig.rncEnabled = data.change.enabled;
              activeConfigIdentity = configIdentity(activeConfig);
            }
            pending.delete(data.id);
            if (data.type === 'field' && data.frame?.layoutId !== activeLayoutId) request.reject(new Error('声场物理布局身份与当前实验不一致，已拒绝显示'));
            else request.resolve(data.type === 'field' ? data.frame : data.type === 'rnc' ? data.change : data.packet);
          }
        } else if (data.type === 'error') {
          const error = new Error(data.message);
          // Rejected read/control requests do not corrupt the processor; failed processing does.
          const request = pending.get(data.id);
          if (request?.kind === 'field' || request?.kind === 'rnc') { pending.delete(data.id); request.reject(error); }
          else fail(error);
        }
      };
      active.onerror = event => fail(new Error(event.message || '计算线程停止'));
      try { active.postMessage({ type: kind === 'live' ? 'live-start' : 'calculate', config: startedConfig, runId: id }); }
      catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
    });
  }
  function request<T>(kind: 'field' | 'chunk' | 'rnc', payload: object): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!worker || rejectStart) { reject(new Error('请先启动实验')); return; }
      if (kind !== 'field' && mode !== 'live') { reject(new Error('当前不是实时实验')); return; }
      const id = ++requestId;
      pending.set(id, { kind, ...(kind === 'rnc' ? { enabled: (payload as { enabled: boolean }).enabled } : {}), resolve: value => resolve(value as T), reject });
      try { worker.postMessage({ type: kind, id, ...payload }); }
      catch (error) { pending.delete(id); reject(error); }
    });
  }
  return {
    cancel,
    calculate: (config: LabConfig, id: string) => start<LabResult>(config, id, 'batch'),
    startLive: (config: LabConfig, id: string) => start<void>(config, id, 'live'),
    pullLive: (sampleCount = 200) => request<LabLivePacket>('chunk', { sampleCount }),
    setLiveRnc: (enabled: boolean) => request<LabRncChange>('rnc', { enabled }),
    field: (time: number, points: Vec3[], weighting: AcousticWeighting = 'Z') => request<FieldFrame>('field', { time, points, weighting }),
  };
}
