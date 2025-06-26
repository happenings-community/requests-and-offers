import { Data } from 'effect';

/**
 * Centralized error types for the Requests domain
 * Following the Service Types error patterns for consistency
 */

// Service-level error
export class RequestError extends Data.TaggedError('RequestError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): RequestError {
    if (error instanceof Error) {
      return new RequestError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new RequestError({
      message: String(error),
      context,
      cause: error
    });
  }
}

// Store-level error
export class RequestStoreError extends Data.TaggedError('RequestStoreError')<{
  message: string;
  context?: string;
  cause?: unknown;
  requestId?: string;
}> {
  static fromError(error: unknown, context: string, requestId?: string): RequestStoreError {
    if (error instanceof Error) {
      return new RequestStoreError({
        message: error.message,
        context,
        cause: error,
        requestId
      });
    }
    return new RequestStoreError({
      message: String(error),
      context,
      cause: error,
      requestId
    });
  }

  static fromRequestError(
    error: RequestError,
    context: string,
    requestId?: string
  ): RequestStoreError {
    return new RequestStoreError({
      message: error.message,
      context: `${context} (Service Error: ${error.context || 'unknown'})`,
      cause: error,
      requestId
    });
  }
}

// Composable-level error
export class RequestsManagementError extends Data.TaggedError('RequestsManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
  operation?: 'create' | 'update' | 'delete' | 'load' | 'filter';
}> {
  static fromError(
    error: unknown,
    context: string,
    operation?: 'create' | 'update' | 'delete' | 'load' | 'filter'
  ): RequestsManagementError {
    if (error instanceof Error) {
      return new RequestsManagementError({
        message: error.message,
        context,
        cause: error,
        operation
      });
    }
    return new RequestsManagementError({
      message: String(error),
      context,
      cause: error,
      operation
    });
  }

  static fromRequestStoreError(
    error: RequestStoreError,
    context: string,
    operation?: 'create' | 'update' | 'delete' | 'load' | 'filter'
  ): RequestsManagementError {
    return new RequestsManagementError({
      message: error.message,
      context: `${context} (Store Error: ${error.context || 'unknown'})`,
      cause: error,
      operation
    });
  }
}
