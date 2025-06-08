/**
 * Error types related to cache operations
 */
import { Data } from 'effect';

/**
 * Error thrown when a requested item is not found in the cache
 */
export class CacheNotFoundError extends Data.TaggedError('CacheNotFoundError')<{
  message: string;
  key: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when cache validation fails
 */
export class CacheValidationError extends Data.TaggedError('CacheValidationError')<{
  message: string;
  key?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when cache operations fail
 */
export class CacheOperationError extends Data.TaggedError('CacheOperationError')<{
  message: string;
  operation: 'get' | 'set' | 'delete' | 'clear' | 'update';
  key?: string;
  cause?: unknown;
}> {}
