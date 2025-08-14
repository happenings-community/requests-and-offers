<script lang="ts">
  import { onMount } from 'svelte';
  import { getToastStore, Tab, TabGroup } from '@skeletonlabs/skeleton';
  import { createExchangesStore } from '$lib/stores/exchanges.store.svelte';
  import { encodeHashToBase64 } from '@holochain/client';
  import { formatDate } from '$lib/utils';

  const toastStore = getToastStore();
  const exchangesStore = createExchangesStore();

  let dashboardState = $state({
    isLoading: true,
    tabSet: 0,
    error: null as string | null,
    data: {
      allProposals: [] as any[],
      allAgreements: [] as any[],
      allReviews: [] as any[],
      pendingProposals: [] as any[],
      activeAgreements: [] as any[],
      completedAgreements: [] as any[]
    }
  });

  async function fetchDashboardData() {
    dashboardState.isLoading = true;
    dashboardState.error = null;

    try {
      // Fetch all exchange data
      await exchangesStore.fetchProposals();
      await exchangesStore.fetchAgreements();
      await exchangesStore.fetchReviews();

      // Get data from store
      dashboardState.data.allProposals = exchangesStore.proposals();
      dashboardState.data.allAgreements = exchangesStore.agreements();
      dashboardState.data.allReviews = exchangesStore.reviews();

      // Filter data by status
      dashboardState.data.pendingProposals = exchangesStore.proposals().filter(
        (proposal) => proposal.entry.status === 'Pending'
      );
      dashboardState.data.activeAgreements = exchangesStore.agreements().filter(
        (agreement) => agreement.entry.status === 'Active'
      );
      dashboardState.data.completedAgreements = exchangesStore.agreements().filter(
        (agreement) => agreement.entry.status === 'Completed'
      );
    } catch (e) {
      const error = e as Error;
      dashboardState.error = error.message;
      toastStore.trigger({
        message: 'Failed to load exchanges data. Please try again.',
        background: 'variant-filled-error'
      });
    } finally {
      dashboardState.isLoading = false;
    }
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Pending':
        return 'variant-soft-warning';
      case 'Approved':
        return 'variant-soft-success';
      case 'Rejected':
        return 'variant-soft-error';
      case 'Active':
        return 'variant-soft-primary';
      case 'Completed':
        return 'variant-soft-success';
      default:
        return 'variant-soft-surface';
    }
  }

  onMount(fetchDashboardData);
</script>

<svelte:head>
  <title>Admin - Exchanges Management</title>
  <meta name="description" content="Admin panel for managing exchange proposals, agreements, and reviews" />
</svelte:head>

<section class="space-y-8">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="h1">Exchanges Management</h1>
      <p class="text-surface-400">Monitor and manage exchange proposals, agreements, and reviews</p>
    </div>
    <button
      class="btn variant-filled-primary"
      onclick={fetchDashboardData}
      disabled={dashboardState.isLoading}
    >
      {dashboardState.isLoading ? 'Loading...' : 'Refresh'}
    </button>
  </div>

  <!-- System Overview -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.allProposals.length}</h3>
      <p class="text-sm text-gray-400">Total Proposals</p>
    </div>
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.pendingProposals.length}</h3>
      <p class="text-sm text-gray-400">Pending Proposals</p>
    </div>
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.activeAgreements.length}</h3>
      <p class="text-sm text-gray-400">Active Agreements</p>
    </div>
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.allReviews.length}</h3>
      <p class="text-sm text-gray-400">Total Reviews</p>
    </div>
  </div>

  <!-- Exchanges Data -->
  <div class="card variant-filled-surface p-4">
    <h2 class="h2 mb-4">Exchange Data</h2>
    {#if dashboardState.isLoading}
      <div class="flex items-center justify-center space-x-2 text-center">
        <span class="loading loading-spinner"></span>
        <span>Loading exchanges...</span>
      </div>
    {:else if dashboardState.error}
      <div class="alert variant-filled-error">
        <span>{dashboardState.error}</span>
        <div class="flex-none">
          <button class="btn-ghost btn btn-sm" onclick={fetchDashboardData}>Try Again</button>
        </div>
      </div>
    {:else}
      <TabGroup justify="justify-start" class="mb-4">
        <Tab bind:group={dashboardState.tabSet} name="proposals" value={0}>
          Proposals ({dashboardState.data.allProposals.length})
        </Tab>
        <Tab bind:group={dashboardState.tabSet} name="agreements" value={1}>
          Agreements ({dashboardState.data.allAgreements.length})
        </Tab>
        <Tab bind:group={dashboardState.tabSet} name="reviews" value={2}>
          Reviews ({dashboardState.data.allReviews.length})
        </Tab>
      </TabGroup>

      <!-- Tab Panels -->
      <div class="p-4">
        {#if dashboardState.tabSet === 0}
          <!-- Proposals Panel -->
          <div class="space-y-4">
            {#each dashboardState.data.allProposals as proposal (proposal.actionHash)}
              <div class="bg-surface-800 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-3">
                    <span class="font-semibold">{proposal.entry.service_details}</span>
                    <span class="badge {getStatusBadgeClass(proposal.entry.status)}">
                      {proposal.entry.status}
                    </span>
                  </div>
                  <div class="flex gap-2">
                    <a
                      href="/exchanges/proposal/{encodeHashToBase64(proposal.actionHash)}"
                      class="btn variant-filled-primary btn-sm"
                    >
                      View
                    </a>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-surface-400">
                  <div>
                    <strong>Exchange Medium:</strong> {proposal.entry.exchange_medium}
                  </div>
                  {#if proposal.entry.exchange_value}
                    <div>
                      <strong>Value:</strong> {proposal.entry.exchange_value}
                    </div>
                  {/if}
                  <div>
                    <strong>Created:</strong> {formatDate(new Date(proposal.entry.created_at))}
                  </div>
                </div>
              </div>
            {:else}
              <p class="text-center text-surface-400">No proposals found.</p>
            {/each}
          </div>
        {:else if dashboardState.tabSet === 1}
          <!-- Agreements Panel -->
          <div class="space-y-4">
            {#each dashboardState.data.allAgreements as agreement (agreement.actionHash)}
              <div class="bg-surface-800 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-3">
                    <span class="font-semibold">{agreement.entry.service_details}</span>
                    <span class="badge {getStatusBadgeClass(agreement.entry.status)}">
                      {agreement.entry.status}
                    </span>
                  </div>
                  <div class="flex gap-2">
                    <a
                      href="/exchanges/agreement/{encodeHashToBase64(agreement.actionHash)}"
                      class="btn variant-filled-primary btn-sm"
                    >
                      View
                    </a>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-surface-400">
                  <div>
                    <strong>Exchange Medium:</strong> {agreement.entry.exchange_medium}
                  </div>
                  {#if agreement.entry.exchange_value}
                    <div>
                      <strong>Value:</strong> {agreement.entry.exchange_value}
                    </div>
                  {/if}
                  <div>
                    <strong>Provider Complete:</strong> {agreement.entry.provider_completed ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <strong>Receiver Complete:</strong> {agreement.entry.receiver_completed ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            {:else}
              <p class="text-center text-surface-400">No agreements found.</p>
            {/each}
          </div>
        {:else if dashboardState.tabSet === 2}
          <!-- Reviews Panel -->
          <div class="space-y-4">
            {#each dashboardState.data.allReviews as review (review.actionHash)}
              <div class="bg-surface-800 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-3">
                    <span class="font-semibold">Rating: {review.entry.rating}/5</span>
                    <span class="badge {getStatusBadgeClass(review.entry.reviewer_type)}">
                      {review.entry.reviewer_type}
                    </span>
                  </div>
                  <div class="text-sm text-surface-400">
                    {formatDate(new Date(review.entry.created_at))}
                  </div>
                </div>
                {#if review.entry.comments}
                  <p class="text-sm text-surface-300 mt-2">{review.entry.comments}</p>
                {/if}
              </div>
            {:else}
              <p class="text-center text-surface-400">No reviews found.</p>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</section>

