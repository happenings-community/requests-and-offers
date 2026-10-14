import { Effect as E, Context, Layer, Schedule, Duration, pipe } from 'effect';
import { HolochainClientError, ConnectionError, HOLOCHAIN_CLIENT_CONTEXTS } from '$lib/errors';
import hc from './HolochainClientService.svelte';

/**
 * Effect-first connection service for handling Holochain client connections
 * with proper retry, timeout, and error handling patterns.
 */
export interface ConnectionService {
  readonly ensureConnection: () => E.Effect<void, ConnectionError>;
  readonly verifyConnection: () => E.Effect<boolean, never>;
  readonly isConnected: () => boolean;
}

export class ConnectionServiceTag extends Context.Tag('ConnectionService')<
  ConnectionServiceTag,
  ConnectionService
>() {}

/**
 * Creates the connection service implementation using Effect patterns
 */
const makeConnectionService = E.sync(() => {
  /**
   * Verifies if the client is truly connected by testing connectivity
   */
  const verifyConnection = (): E.Effect<boolean, never> =>
    E.succeed(hc.isConnected && hc.client !== null);

  /**
   * Attempts to establish a connection with exponential backoff retry
   */
  const establishConnection = (): E.Effect<void, ConnectionError> =>
    E.gen(function* () {
      yield* E.logInfo('🔄 Attempting to establish Holochain connection');

      yield* E.tryPromise({
        try: () => hc.connectClient(),
        catch: (error) => HolochainClientError.fromError(error, HOLOCHAIN_CLIENT_CONTEXTS.CONNECT)
      });

      yield* E.logInfo('✅ Holochain connection established successfully');
    });

  /**
   * Ensures connection is established with retry and timeout logic
   */
  const ensureConnection = (): E.Effect<void, ConnectionError> =>
    pipe(
      // First verify current connection
      verifyConnection(),
      E.flatMap((isConnected) => {
        if (isConnected) {
          return E.logInfo('✅ Connection already verified') as E.Effect<void, never>;
        }

        return pipe(
          establishConnection(),
          // Retry with exponential backoff - max 3 attempts
          E.retry(
            Schedule.exponential('100 millis').pipe(
              Schedule.intersect(Schedule.recurs(2)) // Max 3 total attempts (initial + 2 retries)
            )
          ),
          // Timeout the entire connection process at 10 seconds
          E.timeout(Duration.seconds(10)),
          E.catchTag('TimeoutException', () =>
            E.fail(
              HolochainClientError.fromError(
                new Error('Connection timeout after 10 seconds'),
                HOLOCHAIN_CLIENT_CONTEXTS.CONNECT
              )
            )
          ),
          E.tapError((error) => E.logError(`❌ Failed to establish connection: ${error.message}`))
        );
      })
    );

  /**
   * Simple connection status check
   */
  const isConnected = (): boolean => hc.isConnected && hc.client !== null;

  return {
    ensureConnection,
    verifyConnection,
    isConnected
  };
});

/**
 * Live implementation layer for the connection service
 */
export const ConnectionServiceLive: Layer.Layer<ConnectionServiceTag> = Layer.effect(
  ConnectionServiceTag,
  makeConnectionService
);
