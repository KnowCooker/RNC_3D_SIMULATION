export type ExportErrorCode = 'INVALID_FORMAT' | 'UNSUPPORTED_VERSION' | 'INVALID_DATA' | 'SIZE_LIMIT'
  | 'INTEGRITY_MISMATCH' | 'MODEL_MISMATCH' | 'UNSUPPORTED_MODE' | 'UNSUPPORTED_LAYOUT' | 'MISSING_ASSET';
export class ExportError extends Error {
  constructor(public readonly code: ExportErrorCode, message: string) { super(message); this.name = 'ExportError'; }
}
