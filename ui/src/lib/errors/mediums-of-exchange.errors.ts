import { Data } from 'effect';

/**
 * Centralized error type for the Mediums of Exchange domain
 * Replaces MediumOfExchangeError, MediumOfExchangeStoreError, and MediumsOfExchangeManagementError with a single unified approach
 */
export class MediumOfExchangeError extends Data.TaggedError('MediumOfExchangeError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly mediumOfExchangeId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    mediumOfExchangeId?: string,
    operation?: string
  ): MediumOfExchangeError {
    if (error instanceof MediumOfExchangeError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new MediumOfExchangeError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      mediumOfExchangeId,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    mediumOfExchangeId?: string,
    operation?: string
  ): MediumOfExchangeError {
    return new MediumOfExchangeError({
      message,
      context,
      mediumOfExchangeId,
      operation
    });
  }
}

/**
 * Legacy store error class for backward compatibility
 * @deprecated Use MediumOfExchangeError with appropriate context from error-contexts.ts
 */
export class MediumOfExchangeStoreError extends MediumOfExchangeError {}

/**
 * Legacy management error class for backward compatibility
 * @deprecated Use MediumOfExchangeError with appropriate context from error-contexts.ts
 */
export class MediumsOfExchangeManagementError extends MediumOfExchangeError {}

// Legacy exports for backward compatibility
export { MediumOfExchangeError as MediumOfExchangeServiceError };
