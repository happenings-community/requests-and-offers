import * as E from '@effect/io/Effect';
import { Tag } from '@effect/data/Context';

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

// Type helper for service layers
export type ServiceTag<T> = Tag<T, T>;

// Helper for creating service tags
export const createServiceTag = <T>(name: string): ServiceTag<T> => Tag<T, T>(Symbol.for(name));
