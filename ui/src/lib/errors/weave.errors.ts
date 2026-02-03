import { Data } from 'effect';

/**
 * Error type for Weave/Moss domain
 * Handles errors from Weave context detection, connection, profile fetching, and avatar conversion
 */
export class WeaveError extends Data.TaggedError('WeaveError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly agentPubKey?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    agentPubKey?: string,
    operation?: string
  ): WeaveError {
    if (error instanceof WeaveError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new WeaveError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      agentPubKey,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    agentPubKey?: string,
    operation?: string
  ): WeaveError {
    return new WeaveError({
      message,
      context,
      agentPubKey,
      operation
    });
  }
}
