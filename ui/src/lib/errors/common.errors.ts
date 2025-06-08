/**
 * Common error types used across the application
 */
import { Data } from 'effect';

/**
 * Error related to navigation operations
 */
export class NavigationError extends Data.TaggedError('NavigationError')<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Error related to network operations
 */
export class NetworkError extends Data.TaggedError('NetworkError')<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Error related to client connection
 */
export class ClientConnectionError extends Data.TaggedError('ClientConnectionError')<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Error related to data validation
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  message: string;
  field?: string;
  cause?: unknown;
}> {}

/**
 * Error related to unauthorized actions
 */
export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Error related to not found resources
 */
export class NotFoundError extends Data.TaggedError('NotFoundError')<{
  message: string;
  resourceType?: string;
  resourceId?: string;
  cause?: unknown;
}> {}

/**
 * Error related to unexpected application behavior
 */
export class ApplicationError extends Data.TaggedError('ApplicationError')<{
  message: string;
  cause?: unknown;
}> {}
