import type { DemoEngine, DemoError, RunResult } from '../shared/contracts';
import { analyzeAt } from '../team-b/analysis';

export function createBrowserEngine(): DemoEngine & { cancel(): void } {
  let worker: Worker | null = null, rejectPending: ((e: DemoError) => void) | null = null, activeId = '';
  return {
    analyzeAt,
    calculate(config, runId) {
      if (worker) return Promise.reject({ code: 'BUSY', message: '已有计算正在运行', runId });
      activeId = runId;
      return new Promise<RunResult>((resolve, reject) => {
        rejectPending = reject;
        worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
        const finish = () => { worker?.terminate(); worker = null; rejectPending = null; };
        worker.onmessage = ({ data }) => { finish(); data.error ? reject(data.error) : resolve(data.result); };
        worker.onerror = (event) => { finish(); reject({ code: 'NUMERIC_FAILURE', message: event.message, runId }); };
        worker.postMessage({ config, runId });
      });
    },
    cancel() {
      worker?.terminate(); worker = null;
      rejectPending?.({ code: 'CANCELLED', message: '计算已取消', runId: activeId }); rejectPending = null;
    },
  };
}
