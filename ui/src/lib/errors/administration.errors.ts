import { Data } from 'effect';

/**
 * Centralized error type for the Administration domain
 * Replaces AdministrationError, AdministrationStoreError, and AdministrationsManagementError with a single unified approach
 */
export class AdministrationError extends Data.TaggedError('AdministrationError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly entityType?: string;
  readonly entityHash?: string;
  readonly agentPubKey?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    entityType?: string,
    entityHash?: string,
    agentPubKey?: string,
    operation?: string
  ): AdministrationError {
    if (error instanceof AdministrationError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new AdministrationError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      entityType,
      entityHash,
      agentPubKey,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    entityType?: string,
    entityHash?: string,
    agentPubKey?: string,
    operation?: string
  ): AdministrationError {
    return new AdministrationError({
      message,
      context,
      entityType,
      entityHash,
      agentPubKey,
      operation
    });
  }
}

/**
 * Legacy store error class for backward compatibility
 * @deprecated Use AdministrationError with appropriate context from error-contexts.ts
 */
export class AdministrationStoreError extends AdministrationError {}

/**
 * Legacy management error class for backward compatibility
 * @deprecated Use AdministrationError with appropriate context from error-contexts.ts
 */
export class AdministrationsManagementError extends AdministrationError {}

// Legacy exports for backward compatibility
export { AdministrationError as AdministrationServiceError };
