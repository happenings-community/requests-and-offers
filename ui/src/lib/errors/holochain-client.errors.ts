import { Data } from 'effect';

/**
 * Base error for HolochainClient service
 */
export class HolochainClientError extends Data.TaggedError('HolochainClientError')<{
  message: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): HolochainClientError {
    if (error instanceof Error) {
      return new HolochainClientError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }
    return new HolochainClientError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

/**
 * Error thrown when connection to Holochain conductor fails
 */
export class ConnectionError extends Data.TaggedError('ConnectionError')<{
  message: string;
  cause?: unknown;
}> {
  static create(message: string, cause?: unknown): ConnectionError {
    return new ConnectionError({ message, cause });
  }
}

/**
 * Error thrown when a zome call fails
 */
export class ZomeCallError extends Data.TaggedError('ZomeCallError')<{
  message: string;
  zomeName: string;
  fnName: string;
  cause?: unknown;
}> {
  static create(zomeName: string, fnName: string, cause: unknown): ZomeCallError {
    const message = cause instanceof Error ? cause.message : String(cause);
    return new ZomeCallError({
      message: `Zome call failed: ${zomeName}.${fnName} - ${message}`,
      zomeName,
      fnName,
      cause
    });
  }
}

/**
 * Error thrown when schema validation/decoding fails
 */
export class SchemaDecodeError extends Data.TaggedError('SchemaDecodeError')<{
  message: string;
  schemaName?: string;
  cause?: unknown;
}> {
  static create(message: string, schemaName?: string, cause?: unknown): SchemaDecodeError {
    return new SchemaDecodeError({
      message: schemaName ? `Schema decode error (${schemaName}): ${message}` : message,
      schemaName,
      cause
    });
  }
}

/**
 * Union type of all possible HolochainClient errors
 */
export type AnyHolochainClientError =
  | HolochainClientError
  | ConnectionError
  | ZomeCallError
  | SchemaDecodeError;
