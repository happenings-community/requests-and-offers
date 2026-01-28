import { Data } from 'effect';

/**
 * Error type for ProfileDisplay domain
 * Handles errors from fetching/merging Moss and R&O profile data
 */
export class ProfileDisplayError extends Data.TaggedError('ProfileDisplayError')<{
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
  ): ProfileDisplayError {
    if (error instanceof ProfileDisplayError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new ProfileDisplayError({
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
  ): ProfileDisplayError {
    return new ProfileDisplayError({
      message,
      context,
      agentPubKey,
      operation
    });
  }
}
