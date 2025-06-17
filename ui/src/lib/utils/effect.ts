import { Effect as E, pipe } from 'effect';

/**
 * Runs an Effect and returns the result or throws an error
 * @param effect The Effect to run
 * @returns The result of the Effect
 * @throws The error from the Effect if it fails
 */
export async function runEffect<E, A, R = unknown>(effect: E.Effect<A, E, R>): Promise<A> {
  return E.runPromise(effect as unknown as E.Effect<A, E, never>).catch((error) => {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  });
}

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
