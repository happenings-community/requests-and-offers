import { Data } from 'effect';

/**
 * Centralized error type for the Holochain Client domain
 * Handles all Holochain connection, zome call, and validation errors with unified approach
 */
export class HolochainClientError extends Data.TaggedError('HolochainClientError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly operation?: string;
  readonly zomeName?: string;
  readonly fnName?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    operation?: string,
    zomeName?: string,
    fnName?: string
  ): HolochainClientError {
    if (error instanceof HolochainClientError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new HolochainClientError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      operation,
      zomeName,
      fnName
    });
  }

  static create(
    message: string,
    context?: string,
    operation?: string,
    zomeName?: string,
    fnName?: string
  ): HolochainClientError {
    return new HolochainClientError({
      message,
      context,
      operation,
      zomeName,
      fnName
    });
  }
}

/**
 * Legacy error types for backward compatibility
 * @deprecated Use HolochainClientError with appropriate context from error-contexts.ts
 */
export class ConnectionError extends HolochainClientError {}
export class ZomeCallError extends HolochainClientError {}
export class SchemaDecodeError extends HolochainClientError {}

// Legacy exports for backward compatibility
export { HolochainClientError as HolochainError };
