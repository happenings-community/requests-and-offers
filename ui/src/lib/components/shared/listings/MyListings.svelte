<script lang="ts">
  import { onMount } from 'svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import type { UIRequest, UIOffer } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import RequestCard from '$lib/components/requests/RequestCard.svelte';
  import OfferCard from '$lib/components/offers/OfferCard.svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';

  type Props = {
    userId: string;
  };

  // Props
  let { userId }: Props = $props();

  // State
  let requests: UIRequest[] = $state([]);
  let offers: UIOffer[] = $state([]);
  let requestsLoading: boolean = $state(false);
  let offersLoading: boolean = $state(false);
  let requestsError: string | null = $state(null);
  let offersError: string | null = $state(null);

  // Bulk selection state
  let showBulkSelection = $state(false);
  let selectedRequests = $state(new Set<string>());
  let selectedOffers = $state(new Set<string>());

  // Stores
  const toastStore = getToastStore();

  // Load user's listings
  async function loadListings() {
    // Load requests
    requestsLoading = true;
    requestsError = null;
    try {
      const userRequests = await runEffect(requestsStore.getUserRequests(userId as any));
      requests = userRequests;
    } catch (err) {
      console.error('Failed to load user requests:', err);
      requestsError = err instanceof Error ? err.message : 'Unknown error';
      toastStore.trigger({
        message: 'Failed to load your requests',
        background: 'variant-filled-error'
      });
    } finally {
      requestsLoading = false;
    }

    // Load offers
    offersLoading = true;
    offersError = null;
    try {
      const userOffers = await runEffect(offersStore.getUserOffers(userId as any));
      offers = userOffers;
    } catch (err) {
      console.error('Failed to load user offers:', err);
      offersError = err instanceof Error ? err.message : 'Unknown error';
      toastStore.trigger({
        message: 'Failed to load your offers',
        background: 'variant-filled-error'
      });
    } finally {
      offersLoading = false;
    }
  }

  // Initialize
  onMount(() => {
    loadListings();
  });

  // Helper function to count active vs archived listings
  const activeRequests = $derived(requests); // For now, all requests are considered active
  const archivedRequests = $derived([]); // For now, no archived requests
  const activeOffers = $derived(offers); // For now, all offers are considered active
  const archivedOffers = $derived([]); // For now, no archived offers

  // Bulk selection handlers
  function toggleBulkSelection() {
    showBulkSelection = !showBulkSelection;
    if (!showBulkSelection) {
      selectedRequests.clear();
      selectedOffers.clear();
    }
  }

  function handleRequestSelection(selected: boolean, requestId: string) {
    if (selected) {
      selectedRequests.add(requestId);
    } else {
      selectedRequests.delete(requestId);
    }
    // Trigger reactivity
    selectedRequests = new Set(selectedRequests);
  }

  function handleOfferSelection(selected: boolean, offerId: string) {
    if (selected) {
      selectedOffers.add(offerId);
    } else {
      selectedOffers.delete(offerId);
    }
    // Trigger reactivity
    selectedOffers = new Set(selectedOffers);
  }

  function selectAllRequests() {
    requests.forEach((request) => {
      if (request.original_action_hash) {
        selectedRequests.add(request.original_action_hash.toString());
      }
    });
    selectedRequests = new Set(selectedRequests);
  }

  function selectAllOffers() {
    offers.forEach((offer) => {
      if (offer.original_action_hash) {
        selectedOffers.add(offer.original_action_hash.toString());
      }
    });
    selectedOffers = new Set(selectedOffers);
  }

  function clearAllSelections() {
    selectedRequests.clear();
    selectedOffers.clear();
    selectedRequests = new Set(selectedRequests);
    selectedOffers = new Set(selectedOffers);
  }

  // Derived values for selection counts
  const selectedRequestsCount = $derived(selectedRequests.size);
  const selectedOffersCount = $derived(selectedOffers.size);
  const totalSelectedCount = $derived(selectedRequestsCount + selectedOffersCount);
</script>

<div class="space-y-8">
  <div>
    <div class="flex items-center justify-between">
      <div>
        <h2 class="h2 mb-2">My Listings</h2>
        <p class="text-surface-600 dark:text-surface-400">Manage your requests and offers</p>
      </div>
      <button class="variant-ghost-primary btn btn-sm" onclick={toggleBulkSelection}>
        {showBulkSelection ? '✕ Cancel Selection' : '☑️ Bulk Select'}
      </button>
    </div>
  </div>

  <!-- Bulk Actions Toolbar -->
  {#if showBulkSelection && totalSelectedCount > 0}
    <div class="card bg-primary-50 p-4 dark:bg-primary-900/20">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <span class="font-semibold">
            {totalSelectedCount} item{totalSelectedCount !== 1 ? 's' : ''} selected
          </span>
          <div class="flex gap-2">
            <button class="variant-ghost-primary btn btn-sm" onclick={selectAllRequests}>
              Select All Requests
            </button>
            <button class="variant-ghost-secondary btn btn-sm" onclick={selectAllOffers}>
              Select All Offers
            </button>
            <button class="variant-ghost-surface btn btn-sm" onclick={clearAllSelections}>
              Clear All
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            class="variant-ghost-warning btn btn-sm"
            onclick={() => console.log('Bulk archive')}
            disabled={totalSelectedCount === 0}
          >
            📦 Archive Selected
          </button>
          <button
            class="variant-ghost-error btn btn-sm"
            onclick={() => console.log('Bulk delete')}
            disabled={totalSelectedCount === 0}
          >
            🗑️ Delete Selected
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Stats Overview -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-primary-500">{activeRequests.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">Active Requests</p>
    </div>
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-warning-500">{archivedRequests.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">Archived Requests</p>
    </div>
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-secondary-500">{activeOffers.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">Active Offers</p>
    </div>
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-tertiary-500">{archivedOffers.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">Archived Offers</p>
    </div>
  </div>

  <!-- Requests Section -->
  <section>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="h3">My Requests</h3>
      <a href="/requests/create" class="variant-filled-primary btn btn-sm"> + New Request </a>
    </div>

    {#if requestsLoading}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="text-4xl mb-2 animate-pulse">📝</div>
          <h4 class="h4 font-semibold mb-2">Loading Requests</h4>
          <p class="text-surface-600 dark:text-surface-400">
            Fetching your latest requests from the network...
          </p>
        </div>
        <div class="flex justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      </div>
    {:else if requestsError}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="text-6xl mb-2">⚠️</div>
          <h4 class="h4 font-semibold mb-2 text-error-500">Connection Issue</h4>
          <p class="text-surface-600 dark:text-surface-400 mb-4">
            Unable to load your requests. Please check your connection and try again.
          </p>
          <details class="text-sm text-surface-500 mb-4">
            <summary class="cursor-pointer hover:text-surface-400">Technical details</summary>
            <p class="mt-2 text-left bg-surface-100 dark:bg-surface-800 p-2 rounded">
              {requestsError}
            </p>
          </details>
        </div>
        <button class="variant-filled-primary btn" onclick={loadListings}>
          🔄 Try Again
        </button>
      </div>
    {:else if requests.length === 0}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="text-6xl mb-2">📝</div>
          <h4 class="h4 font-semibold mb-2">No Requests Yet</h4>
          <p class="text-surface-600 dark:text-surface-400 mb-4">
            Start by creating your first request to ask for services or skills you need.
          </p>
        </div>
        <a href="/requests/create" class="variant-filled-primary btn">
          ✨ Create Your First Request
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each requests as request}
          <RequestCard
            {request}
            showActions={true}
            onUpdate={loadListings}
            {showBulkSelection}
            isSelected={selectedRequests.has(request.original_action_hash?.toString() || '')}
            onSelectionChange={handleRequestSelection}
          />
        {/each}
      </div>
    {/if}
  </section>

  <!-- Offers Section -->
  <section>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="h3">My Offers</h3>
      <a href="/offers/create" class="variant-filled-secondary btn btn-sm"> + New Offer </a>
    </div>

    {#if offersLoading}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="text-4xl mb-2 animate-pulse">🤝</div>
          <h4 class="h4 font-semibold mb-2">Loading Offers</h4>
          <p class="text-surface-600 dark:text-surface-400">
            Fetching your latest offers from the network...
          </p>
        </div>
        <div class="flex justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary-500"></div>
        </div>
      </div>
    {:else if offersError}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="text-6xl mb-2">⚠️</div>
          <h4 class="h4 font-semibold mb-2 text-error-500">Connection Issue</h4>
          <p class="text-surface-600 dark:text-surface-400 mb-4">
            Unable to load your offers. Please check your connection and try again.
          </p>
          <details class="text-sm text-surface-500 mb-4">
            <summary class="cursor-pointer hover:text-surface-400">Technical details</summary>
            <p class="mt-2 text-left bg-surface-100 dark:bg-surface-800 p-2 rounded">
              {offersError}
            </p>
          </details>
        </div>
        <button class="variant-filled-primary btn" onclick={loadListings}>
          🔄 Try Again
        </button>
      </div>
    {:else if offers.length === 0}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="text-6xl mb-2">🤝</div>
          <h4 class="h4 font-semibold mb-2">No Offers Yet</h4>
          <p class="text-surface-600 dark:text-surface-400 mb-4">
            Share your skills and services by creating your first offer to help others.
          </p>
        </div>
        <a href="/offers/create" class="variant-filled-secondary btn">
          💫 Create Your First Offer
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each offers as offer}
          <OfferCard
            {offer}
            showActions={true}
            onUpdate={loadListings}
            {showBulkSelection}
            isSelected={selectedOffers.has(offer.original_action_hash?.toString() || '')}
            onSelectionChange={handleOfferSelection}
          />
        {/each}
      </div>
    {/if}
  </section>
</div>
