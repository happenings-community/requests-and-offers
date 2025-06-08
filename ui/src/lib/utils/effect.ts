import { Effect as E, Option as O, pipe, Exit } from 'effect';

/**
 * Base interface for TaggedError constructor arguments
 */
interface TaggedErrorArgs {
  message: string;
  cause?: unknown;
}

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
 * Creates a safe wrapper for Promise-based operations
 *
 * @param promiseFactory - Function that returns a Promise
 * @param ErrorClass - TaggedError class for failures
 * @param context - Context for errors
 * @returns An Effect wrapping the Promise
 */
export const wrapPromise = <A, T>(
  promiseFactory: () => Promise<A>,
  ErrorClass: new (args: TaggedErrorArgs) => T,
  context: string
): E.Effect<A, T> =>
  E.tryPromise({
    try: promiseFactory,
    catch: (error) => {
      if (error instanceof Error) {
        return new ErrorClass({
          message: `${context}: ${error.message}`,
          cause: error
        });
      }

      if (typeof error === 'string') {
        return new ErrorClass({
          message: `${context}: ${error}`,
          cause: error
        });
      }

      return new ErrorClass({
        message: `${context}: ${String(error)}`,
        cause: error
      });
    }
  });

/**
 * Converts an Effect that might fail to one that returns an Option
 * Useful for operations where failure should result in None rather than an error
 *
 * @param effect - The Effect to convert
 * @returns An Effect that returns Option<A> instead of failing
 */
export const toOption = <A, E>(effect: E.Effect<A, E>): E.Effect<O.Option<A>, never> =>
  pipe(
    effect,
    E.map(O.some),
    E.catchAll(() => E.succeed(O.none()))
  );

/**
 * Safely runs an Effect and returns an Option with the result
 * Logs errors but doesn't propagate them
 *
 * @param effect - The Effect to run
 * @param context - Context for logging errors
 * @returns An Option containing the result or None if failed
 */
export const safeRun = <A, E>(
  effect: E.Effect<A, E>,
  context?: string
): E.Effect<O.Option<A>, never> =>
  pipe(
    effect,
    E.map(O.some),
    E.catchAll((error) =>
      E.sync(() => {
        if (context) {
          console.warn(`${context}:`, error);
        } else {
          console.warn('Effect failed:', error);
        }
        return O.none();
      })
    )
  );

/**
 * Safely sequences multiple Effects, continuing even if some fail
 * Returns an array of Exit results
 *
 * @param effects - Array of Effects to run
 * @returns Effect containing array of Exit results
 */
export const sequenceWithExits = <A, E>(
  effects: E.Effect<A, E>[]
): E.Effect<Exit.Exit<A, E>[], never> => E.all(effects.map(E.exit));

/**
 * Runs multiple Effects in parallel, collecting successful results
 * Failed effects are logged but don't stop the overall operation
 *
 * @param effects - Array of Effects to run
 * @param context - Context for logging failures
 * @returns Effect containing array of successful results
 */
export const collectSuccesses = <A, E>(
  effects: E.Effect<A, E>[],
  context?: string
): E.Effect<A[], never> =>
  pipe(
    sequenceWithExits(effects),
    E.map((exits) =>
      exits.reduce<A[]>((acc, exit) => {
        if (Exit.isSuccess(exit)) {
          acc.push(exit.value);
        } else if (context) {
          console.warn(`${context}: Effect failed:`, exit.cause);
        }
        return acc;
      }, [])
    )
  );

/**
 * Logs an Effect's execution for debugging
 *
 * @param effect - The Effect to log
 * @param label - Label for the log messages
 * @returns The Effect with logging applied
 */
export const debugEffect = <A, E>(effect: E.Effect<A, E>, label: string): E.Effect<A, E> =>
  pipe(
    E.sync(() => console.debug(`[${label}] Starting...`)),
    E.flatMap(() => effect),
    E.tap((result) => E.sync(() => console.debug(`[${label}] Success:`, result))),
    E.tapError((error) => E.sync(() => console.debug(`[${label}] Error:`, error)))
  );

/**
 * Times an Effect's execution
 *
 * @param effect - The Effect to time
 * @param label - Label for the timing log
 * @returns The Effect with timing applied
 */
export const timeEffect = <A, E>(effect: E.Effect<A, E>, label: string): E.Effect<A, E> => {
  const startTime = Date.now();

  return pipe(
    effect,
    E.tap(() =>
      E.sync(() => {
        const duration = Date.now() - startTime;
        console.debug(`[${label}] Completed in ${duration}ms`);
      })
    ),
    E.tapError(() =>
      E.sync(() => {
        const duration = Date.now() - startTime;
        console.debug(`[${label}] Failed after ${duration}ms`);
      })
    )
  );
};
