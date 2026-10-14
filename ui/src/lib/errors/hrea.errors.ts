import { Data } from 'effect';

/**
 * Centralized error types for the hREA domain
 */

// Service-level error
export class HreaError extends Data.TaggedError('HreaError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): HreaError {
    if (error instanceof Error) {
      return new HreaError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new HreaError({
      message: String(error),
      context,
      cause: error
    });
  }
}
