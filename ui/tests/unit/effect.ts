import { Effect } from 'effect';

/**
 * Creates an Effect that succeeds with the given value
 */
export const mockEffectSuccess = <T>(value: T): Effect.Effect<T> => {
  return Effect.succeed(value);
};

/**
 * Creates an Effect that fails with the given error
 */
export const mockEffectFailure = <E>(error: E): Effect.Effect<never, E> => {
  return Effect.fail(error);
};

/**
 * Converts a Promise-returning mock function to an Effect-returning mock function
 * while preserving the original mock function for spying
 *
 * Creates an Effect with type parameters aligned with service expectations
 */
export const mockEffectFn = <T, ErrorType = Error>(
  fn: () => Promise<T>
): (() => Effect.Effect<T, ErrorType>) => {
  const effectFn = () => {
    return Effect.tryPromise({
      try: fn,
      catch: (error) => (error instanceof Error ? error : new Error(String(error)))
    }) as Effect.Effect<T, ErrorType>;
  };
  // Copy over spy properties
  Object.defineProperties(effectFn, Object.getOwnPropertyDescriptors(fn));
  return effectFn;
};

/**
 * Converts a Promise-returning mock function with parameters to an Effect-returning mock function
 * while preserving the original mock function for spying
 */
export const mockEffectFnWithParams = <P extends unknown[], T, ErrorType = Error>(
  fn: (...args: P) => Promise<T>
): ((...args: P) => Effect.Effect<T, ErrorType>) => {
  const effectFn = (...args: P) => {
    return Effect.tryPromise({
      try: () => fn(...args),
      catch: (error) => (error instanceof Error ? error : new Error(String(error)))
    }) as Effect.Effect<T, ErrorType>;
  };
  // Copy over spy properties
  Object.defineProperties(effectFn, Object.getOwnPropertyDescriptors(fn));
  return effectFn;
};
