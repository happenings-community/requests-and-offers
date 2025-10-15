import { Effect as E, pipe, Schedule } from 'effect';
import { Data } from 'effect';

/**
 * Base application error that all domain errors should extend
 */
export class ApplicationError extends Data.TaggedError('ApplicationError')<{
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
  timestamp: number;
  domain?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}> {
  static create(
    message: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ): ApplicationError {
    return new ApplicationError({
      message,
      cause,
      context,
      timestamp: Date.now()
    });
  }

  static withDomain(
    message: string,
    domain: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ): ApplicationError {
    return new ApplicationError({
      message,
      cause,
      context,
      domain,
      timestamp: Date.now()
    });
  }

  static withSeverity(
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    cause?: unknown,
    context?: Record<string, unknown>
  ): ApplicationError {
    return new ApplicationError({
      message,
      cause,
      context,
      severity,
      timestamp: Date.now()
    });
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
 * Holochain-specific error handling utilities
 */
export const HolochainErrorHandling = {
  /**
   * Creates a zome call error with context
   */
  createZomeError: (
    zomeName: string,
    fnName: string,
    cause: unknown,
    context?: Record<string, unknown>
  ): ApplicationError =>
    ApplicationError.withDomain(
      `Zome call failed: ${zomeName}.${fnName}`,
      zomeName,
      cause,
      {
        zomeName,
        fnName,
        ...context
      }
    ),

  /**
   * Handles connection errors with retry logic
   */
  handleConnectionError: (
    zomeName: string,
    fnName: string,
    cause: unknown
  ): ApplicationError => {
    const errorMessage = String(cause);
    const isConnectionError = errorMessage.includes('WebSocket') ||
                             errorMessage.includes('connection') ||
                             errorMessage.includes('disconnected');

    return ApplicationError.withSeverity(
      `Connection error in ${zomeName}.${fnName}: ${errorMessage}`,
      isConnectionError ? 'high' : 'medium',
      cause,
      { zomeName, fnName, isConnectionError }
    );
  },

  /**
   * Creates validation error from zome response
   */
  createValidationError: (
    zomeName: string,
    fnName: string,
    validationMessage: string,
    context?: Record<string, unknown>
  ): ApplicationError =>
    ApplicationError.withDomain(
      `Validation failed in ${zomeName}.${fnName}: ${validationMessage}`,
      zomeName,
      validationMessage,
      {
        zomeName,
        fnName,
        validationMessage,
        ...context
      }
    ),

  /**
   * Extracts zome error information from unknown error
   */
  extractZomeError: (error: unknown): {
    zomeName?: string;
    fnName?: string;
    originalError?: unknown;
  } => {
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      return {
        zomeName: err.zomeName as string,
        fnName: err.fnName as string,
        originalError: err.cause || err.originalError
      };
    }
    return {};
  }
};

/**
 * Error context management utilities
 */
export const ErrorContext = {
  /**
   * Creates a context object for error tracking
   */
  create: (
    operation: string,
    domain: string,
    additionalContext?: Record<string, unknown>
  ): Record<string, unknown> => ({
    operation,
    domain,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    ...additionalContext
  }),

  /**
   * Merges multiple error contexts
   */
  merge: (
    ...contexts: (Record<string, unknown> | undefined)[]
  ): Record<string, unknown> => {
    return contexts.reduce((merged, context) => ({
      ...merged,
      ...(context || {})
    }), {});
  },

  /**
   * Adds timing information to error context
   */
  withTiming: (
    context: Record<string, unknown>,
    operationStart: number
  ): Record<string, unknown> => ({
    ...context,
    operationDuration: Date.now() - operationStart,
    operationTimestamp: new Date(operationStart).toISOString()
  }),

  /**
   * Adds user context to error information
   */
  withUser: (
    context: Record<string, unknown>,
    userId?: string,
    sessionId?: string
  ): Record<string, unknown> => ({
    ...context,
    userId,
    sessionId,
    userAuthenticated: !!userId
  })
};

/**
 * Validation-specific error types for integrity zome validation
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  field: string;
  message: string;
  value?: unknown;
  constraint?: string;
  severity: 'error' | 'warning';
  context?: Record<string, unknown>;
}> {
  static create(
    field: string,
    message: string,
    options?: {
      value?: unknown;
      constraint?: string;
      severity?: 'error' | 'warning';
      context?: Record<string, unknown>;
    }
  ): ValidationError {
    return new ValidationError({
      field,
      message,
      value: options?.value,
      constraint: options?.constraint,
      severity: options?.severity || 'error',
      context: options?.context
    });
  }
}

export class IntegrityZomeError extends ApplicationError {
  constructor(props: {
    zomeName: string;
    validationErrors: ValidationError[];
    entryType: string;
    operation: 'create' | 'update' | 'delete';
    context?: Record<string, unknown>;
  }) {
    super({
      message: `Integrity validation failed in ${props.zomeName} for ${props.operation} of ${props.entryType}`,
      cause: props.validationErrors,
      domain: props.zomeName,
      severity: 'high',
      context: {
        ...props.context,
        zomeName: props.zomeName,
        validationErrors: props.validationErrors,
        entryType: props.entryType,
        operation: props.operation,
        errorCount: props.validationErrors.length
      }
    });
  }

  static fromValidationErrors(
    zomeName: string,
    entryType: string,
    operation: 'create' | 'update' | 'delete',
    validationErrors: ValidationError[],
    context?: Record<string, unknown>
  ): IntegrityZomeError {
    return new IntegrityZomeError({
      zomeName,
      validationErrors,
      entryType,
      operation,
      context
    });
  }
}

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

    // Handle validation errors specifically
    if (typeof error === 'object' && error !== null && '_tag' in error) {
      switch (error._tag) {
        case 'ValidationError':
          const validationError = error as ValidationError;
          return `Validation error in ${validationError.field}: ${validationError.message}`;
        case 'IntegrityZomeError':
          const integrityError = error as IntegrityZomeError;
          return integrityError.message;
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
  },

  /**
   * Formats validation errors for form display
   */
  formatValidationErrors: (errors: ValidationError[]): Record<string, string> => {
    return errors.reduce((acc, error) => {
      acc[error.field] = error.message;
      return acc;
    }, {} as Record<string, string>);
  },

  /**
   * Gets the primary error message from multiple errors
   */
  getPrimaryError: (errors: unknown[]): string => {
    if (errors.length === 0) return 'An unexpected error occurred.';

    // Prioritize validation errors
    const validationError = errors.find(e =>
      typeof e === 'object' && e !== null && '_tag' in e && e._tag === 'ValidationError'
    ) as ValidationError | undefined;

    if (validationError) {
      return validationError.message;
    }

    // Use the first error's message
    const firstError = errors[0];
    if (typeof firstError === 'object' && firstError !== null && 'message' in firstError) {
      return String(firstError.message);
    }

    return 'An unexpected error occurred.';
  }
};
