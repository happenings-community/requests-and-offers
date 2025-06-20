import { Data } from 'effect';

/**
 * Service Types domain errors extending Data.TaggedError
 */

export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
}> {
  static create(
    message: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ): ServiceTypeError {
    return new ServiceTypeError({ message, cause, context });
  }

  static fromError(error: unknown, context: string): ServiceTypeError {
    if (error instanceof Error) {
      return new ServiceTypeError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }
    return new ServiceTypeError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

export class ServiceTypeStoreError extends Data.TaggedError('ServiceTypeStoreError')<{
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
}> {
  static create(
    message: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ): ServiceTypeStoreError {
    return new ServiceTypeStoreError({ message, cause, context });
  }

  static fromError(error: unknown, context: string): ServiceTypeStoreError {
    if (error instanceof Error) {
      return new ServiceTypeStoreError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }
    return new ServiceTypeStoreError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

export class ServiceTypesManagementError extends Data.TaggedError('ServiceTypesManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static create(message: string, context?: string, cause?: unknown): ServiceTypesManagementError {
    return new ServiceTypesManagementError({ message, context, cause });
  }

  static fromError(error: unknown, context: string): ServiceTypesManagementError {
    if (error instanceof Error) {
      return new ServiceTypesManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ServiceTypesManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}
