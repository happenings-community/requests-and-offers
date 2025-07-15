import { Data } from 'effect';

/**
 * Centralized error type for the Organizations domain
 * Replaces OrganizationError, OrganizationStoreError, and OrganizationsManagementError with a single unified approach
 */
export class OrganizationError extends Data.TaggedError('OrganizationError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly organizationId?: string;
  readonly userId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    organizationId?: string,
    userId?: string,
    operation?: string
  ): OrganizationError {
    if (error instanceof OrganizationError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new OrganizationError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      organizationId,
      userId,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    organizationId?: string,
    userId?: string,
    operation?: string
  ): OrganizationError {
    return new OrganizationError({
      message,
      context,
      organizationId,
      userId,
      operation
    });
  }
}

/**
 * Legacy store error class for backward compatibility
 * @deprecated Use OrganizationError with appropriate context from error-contexts.ts
 */
export class OrganizationStoreError extends OrganizationError {}

/**
 * Legacy management error class for backward compatibility
 * @deprecated Use OrganizationError with appropriate context from error-contexts.ts
 */
export class OrganizationsManagementError extends OrganizationError {}

// Legacy exports for backward compatibility
export { OrganizationError as OrganizationServiceError };
