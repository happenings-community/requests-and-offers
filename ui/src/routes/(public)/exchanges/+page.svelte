<script lang="ts">
  import { onMount } from 'svelte';
  import { getToastStore, TabGroup, Tab } from '@skeletonlabs/skeleton';
  import { AgreementDashboard } from '$lib/components/exchanges';
  import usersStore from '$lib/stores/users.store.svelte';
  import { isUserApproved } from '$lib/utils';
  import ProposalManagerDashboard from '$lib/components/exchanges/ProposalManagerDashboard.svelte';

  const toastStore = getToastStore();
  const { currentUser } = $derived(usersStore);

  // State
  let tabIndex = $state(0);
  let isLoading = $state(true);

  // Check if user is approved
  const userApproved = $derived(() => {
    return currentUser && isUserApproved(currentUser);
  });

  onMount(() => {
    isLoading = false;
  });
</script>

<svelte:head>
  <title>My Exchanges - Requests & Offers</title>
  <meta
    name="description"
    content="Manage your exchange proposals, agreements, and progress tracking"
  />
</svelte:head>

<div class="container mx-auto space-y-6 p-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="h1 font-bold">My Exchanges</h1>
      <p class="text-surface-600 dark:text-surface-400">
        Manage your proposals, agreements, and exchange progress
      </p>
    </div>
  </div>

  {#if isLoading}
    <!-- Loading state -->
    <div class="flex items-center justify-center p-8">
      <div class="flex items-center gap-4">
        <span class="animate-spin text-2xl">⏳</span>
        <p class="text-lg">Loading exchanges...</p>
      </div>
    </div>
  {:else if !currentUser}
    <!-- Not logged in -->
    <div class="card p-8 text-center">
      <span class="material-symbols-outlined text-surface-400 mb-4 text-6xl">login</span>
      <h2 class="h2 mb-4">Login Required</h2>
      <p class="text-surface-600 dark:text-surface-400 mb-4">
        You need to be logged in to view your exchanges.
      </p>
      <a href="/user" class="variant-filled-primary btn"> Login / Register </a>
    </div>
  {:else if !userApproved()}
    <!-- User not approved -->
    <div class="card variant-soft-warning p-8 text-center">
      <span class="material-symbols-outlined text-warning-600 mb-4 text-6xl">pending</span>
      <h2 class="h2 mb-4">Account Pending Approval</h2>
      <p class="text-warning-700 dark:text-warning-300 mb-4">
        Your account is pending approval before you can view exchanges.
      </p>
    </div>
  {:else}
    <!-- Main exchange interface -->
    <div class="card">
      <TabGroup>
        <Tab bind:group={tabIndex} name="proposals" value={0}>
          <span class="flex items-center gap-2">
            <span>Proposals</span>
          </span>
        </Tab>
        <Tab bind:group={tabIndex} name="agreements" value={1}>
          <span class="flex items-center gap-2">
            <span>Agreements</span>
          </span>
        </Tab>

        <!-- Tab Panels -->
        <svelte:fragment slot="panel">
          {#if tabIndex === 0}
            <div class="p-6">
              <h2 class="h3 mb-4 font-semibold">Exchange Proposals</h2>
              <p class="text-surface-600 dark:text-surface-400 mb-6">
                View and manage proposals you've sent and received
              </p>
              <ProposalManagerDashboard />
            </div>
          {:else if tabIndex === 1}
            <div class="p-6">
              <h2 class="h3 mb-4 font-semibold">Active Agreements</h2>
              <p class="text-surface-600 dark:text-surface-400 mb-6">
                Track your ongoing exchanges and their progress
              </p>
              <AgreementDashboard />
            </div>
          {/if}
        </svelte:fragment>
      </TabGroup>
    </div>
  {/if}
</div>
