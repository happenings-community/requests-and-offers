import { onMount, onDestroy } from 'svelte';
import { Effect as E, pipe } from 'effect';
import {
  AdminStatusServiceTag,
  AdminStatusServiceLive,
  useAdminStatusCheck,
  type AdminStatusState
} from '$lib/services/adminStatus.service.svelte';

/**
 * Background Admin Status Check Composable
 *
 * Runs admin status verification in the background similar to connection checks.
 * Provides reactive status that components can use to show/hide admin features.
 *
 * Usage in main layout or app root:
 * ```svelte
 * <script>
 *   const adminCheck = useBackgroundAdminCheck();
 * </script>
 *
 * {#if adminCheck.isAdmin}
 *   <AdminPanel />
 * {/if}
 * ```
 */
export function useBackgroundAdminCheck() {
  const adminStatus = useAdminStatusCheck();

  let intervalId: number | null = null;
  let isDestroyed = false;

  /**
   * Perform admin status check using Effect
   */
  const performAdminCheck = async (): Promise<void> => {
    if (isDestroyed) return;

    try {
      const effect = pipe(
        E.gen(function* () {
          const service = yield* AdminStatusServiceTag;
          yield* service.ensureAdminStatusChecked();
        }),
        E.provide(AdminStatusServiceLive)
      );

      await E.runPromise(effect);
    } catch (error) {
      console.warn('Background admin status check failed:', error);
      // Non-critical error - admin features will remain hidden
    }
  };

  /**
   * Start background checking with intervals
   */
  const startBackgroundCheck = (): void => {
    // Immediate check
    performAdminCheck();

    // Periodic checks every 60 seconds (less frequent than connection)
    intervalId = setInterval(() => {
      if (!isDestroyed) {
        performAdminCheck();
      }
    }, 60_000) as unknown as number;

    console.log('🔍 Background admin status checking started');
  };

  /**
   * Stop background checking
   */
  const stopBackgroundCheck = (): void => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
      console.log('⏹️ Background admin status checking stopped');
    }
  };

  /**
   * Force a manual admin status check
   */
  const forceCheck = (): void => {
    performAdminCheck();
  };

  // Start checking on mount
  onMount(() => {
    // Small delay to let other initialization complete
    setTimeout(() => {
      if (!isDestroyed) {
        startBackgroundCheck();
      }
    }, 1000);
  });

  // Cleanup on destroy
  onDestroy(() => {
    isDestroyed = true;
    stopBackgroundCheck();
  });

  return {
    // Reactive admin status from service
    get adminStatusState(): AdminStatusState {
      return adminStatus.adminStatusState;
    },
    get isAdmin(): boolean {
      return adminStatus.isAdmin;
    },
    get isChecking(): boolean {
      return adminStatus.isChecking;
    },
    get hasError(): boolean {
      return adminStatus.hasError;
    },
    get errorMessage(): string | null {
      return adminStatus.errorMessage;
    },
    get isReady(): boolean {
      return adminStatus.isReady;
    },

    // Actions
    forceCheck,
    startBackgroundCheck,
    stopBackgroundCheck
  };
}
