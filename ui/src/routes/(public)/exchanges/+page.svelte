<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import ExchangeDashboard from '$lib/components/exchanges/ExchangeDashboard.svelte';
  import { createExchangesStore } from '$lib/stores/exchanges.store.svelte';
  import { useExchangeDetails } from '$lib/composables/domain/exchanges/useExchangeDetails.svelte';
  import { runEffect } from '$lib/utils/effect';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';

  // Initialize stores
  const exchangesStore = createExchangesStore();
  const exchangeDetails = useExchangeDetails();

  // Get current user and admin status
  const currentUser = $derived(usersStore.currentUser);
  const currentUserId = $derived(currentUser?.original_action_hash?.toString());
  const agentIsAdministrator = $derived(administrationStore.agentIsAdministrator);

  // Load exchanges on mount
  onMount(async () => {
    if (currentUserId) {
      // The ExchangeDashboard component handles its own initialization
      // No need to initialize here since it will be done in the dashboard
      console.log('🔄 Exchanges page: User found, ExchangeDashboard will handle data loading');
    }
  });
</script>

<svelte:head>
  <title>My Exchanges - Requests & Offers</title>
  <meta
    name="description"
    content="Manage your exchange proposals, agreements, and reviews in the Requests & Offers platform."
  />
</svelte:head>

<div class="container mx-auto space-y-6 p-4">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="h1 font-bold">My Exchanges</h1>
      <p class="text-surface-600 dark:text-surface-400">
        Manage your proposals, agreements, and reviews
      </p>
    </div>
    {#if agentIsAdministrator}
      <a
        href="/admin/exchanges"
        class="variant-filled-secondary btn"
        aria-label="Access admin exchanges panel"
      >
        ⚙️ Admin View
      </a>
    {/if}
  </div>

  {#if currentUserId}
    <ExchangeDashboard userId={currentUserId} />
  {:else}
    <div class="card p-6 text-center">
      <h2 class="h3 mb-2">Welcome!</h2>
      <p class="mb-4 text-surface-600 dark:text-surface-400">
        Please create or complete your user profile to access exchanges.
      </p>
      <a href="/user/create" class="variant-filled-primary btn"> Create Profile </a>
    </div>
  {/if}
</div>
