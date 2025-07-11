import { Effect as E, pipe } from 'effect';

/**
 * Runs an Effect and returns a promise, logging any unexpected errors.
 * @param effect - The Effect to run.
 * @returns A promise that resolves with the success value of the Effect.
 */
export const runEffect = <A, E>(effect: E.Effect<A, E>): Promise<A> =>
  E.runPromise(effect).catch((error) => {
    console.error('Unhandled Effect error:', error);
    // Re-throw the error to allow for further handling by the caller if needed
    throw error;
  });

/**
 * Wraps a Promise in an Effect for consistent error handling in composables
 * @param promiseFn Function that returns a Promise
 * @param errorContext Context for error reporting
 * @returns Effect that represents the Promise
 */
export function wrapPromise<T>(
  promiseFn: () => Promise<T>,
  errorContext = 'Promise operation'
): E.Effect<T, Error> {
  return E.tryPromise({
    try: promiseFn,
    catch: (error) => {
      if (error instanceof Error) {
        return new Error(`${errorContext}: ${error.message}`);
      }
      return new Error(`${errorContext}: ${String(error)}`);
    }
  });
}

/**
 * Creates an Effect that updates state and notifies listeners
 * Used in composables for consistent state management
 */
export function createStateUpdater<T>(
  updater: () => void,
  onStateChange?: (state: T) => void,
  state?: T
): E.Effect<void, never> {
  return pipe(
    E.sync(updater),
    E.tap(() => {
      if (onStateChange && state) {
        return E.sync(() => onStateChange(state));
      }
      return E.void;
    })
  );
}
