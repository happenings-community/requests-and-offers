import { Data } from 'effect';

/**
 * Centralized error type for the Service Types domain
 * Replaces ServiceTypeError, ServiceTypeStoreError, and ServiceTypesManagementError with a single unified approach
 */
export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly serviceTypeId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    serviceTypeId?: string,
    operation?: string
  ): ServiceTypeError {
    if (error instanceof ServiceTypeError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new ServiceTypeError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      serviceTypeId,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    serviceTypeId?: string,
    operation?: string
  ): ServiceTypeError {
    return new ServiceTypeError({
      message,
      context,
      serviceTypeId,
      operation
    });
  }
}

/**
 * Legacy store error class for backward compatibility
 * @deprecated Use ServiceTypeError with appropriate context from error-contexts.ts
 */
export class ServiceTypeStoreError extends ServiceTypeError {}

/**
 * Legacy management error class for backward compatibility
 * @deprecated Use ServiceTypeError with appropriate context from error-contexts.ts
 */
export class ServiceTypesManagementError extends ServiceTypeError {}

// Legacy exports for backward compatibility
export { ServiceTypeError as ServiceTypeServiceError };
