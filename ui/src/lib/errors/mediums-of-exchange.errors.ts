import { Data } from 'effect';

// Medium of Exchange Error Types
export class MediumOfExchangeError extends Data.TaggedError('MediumOfExchangeError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;
}> {
  static fromError(error: unknown, message: string, context?: Record<string, unknown>) {
    return new MediumOfExchangeError({
      message,
      cause: error,
      context
    });
  }

  static validationError(message: string, field?: string) {
    return new MediumOfExchangeError({
      message,
      context: { type: 'validation', field }
    });
  }

  static notFound(mediumOfExchangeId?: string) {
    return new MediumOfExchangeError({
      message: 'Medium of exchange not found',
      context: { type: 'not_found', mediumOfExchangeId }
    });
  }

  static unauthorized(operation?: string) {
    return new MediumOfExchangeError({
      message: 'Unauthorized operation',
      context: { type: 'unauthorized', operation }
    });
  }

  static networkError(operation?: string) {
    return new MediumOfExchangeError({
      message: 'Network error occurred',
      context: { type: 'network', operation }
    });
  }

  static createError(details?: string) {
    return new MediumOfExchangeError({
      message: `Failed to create medium of exchange${details ? `: ${details}` : ''}`,
      context: { type: 'create' }
    });
  }

  static updateError(details?: string) {
    return new MediumOfExchangeError({
      message: `Failed to update medium of exchange${details ? `: ${details}` : ''}`,
      context: { type: 'update' }
    });
  }

  static approvalError(details?: string) {
    return new MediumOfExchangeError({
      message: `Failed to approve medium of exchange${details ? `: ${details}` : ''}`,
      context: { type: 'approval' }
    });
  }

  static rejectionError(details?: string) {
    return new MediumOfExchangeError({
      message: `Failed to reject medium of exchange${details ? `: ${details}` : ''}`,
      context: { type: 'rejection' }
    });
  }
}
