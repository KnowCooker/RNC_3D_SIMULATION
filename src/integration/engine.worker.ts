import { calculateSync } from '../team-b';
import type { RunConfig } from '../shared/contracts';

onmessage = (event: MessageEvent<{ config: RunConfig; runId: string }>) => {
  const { config, runId } = event.data;
  try {
    const result = calculateSync(config, runId);
    const transfers = Object.values(result.signals).flat().map(s => s.buffer);
    postMessage({ result }, { transfer: transfers });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    postMessage({ error: { code: e.code ?? 'NUMERIC_FAILURE', message: e.message ?? String(error), runId } });
  }
};
