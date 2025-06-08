/**
 * Error types related to request operations
 */
import { Data } from 'effect';

/**
 * Base error for request-related operations
 */
export class RequestError extends Data.TaggedError('RequestError')<{
  message: string;
  requestId?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when request creation fails
 */
export class RequestCreationError extends Data.TaggedError('RequestCreationError')<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when request update fails
 */
export class RequestUpdateError extends Data.TaggedError('RequestUpdateError')<{
  message: string;
  requestId: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when request deletion fails
 */
export class RequestDeletionError extends Data.TaggedError('RequestDeletionError')<{
  message: string;
  requestId: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when request loading fails
 */
export class RequestLoadError extends Data.TaggedError('RequestLoadError')<{
  message: string;
  requestId?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when request store operations fail
 */
export class RequestStoreError extends Data.TaggedError('RequestStoreError')<{
  message: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'getAll';
  requestId?: string;
  cause?: unknown;
}> {}
