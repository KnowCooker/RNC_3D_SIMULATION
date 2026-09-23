import type { FieldFrame, LabConfig, LabResult, Vec3 } from '../shared/lab-contracts';
export function createLabEngine() {
  let worker: Worker | null = null;
  let rejectCalculation: ((e: Error) => void) | null = null;
  let requestId = 0;
  const fields = new Map<number, { resolve: (f: FieldFrame) => void; reject: (e: Error) => void }>();
  function cancel() {
    worker?.terminate(); worker = null;
    rejectCalculation?.(new Error('计算已取消')); rejectCalculation = null;
    fields.forEach(p => p.reject(new Error('实验已更换'))); fields.clear();
  }
  return {
    cancel,
    calculate(config: LabConfig, runId: string) {
      cancel();
      return new Promise<LabResult>((resolve, reject) => {
        rejectCalculation = reject;
        const active = new Worker(new URL('./lab.worker.ts', import.meta.url), { type: 'module' }); worker = active;
        active.onmessage = ({ data }) => {
          if (worker !== active) return;
          if (data.type === 'result') { rejectCalculation = null; resolve(data.result); }
          if (data.type === 'field') { fields.get(data.id)?.resolve(data.frame); fields.delete(data.id); }
          if (data.type === 'error') {
            if (data.id !== undefined) { fields.get(data.id)?.reject(new Error(data.message)); fields.delete(data.id); }
            else { rejectCalculation = null; reject(new Error(data.message)); active.terminate(); worker = null; fields.forEach(p => p.reject(new Error(data.message))); fields.clear(); }
          }
        };
        active.onerror = event => {
          if (worker !== active) return;
          const error = new Error(event.message); rejectCalculation = null; reject(error);
          active.terminate(); worker = null; fields.forEach(p => p.reject(error)); fields.clear();
        };
        active.postMessage({ type: 'calculate', config, runId });
      });
    },
    field(time: number, points: Vec3[]) {
      return new Promise<FieldFrame>((resolve, reject) => {
        if (!worker) { reject(new Error('请先计算实验')); return; }
        const id = ++requestId; fields.set(id, { resolve, reject }); worker.postMessage({ type: 'field', id, time, points });
      });
    },
  };
}
