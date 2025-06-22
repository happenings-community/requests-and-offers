import { Data } from 'effect';

/**
 * Error types for cache operations
 */
export class CacheNotFoundError extends Data.TaggedError('CacheNotFoundError')<{
  readonly key: string;
}> {}

export class CacheValidationError extends Data.TaggedError('CacheValidationError')<{
  readonly key: string;
  readonly reason: string;
}> {}
