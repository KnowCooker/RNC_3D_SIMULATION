import { calculateLab, sampleField } from '../team-b/lab';
import type { LabResult } from '../shared/lab-contracts';
let result: LabResult | null = null;
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'calculate') {
      result = calculateLab(data.config, data.runId);
      self.postMessage({ type: 'result', result });
    } else if (data.type === 'field' && result) {
      self.postMessage({ type: 'field', id: data.id, runId: result.runId, frame: sampleField(result, data.time, data.points) });
    }
  } catch (error) { self.postMessage({ type: 'error', id: data.id, message: error instanceof Error ? error.message : String(error) }); }
};
