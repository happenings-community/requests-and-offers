import { Effect as E, Duration } from 'effect';
import type { AgentPubKey } from '@holochain/client';
import hc from '$lib/services/HolochainClientService.svelte';

/**
 * How long the app waits for the client service's connection before it shows
 * the connection error. The service itself ends sooner when every attempt
 * fails (a wrong token or a dead conductor take about 6 s over its three
 * attempts); this bound only matters when an attempt hangs.
 */
export const CONNECTION_DEADLINE_MS = 60_000;

/**
 * Simple, reliable Holochain connection utility
 *
 * This replaces the complex initialization logic with a minimal approach:
 * - Waits on the client service's own attempt and its outcome, which can be
 *   slow: in web mode the first load also grants zome-call signing, about 7 s
 *   per cell on a fresh conductor. A shorter timeout here reported a failure
 *   while that attempt went on to succeed.
 * - No zome calls, network info, or logging during startup
 * - Returns simple success/failure result
 */
export const connectToHolochain = (): Promise<boolean> => {
  return E.runPromise(
    E.gen(function* () {
      try {
        console.log('🔌 Connecting to Holochain...');
        yield* E.tryPromise({
          try: () => hc.waitForConnection(CONNECTION_DEADLINE_MS),
          catch: (error) => error
        });

        // Simple verification - just check if we're connected
        if (hc.isConnected && hc.client) {
          console.log('✅ Holochain connected successfully');
          return true;
        } else {
          console.warn('⚠️ Holochain connection failed - not connected after connectClient');
          return false;
        }
      } catch (error) {
        console.error('❌ Holochain connection failed:', error);
        return false;
      }
    }).pipe(
      // A backstop only: waitForConnection already ends at the deadline.
      E.timeout(Duration.millis(CONNECTION_DEADLINE_MS + 1_000)),
      E.catchAll((error) => {
        console.warn('⚠️ Holochain connection failed or timed out:', error);
        return E.succeed(false);
      })
    )
  );
};

/**
 * Simple connection status check
 */
export const isHolochainConnected = (): boolean => {
  return hc.isConnected && hc.client !== null;
};

/**
 * Wait for Holochain connection to be established.
 * If not connected, attempts to connect. If already connecting, waits for completion.
 *
 * Use this in components that need to ensure connection before store calls.
 * For reactive contexts ($derived, $effect), use isHolochainConnected() instead.
 */
export const waitForHolochainConnection = async (): Promise<void> => {
  if (hc.isConnected && hc.client) return;
  await hc.waitForConnection();
};

/**
 * Get the current agent's public key from the Holochain client.
 * Returns null if not connected.
 */
export const getMyAgentPubKey = (): AgentPubKey | null => {
  return hc.client?.myPubKey ?? null;
};
