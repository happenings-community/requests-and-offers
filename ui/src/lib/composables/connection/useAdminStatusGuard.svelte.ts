import { onMount, onDestroy } from 'svelte';
import administrationStore from '$lib/stores/administration.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { Effect as E, pipe } from 'effect';
import { HolochainClientServiceLive } from '$lib/services/HolochainClientService.svelte';
import { AdministrationError } from '$lib/errors/administration.errors';

/**
 * Admin Status Guard Composable
 *
 * Ensures administrator status is properly detected and updated.
 * Use this composable in components that rely on administrator status detection.
 *
 * Features:
 * - Checks admin status on mount
 * - Provides force refresh capability
 * - Handles loading and error states
 *
 * @returns Object with admin status, loading state, and refresh function
 */
export function useAdminStatusGuard() {
  let isLoading = $state(false);
  let error: string | null = $state(null);

  // Reactive admin status from store
  const agentIsAdministrator = $derived(administrationStore.agentIsAdministrator);
  const storeLoading = $derived(administrationStore.loading);

  /**
   * Force refresh admin status
   * Useful when admin status seems out of sync
   */
  async function refreshAdminStatus() {
    if (isLoading || storeLoading) return;

    try {
      isLoading = true;
      error = null;

      // Use the store's checkIfAgentIsAdministrator method
      await runEffect(administrationStore.checkIfAgentIsAdministrator());

      console.log('✅ Admin status refreshed:', agentIsAdministrator);
    } catch (err) {
      console.error('❌ Failed to refresh admin status:', err);
      error = 'Failed to refresh administrator status';
    } finally {
      isLoading = false;
    }
  }

  /**
   * Force refresh entire administration store
   * Useful for critical pages that need guaranteed fresh data
   */
  async function forceRefreshAdminData() {
    if (isLoading || storeLoading) return;

    try {
      isLoading = true;
      error = null;

      // Use the store's forceRefresh method to reload everything
      await E.runPromise(
        pipe(administrationStore.forceRefresh(), E.provide(HolochainClientServiceLive)) as E.Effect<
          void,
          AdministrationError,
          never
        >
      );

      console.log('✅ Administration data force refreshed:', {
        agentIsAdmin: agentIsAdministrator,
        adminCount: administrationStore.administrators.length
      });
    } catch (err) {
      console.error('❌ Failed to force refresh admin data:', err);
      error = 'Failed to refresh administration data';
    } finally {
      isLoading = false;
    }
  }

  /**
   * Check if admin status detection might be stale
   * Returns true if we should consider refreshing
   */
  function isStatusLikelyStale(): boolean {
    // If store is not loading and we have no admin status detected,
    // but we're on an admin page, status might be stale
    return !storeLoading && !agentIsAdministrator;
  }

  // Auto-refresh admin status on mount if it seems stale
  onMount(async () => {
    // Give the store a moment to initialize if it hasn't already
    await new Promise((resolve) => setTimeout(resolve, 100));

    // If status still seems stale, refresh it
    if (isStatusLikelyStale()) {
      console.log('🔄 Admin status seems stale, refreshing...');
      await refreshAdminStatus();
    }
  });

  return {
    // Reactive state
    get agentIsAdministrator() {
      return agentIsAdministrator;
    },
    get isLoading() {
      return isLoading || storeLoading;
    },
    get error() {
      return error;
    },

    // Actions
    refreshAdminStatus,
    forceRefreshAdminData,
    isStatusLikelyStale
  };
}
