export type SmartRelatedErrorCode = 'BAD_REQUEST' | 'UPSTREAM_ERROR' | 'TIMEOUT' | 'NOT_FOUND' | 'INTERNAL';

export class SmartRelatedError extends Error {
  constructor(
    public readonly code: SmartRelatedErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SmartRelatedError';
  }
}
