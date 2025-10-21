import { Effect as E, Duration } from 'effect';
import hc from '$lib/services/HolochainClientService.svelte';

/**
 * Simple, reliable Holochain connection utility
 *
 * This replaces the complex initialization logic with a minimal approach:
 * - Just connect to Holochain with a timeout
 * - No zome calls, network info, or logging during startup
 * - Returns simple success/failure result
 */
export const connectToHolochain = (): Promise<boolean> => {
  return E.runPromise(
    E.gen(function* () {
      try {
        console.log('🔌 Connecting to Holochain...');
        yield* E.tryPromise({
          try: () => hc.connectClient(),
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
      E.timeout(Duration.seconds(5)), // 5-second timeout for entire connection
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
