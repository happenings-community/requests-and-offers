import type { Effect } from '@effect/io/Effect';
import * as E from '@effect/io/Effect';

/**
 * Creates an Effect that succeeds with the given value
 */
export const mockEffectSuccess = <T>(value: T): Effect<never, never, T> => {
  return E.succeed(value);
};

/**
 * Creates an Effect that fails with the given error
 */
export const mockEffectFailure = <E>(error: E): Effect<never, E, never> => {
  return E.fail(error);
};

/**
 * Converts a Promise-returning mock function to an Effect-returning mock function
 * while preserving the original mock function for spying
 */
export const mockEffectFn = <T>(fn: () => Promise<T>): (() => Effect<never, Error, T>) => {
  const effectFn = () => {
    return E.tryPromise({
      try: fn,
      catch: (error) => (error instanceof Error ? error : new Error(String(error)))
    });
  };
  // Copy over spy properties
  Object.defineProperties(effectFn, Object.getOwnPropertyDescriptors(fn));
  return effectFn;
};

/**
 * Converts a Promise-returning mock function with parameters to an Effect-returning mock function
 * while preserving the original mock function for spying
 */
export const mockEffectFnWithParams = <P extends unknown[], T>(
  fn: (...args: P) => Promise<T>
): ((...args: P) => Effect<never, Error, T>) => {
  const effectFn = (...args: P) => {
    return E.tryPromise({
      try: () => fn(...args),
      catch: (error) => (error instanceof Error ? error : new Error(String(error)))
    });
  };
  // Copy over spy properties
  Object.defineProperties(effectFn, Object.getOwnPropertyDescriptors(fn));
  return effectFn;
};

/**
 * Runs an Effect and returns its result
 */
export const runEffect = <E, A>(effect: Effect<never, E, A>): Promise<A> => {
  return E.runPromise(effect);
};
