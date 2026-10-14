import { Effect as E } from 'effect';
import type { HolochainClientService, ZomeName } from '$lib/services/HolochainClientService.svelte';

/**
 * Generic wrapper for converting Promise-based zome calls to Effect-based calls
 * with consistent error handling patterns
 */
export const wrapZomeCall = <T, E>(
  holochainClient: HolochainClientService,
  zomeName: string,
  fnName: string,
  payload: unknown,
  errorContext: string,
  ErrorConstructor: new (message: string, context?: string) => E
): E.Effect<T, E> =>
  E.tryPromise({
    try: async () => {
      // Ensure Holochain client is connected before making zome calls
      await holochainClient.waitForConnection();
      const result = await holochainClient.callZome(zomeName as ZomeName, fnName, payload);
      return result as T;
    },
    catch: (error) =>
      new ErrorConstructor(
        error instanceof Error ? error.message : String(error),
        errorContext
      ) as E
  });

/**
 * Simplified wrapper for services that use fromError static method
 */
export const wrapZomeCallWithErrorFactory = <T, E>(
  holochainClient: HolochainClientService,
  zomeName: string,
  fnName: string,
  payload: unknown,
  errorContext: string,
  errorFactory: (error: unknown, context: string) => E
): E.Effect<T, E> =>
  E.tryPromise({
    try: async () => {
      // Ensure Holochain client is connected before making zome calls
      await holochainClient.waitForConnection();
      const result = await holochainClient.callZome(zomeName as ZomeName, fnName, payload);
      return result as T;
    },
    catch: (error) => errorFactory(error, errorContext)
  });
