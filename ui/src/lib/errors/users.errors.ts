/**
 * Error types related to user operations
 */
import { Data } from 'effect';

/**
 * Base error for user-related operations
 */
export class UserError extends Data.TaggedError('UserError')<{
  message: string;
  userId?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when user profile operations fail
 */
export class UserProfileError extends Data.TaggedError('UserProfileError')<{
  message: string;
  userId?: string;
  operation?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when user authentication fails
 */
export class UserAuthenticationError extends Data.TaggedError('UserAuthenticationError')<{
  message: string;
  cause?: unknown;
}> {}
