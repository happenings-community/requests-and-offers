import { Effect as E, pipe } from 'effect';
import type {
  LoadingStateSetter,
  OperationWrapper,
  ErrorHandler,
  ErrorFactory,
  ErrorContext
} from '$lib/types/store-helpers.js';

// ============================================================================
// LOADING STATE MANAGEMENT
// ============================================================================

/**
 * Higher-order function to wrap operations with loading state management
 *
 * @example
 * ```typescript
 * const fetchData = withLoadingState(() =>
 *   pipe(
 *     service.getData(),
 *     E.map(data => {
 *       entities.splice(0, entities.length, ...data);
 *       return data;
 *     })
 *   )
 * );
 *
 * // Usage
 * fetchData(setLoading, setError);
 * ```
 */
export const withLoadingState: OperationWrapper =
  <T, E>(operation: () => E.Effect<T, E>) =>
  (setters: LoadingStateSetter) =>
    pipe(
      E.sync(() => {
        setters.setLoading(true);
        setters.setError(null);
      }),
      E.flatMap(() => operation()),
      E.tap(() => E.sync(() => setters.setLoading(false))),
      E.tapError((error) =>
        E.sync(() => {
          setters.setLoading(false);
          setters.setError(error instanceof Error ? error.message : String(error));
        })
      )
    );

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Creates a standardized error handler for specific contexts
 *
 * @param errorFactory Factory function to create domain-specific errors
 * @param context The context string for the error
 * @returns A function that creates an error handler for the given context
 *
 * @example
 * ```typescript
 * const handleFetchError = createErrorHandler(
 *   ServiceError.fromError,
 *   'Failed to fetch entities'
 * );
 *
 * // Usage in Effect chain
 * pipe(
 *   service.getData(),
 *   E.catchAll(handleFetchError)
 * )
 * ```
 */
export const createErrorHandler =
  <TError>(
    errorFactory: ErrorFactory<TError>['fromError'],
    context: ErrorContext
  ): ErrorHandler<TError> =>
  (error: unknown) =>
    E.fail(errorFactory(error, context));

/**
 * Creates a generic error handler that returns string errors
 * Useful for simple error handling scenarios
 */
export const createGenericErrorHandler =
  (context: ErrorContext): ErrorHandler<string> =>
  (error: unknown) =>
    E.fail(`${context}: ${error instanceof Error ? error.message : String(error)}`);

// ============================================================================
// STATE SETTERS FACTORY
// ============================================================================

/**
 * Creates standardized state setters for loading and error states
 *
 * @param loadingState Reactive loading state variable
 * @param errorState Reactive error state variable
 * @returns LoadingStateSetter interface
 *
 * @example
 * ```typescript
 * let loading = $state(false);
 * let error = $state<string | null>(null);
 *
 * const setters = createLoadingStateSetter(loading, errorState);
 * ```
 */
export const createLoadingStateSetter = (
  loadingState: { value: boolean } | (() => boolean),
  errorState: { value: string | null } | (() => string | null)
): LoadingStateSetter => {
  // Handle both reactive variables and getter functions
  const setLoading = (loading: boolean) => {
    if (typeof loadingState === 'function') {
      // For $state variables, we need a different approach
      // This will be updated when implementing in stores
      console.warn('Direct setter not available for reactive loading state');
    } else {
      loadingState.value = loading;
    }
  };

  const setError = (error: string | null) => {
    if (typeof errorState === 'function') {
      console.warn('Direct setter not available for reactive error state');
    } else {
      errorState.value = error;
    }
  };

  return { setLoading, setError };
};

// ============================================================================
// CACHE INVALIDATION
// ============================================================================

/**
 * Creates a standardized cache invalidation function
 *
 * @param cache The cache service to invalidate
 * @param stateArrays Arrays of state to clear
 * @param setters Loading state setters
 * @returns Cache invalidation function
 *
 * @example
 * ```typescript
 * const invalidateCache = createCacheInvalidator(
 *   cache,
 *   [entities, pendingEntities, approvedEntities],
 *   setters
 * );
 * ```
 */
export const createCacheInvalidator = <TEntity>(
  cache: { clear: () => E.Effect<void, never> },
  stateArrays: TEntity[][],
  setters: LoadingStateSetter
) => {
  return (): void => {
    E.runSync(cache.clear());
    stateArrays.forEach((array) => {
      array.length = 0;
    });
    setters.setError(null);
  };
};

// ============================================================================
// HOLOCHAIN CLIENT CONNECTION HELPER
// ============================================================================

/**
 * Creates a helper to handle client connection errors gracefully
 *
 * @param fallbackValue Value to return when client is not connected
 * @returns Effect that handles connection errors
 */
export const withClientConnectionFallback =
  <T>(fallbackValue: T) =>
  (error: unknown): E.Effect<T, never> => {
    const errorMessage = String(error);
    if (errorMessage.includes('Client not connected')) {
      console.warn('Holochain client not connected, returning fallback value');
      return E.succeed(fallbackValue);
    }
    return E.succeed(fallbackValue);
  };

// ============================================================================
// OPERATION UTILITIES
// ============================================================================

/**
 * Creates a safe operation executor that handles common error patterns
 *
 * @param operation The operation to execute
 * @param setters Loading state setters
 * @param fallbackValue Value to return on certain errors
 * @returns Safe operation with error handling
 */
export const createSafeOperation = <T, E>(
  operation: () => E.Effect<T, E>,
  setters: LoadingStateSetter,
  fallbackValue?: T
) =>
  withLoadingState(() =>
    pipe(
      operation(),
      E.catchAll((error) => {
        if (fallbackValue !== undefined) {
          return withClientConnectionFallback(fallbackValue)(error);
        }
        return E.fail(error);
      })
    )
  )(setters);

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Creates a validation helper for required fields
 *
 * @param fieldName Name of the field being validated
 * @param errorFactory Factory to create domain-specific errors
 * @returns Validation function
 */
export const createRequiredFieldValidator =
  <TError>(fieldName: string, errorFactory: ErrorFactory<TError>['fromError']) =>
  <T>(value: T | null | undefined): E.Effect<T, TError> => {
    if (value == null) {
      return E.fail(
        errorFactory(new Error(`${fieldName} is required`), `Validation failed for ${fieldName}`)
      );
    }
    return E.succeed(value);
  };

/**
 * Creates a hash validator for ActionHash fields
 *
 * @param entityName Name of the entity for error messages
 * @param errorFactory Factory to create domain-specific errors
 * @returns Hash validation function
 */
export const createHashValidator =
  <TEntity, TError>(entityName: string, errorFactory: ErrorFactory<TError>['fromError']) =>
  (entity: TEntity & { original_action_hash?: unknown }): E.Effect<string, TError> => {
    const hash = entity.original_action_hash?.toString();
    if (!hash) {
      return E.fail(
        errorFactory(
          new Error(`${entityName} has no original_action_hash`),
          `Hash validation failed for ${entityName}`
        )
      );
    }
    return E.succeed(hash);
  };
