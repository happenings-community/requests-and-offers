import { Data } from 'effect';

/**
 * Centralized error type for the Users domain
 * Replaces UserError, UserStoreError, and UsersManagementError with a single unified approach
 */
export class UserError extends Data.TaggedError('UserError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly userId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    userId?: string,
    operation?: string
  ): UserError {
    if (error instanceof UserError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new UserError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      userId,
      operation
    });
  }

  static create(message: string, context?: string, userId?: string, operation?: string): UserError {
    return new UserError({
      message,
      context,
      userId,
      operation
    });
  }
}

/**
 * Legacy store error class for backward compatibility
 * @deprecated Use UserError with appropriate context from error-contexts.ts
 */
export class UserStoreError extends UserError {}

/**
 * Legacy management error class for backward compatibility
 * @deprecated Use UserError with appropriate context from error-contexts.ts
 */
export class UsersManagementError extends UserError {}

// Legacy exports for backward compatibility
export { UserError as UserServiceError };
