import { Effect as E } from 'effect';

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
