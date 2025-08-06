import { Effect as E, pipe } from 'effect';
import { ConnectionServiceTag, ConnectionServiceLive } from '$lib/services/connection.service';
import { HolochainError } from '$lib/errors';

/**
 * Effect-first function for ensuring Holochain connection.
 * Uses retry and timeout patterns with proper error handling.
 */
export const useConnectionGuard = (): E.Effect<void, HolochainError> =>
  pipe(
    E.gen(function* () {
      const connectionService = yield* ConnectionServiceTag;
      yield* connectionService.ensureConnection();
    }),
    E.provide(ConnectionServiceLive)
  );
