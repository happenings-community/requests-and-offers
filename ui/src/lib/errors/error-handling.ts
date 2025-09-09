import { Effect as E, pipe, Schedule } from 'effect';
import { Data } from 'effect';

/**
 * Base application error that all domain errors should extend
 */
export class ApplicationError extends Data.TaggedError('ApplicationError')<{
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
}> {
  static create(
    message: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ): ApplicationError {
    return new ApplicationError({ message, cause, context });
  }
}

/**
 * Error handling patterns and utilities
 */
export const ErrorHandling = {
  /**
   * Wraps an Effect with standardized error logging
   */
  withLogging: <A, E, R>(effect: E.Effect<A, E, R>, context?: string) =>
    pipe(
      effect,
      E.tapError((error) =>
        E.sync(() => {
          console.error(`[${context || 'Unknown'}] Error:`, {
            tag:
              typeof error === 'object' && error !== null && '_tag' in error
                ? error._tag
                : 'Unknown',
            message:
              typeof error === 'object' && error !== null && 'message' in error
                ? error.message
                : 'Unknown error',
            cause:
              typeof error === 'object' && error !== null && 'cause' in error
                ? error.cause
                : undefined
          });
        })
      )
    ),

  /**
   * Converts unknown errors to typed application errors
   */
  fromUnknown: (error: unknown, context: string): ApplicationError => {
    if (error instanceof Error) {
      return ApplicationError.create(`${context}: ${error.message}`, error);
    }
    return ApplicationError.create(`${context}: ${String(error)}`, error);
  },

  /**
   * Wraps async operations with proper error handling
   */
  wrapAsync: <T>(asyncFn: () => Promise<T>, context: string): E.Effect<T, ApplicationError> =>
    E.tryPromise({
      try: asyncFn,
      catch: (error) => ErrorHandling.fromUnknown(error, context)
    }),

  /**
   * Combines multiple errors into a single error with context
   */
  combineErrors: (errors: unknown[], context: string): ApplicationError => {
    const messages = errors.map((error) =>
      typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : typeof error === 'object' && error !== null && '_tag' in error
          ? error._tag
          : String(error)
    );
    return ApplicationError.create(
      `${context}: Multiple errors occurred: ${messages.join(', ')}`,
      errors
    );
  },

  /**
   * Retries an Effect with exponential backoff and jitter
   */
  withRetry: <A, E, R>(
    effect: E.Effect<A, E, R>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ) => {
    const retryPolicy = pipe(
      Schedule.exponential(`${baseDelayMs} millis`),
      Schedule.intersect(Schedule.recurs(maxRetries)),
      Schedule.jittered
    );

    return E.retry(effect, retryPolicy);
  },

  /**
   * Simple retry with fixed delay (for backward compatibility)
   */
  withSimpleRetry: <A, E, R>(effect: E.Effect<A, E, R>, maxRetries: number = 3) => {
    const retryEffect = (attempt: number): E.Effect<A, E, R> => {
      if (attempt >= maxRetries) {
        return effect;
      }
      return pipe(
        effect,
        E.catchAll(() => retryEffect(attempt + 1))
      );
    };
    return retryEffect(0);
  },

  /**
   * Retries with custom schedule policy
   */
  withCustomRetry: <A, E, R>(
    effect: E.Effect<A, E, R>,
    schedule: Schedule.Schedule<any, any, any>
  ) => pipe(effect, E.retry(schedule)),

  /**
   * Timeout an Effect with a custom error
   */
  withTimeout: <A, E, R>(
    effect: E.Effect<A, E, R>,
    timeoutMs: number,
    timeoutError?: ApplicationError
  ) =>
    pipe(
      effect,
      E.timeout(`${timeoutMs} millis`),
      E.mapError(
        (error) =>
          timeoutError || ApplicationError.create(`Operation timed out after ${timeoutMs}ms`, error)
      )
    )
};

/**
 * Error recovery patterns
 */
export const ErrorRecovery = {
  /**
   * Provides fallback values for failed operations
   */
  withFallback: <A, E, R>(effect: E.Effect<A, E, R>, fallback: A) =>
    pipe(
      effect,
      E.catchAll(() => E.succeed(fallback))
    ),

  /**
   * Provides fallback Effect for failed operations
   */
  withFallbackEffect: <A, E, R>(effect: E.Effect<A, E, R>, fallbackEffect: E.Effect<A, never, R>) =>
    pipe(
      effect,
      E.catchAll(() => fallbackEffect)
    ),

  /**
   * Converts errors to optional values (None for errors, Some for success)
   */
  toOption: <A, E, R>(effect: E.Effect<A, E, R>) =>
    pipe(
      effect,
      E.map((value) => ({ _tag: 'Some' as const, value })),
      E.catchAll(() => E.succeed({ _tag: 'None' as const }))
    )
};

/**
 * UI-specific error handling utilities
 */
export const UIErrorHandling = {
  /**
   * Formats errors for user display
   */
  formatForUser: (error: unknown): string => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    // Fallback to tag-based messages
    if (typeof error === 'object' && error !== null && '_tag' in error) {
      switch (error._tag) {
        case 'ConnectionError':
          return 'Unable to connect to the network. Please check your connection.';
        case 'ZomeCallError':
          return 'A network error occurred. Please try again.';
        case 'SchemaDecodeError':
          return 'Invalid data received. Please refresh and try again.';
        default:
          return 'An unexpected error occurred. Please try again.';
      }
    }

    return 'An unexpected error occurred. Please try again.';
  },

  /**
   * Determines if an error should be shown to the user
   */
  shouldDisplayToUser: (error: unknown): boolean => {
    // Hide internal errors, show user-facing errors
    const internalErrors = ['SchemaDecodeError', 'CacheValidationError'];
    return typeof error === 'object' && error !== null && '_tag' in error
      ? !internalErrors.includes((error as { _tag: string })._tag)
      : true;
  }
};
