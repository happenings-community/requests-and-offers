import * as E from '@effect/io/Effect';

/**
 * Runs an Effect and returns the result or throws an error
 * @param effect The Effect to run
 * @returns The result of the Effect
 * @throws The error from the Effect if it fails
 */
export async function runEffect<E, A>(effect: E.Effect<never, E, A>): Promise<A> {
  return E.runPromise(effect).catch((error) => {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  });
}
