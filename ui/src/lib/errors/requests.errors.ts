import { Data } from 'effect';

/**
 * Centralized error type for the Requests domain
 * Replaces RequestError, RequestStoreError, and RequestsManagementError with a single unified approach
 */
export class RequestError extends Data.TaggedError('RequestError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly requestId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    requestId?: string,
    operation?: string
  ): RequestError {
    if (error instanceof RequestError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new RequestError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      requestId,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    requestId?: string,
    operation?: string
  ): RequestError {
    return new RequestError({
      message,
      context,
      requestId,
      operation
    });
  }
}

/**
 * Legacy store error class for backward compatibility
 * @deprecated Use RequestError with appropriate context from error-contexts.ts
 */
export class RequestStoreError extends RequestError {}

/**
 * Legacy management error class for backward compatibility
 * @deprecated Use RequestError with appropriate context from error-contexts.ts
 */
export class RequestsManagementError extends RequestError {}

// Legacy exports for backward compatibility
export { RequestError as RequestServiceError };
