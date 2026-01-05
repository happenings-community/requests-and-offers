<script lang="ts">
  import { onMount } from 'svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import RequestCard from '$lib/components/requests/RequestCard.svelte';
  import OfferCard from '$lib/components/offers/OfferCard.svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';

  type Props = {
    userHash: Uint8Array;
  };

  type ListingTab = 'active' | 'archived';

  // Props
  let { userHash }: Props = $props();

  // State - use store data directly
  let requestsLoading: boolean = $state(false);
  let offersLoading: boolean = $state(false);
  let requestsError: string | null = $state(null);
  let offersError: string | null = $state(null);
  let currentTab: ListingTab = $state('active');

  // Bulk selection state
  let showBulkSelection = $state(false);
  let selectedRequests = $state(new Set<string>());
  let selectedOffers = $state(new Set<string>());

  // Stores
  const toastStore = getToastStore();

  // Determine if user can create based on simple status check
  const canCreate = $derived(usersStore.currentUser?.status?.status_type === 'accepted');

  // Load user's listings based on current tab
  async function loadListings() {
    // Load requests based on current tab
    requestsLoading = true;
    requestsError = null;
    try {
      await runEffect(
        currentTab === 'active'
          ? requestsStore.getUserActiveRequests(userHash)
          : requestsStore.getUserArchivedRequests(userHash)
      );
    } catch (err) {
      console.error('Failed to load user requests:', err);
      requestsError = err instanceof Error ? err.message : 'Unknown error';
      toastStore.trigger({
        message: `Failed to load your ${currentTab} requests`,
        background: 'variant-filled-error'
      });
    } finally {
      requestsLoading = false;
    }

    // Load offers based on current tab
    offersLoading = true;
    offersError = null;
    try {
      await runEffect(
        currentTab === 'active'
          ? offersStore.getUserActiveOffers(userHash)
          : offersStore.getUserArchivedOffers(userHash)
      );
    } catch (err) {
      console.error('Failed to load user offers:', err);
      offersError = err instanceof Error ? err.message : 'Unknown error';
      toastStore.trigger({
        message: `Failed to load your ${currentTab} offers`,
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
  // Use store data directly based on current tab
  const displayRequests = $derived(
    currentTab === 'active' ? requestsStore.activeRequests : requestsStore.archivedRequests
  );
  const displayOffers = $derived(
    currentTab === 'active' ? offersStore.activeOffers : offersStore.archivedOffers
  );

  // Tab switching function
  function switchTab(tab: ListingTab) {
    if (currentTab !== tab) {
      currentTab = tab;
      // Clear selections when switching tabs
      selectedRequests.clear();
      selectedOffers.clear();
      showBulkSelection = false;
      // Reload listings for the new tab
      loadListings();
    }
  }

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
    const requests =
      currentTab === 'active' ? requestsStore.activeRequests : requestsStore.archivedRequests;
    requests.forEach((request) => {
      if (request.original_action_hash) {
        selectedRequests.add(request.original_action_hash.toString());
      }
    });
    selectedRequests = new Set(selectedRequests);
  }

  function selectAllOffers() {
    const offers = currentTab === 'active' ? offersStore.activeOffers : offersStore.archivedOffers;
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
  <!-- Tab Switcher -->
  <div class="flex items-center justify-between">
    <div class="flex gap-2">
      <button
        class="btn btn-sm"
        class:variant-filled-primary={currentTab === 'active'}
        class:variant-ghost-primary={currentTab !== 'active'}
        onclick={() => switchTab('active')}
      >
        📋 Active Listings
      </button>
      <button
        class="btn btn-sm"
        class:variant-filled-warning={currentTab === 'archived'}
        class:variant-ghost-warning={currentTab !== 'archived'}
        onclick={() => switchTab('archived')}
      >
        📦 Archived Listings
      </button>
    </div>
    <button class="variant-ghost-surface btn btn-sm" onclick={toggleBulkSelection}>
      {showBulkSelection ? '✕ Cancel Selection' : '☑️ Bulk Select'}
    </button>
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
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-primary-500">{displayRequests.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">
        {currentTab === 'active' ? 'Active' : 'Archived'} Requests
      </p>
    </div>
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-secondary-500">{displayOffers.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">
        {currentTab === 'active' ? 'Active' : 'Archived'} Offers
      </p>
    </div>
  </div>

  <!-- Requests Section -->
  <section>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="h3">My {currentTab === 'active' ? 'Active' : 'Archived'} Requests</h3>
      {#if canCreate && currentTab === 'active'}
        <a href="/requests/create" class="variant-filled-primary btn btn-sm"> + New Request </a>
      {/if}
    </div>

    {#if requestsLoading}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="mb-2 animate-pulse text-4xl">📝</div>
          <h4 class="h4 mb-2 font-semibold">Loading Requests</h4>
          <p class="text-surface-600 dark:text-surface-400">
            Fetching your latest requests from the network...
          </p>
        </div>
        <div class="flex justify-center">
          <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500"></div>
        </div>
      </div>
    {:else if requestsError}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="mb-2 text-6xl">⚠️</div>
          <h4 class="h4 mb-2 font-semibold text-error-500">Connection Issue</h4>
          <p class="mb-4 text-surface-600 dark:text-surface-400">
            Unable to load your requests. Please check your connection and try again.
          </p>
          <details class="mb-4 text-sm text-surface-500">
            <summary class="cursor-pointer hover:text-surface-400">Technical details</summary>
            <p class="mt-2 rounded bg-surface-100 p-2 text-left dark:bg-surface-800">
              {requestsError}
            </p>
          </details>
        </div>
        <button class="variant-filled-primary btn" onclick={loadListings}> 🔄 Try Again </button>
      </div>
    {:else if displayRequests.length === 0}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="mb-2 text-6xl">📝</div>
          <h4 class="h4 mb-2 font-semibold">
            {currentTab === 'active' ? 'No Requests Yet' : 'No Archived Requests'}
          </h4>
          <p class="mb-4 text-surface-600 dark:text-surface-400">
            {currentTab === 'active'
              ? 'Start by creating your first request to ask for services or skills you need.'
              : 'Your archived requests will appear here.'}
          </p>
        </div>
        {#if canCreate && currentTab === 'active'}
          <a href="/requests/create" class="variant-filled-primary btn">
            ✨ Create Your First Request
          </a>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each displayRequests as request}
          <RequestCard
            {request}
            showActions={true}
            isArchived={currentTab === 'archived'}
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
      <h3 class="h3">My {currentTab === 'active' ? 'Active' : 'Archived'} Offers</h3>
      {#if canCreate && currentTab === 'active'}
        <a href="/offers/create" class="variant-filled-secondary btn btn-sm"> + New Offer </a>
      {/if}
    </div>

    {#if offersLoading}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="mb-2 animate-pulse text-4xl">🤝</div>
          <h4 class="h4 mb-2 font-semibold">Loading Offers</h4>
          <p class="text-surface-600 dark:text-surface-400">
            Fetching your latest offers from the network...
          </p>
        </div>
        <div class="flex justify-center">
          <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-secondary-500"></div>
        </div>
      </div>
    {:else if offersError}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="mb-2 text-6xl">⚠️</div>
          <h4 class="h4 mb-2 font-semibold text-error-500">Connection Issue</h4>
          <p class="mb-4 text-surface-600 dark:text-surface-400">
            Unable to load your offers. Please check your connection and try again.
          </p>
          <details class="mb-4 text-sm text-surface-500">
            <summary class="cursor-pointer hover:text-surface-400">Technical details</summary>
            <p class="mt-2 rounded bg-surface-100 p-2 text-left dark:bg-surface-800">
              {offersError}
            </p>
          </details>
        </div>
        <button class="variant-filled-primary btn" onclick={loadListings}> 🔄 Try Again </button>
      </div>
    {:else if displayOffers.length === 0}
      <div class="card p-8 text-center">
        <div class="mb-4">
          <div class="mb-2 text-6xl">🤝</div>
          <h4 class="h4 mb-2 font-semibold">
            {currentTab === 'active' ? 'No Offers Yet' : 'No Archived Offers'}
          </h4>
          <p class="mb-4 text-surface-600 dark:text-surface-400">
            {currentTab === 'active'
              ? 'Share your skills and services by creating your first offer to help others.'
              : 'Your archived offers will appear here.'}
          </p>
        </div>
        {#if canCreate && currentTab === 'active'}
          <a href="/offers/create" class="variant-filled-secondary btn">
            💫 Create Your First Offer
          </a>
        {/if}
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each displayOffers as offer}
          <OfferCard
            {offer}
            showActions={true}
            isArchived={currentTab === 'archived'}
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
