<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import MediumOfExchangeSuggestionForm from '$lib/components/mediums-of-exchange/MediumOfExchangeSuggestionForm.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { onMount } from 'svelte';
  import usersStore from '$lib/stores/users.store.svelte';

  // Toast store for notifications
  const toastStore = getToastStore();
  const { currentUser } = $derived(usersStore);

  // State
  let approvedMediums: UIMediumOfExchange[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showSuggestionForm = $state(false);
  let searchQuery = $state('');

  // Filtered mediums based on search
  const filteredMediums = $derived(
    approvedMediums.filter(
      (medium) =>
        medium.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        medium.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (medium.description && medium.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  );

  onMount(() => {
    loadMediums();
  });

  async function loadMediums() {
    loading = true;
    error = null;

    try {
      await runEffect(mediumsOfExchangeStore.getApprovedMediumsOfExchange());
      approvedMediums = mediumsOfExchangeStore.approvedMediumsOfExchange;
    } catch (err) {
      console.error('Failed to load mediums of exchange:', err);
      error = 'Failed to load mediums of exchange';
      toastStore.trigger({
        message: 'Failed to load mediums of exchange',
        background: 'variant-filled-error'
      });
    } finally {
      loading = false;
    }
  }

  function handleSuggestionSuccess() {
    showSuggestionForm = false;
    toastStore.trigger({
      message: 'Your suggestion has been submitted for review!',
      background: 'variant-filled-success'
    });
  }

  function handleSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;
  }
</script>

<svelte:head>
  <title>Mediums of Exchange - Requests & Offers</title>
  <meta
    name="description"
    content="Browse and suggest mediums of exchange for compensation in the marketplace"
  />
</svelte:head>

<div class="container mx-auto space-y-6 p-4">
  <!-- Header -->
  <header class="space-y-4 text-center">
    <h1 class="h1">Mediums of Exchange</h1>
    <p class="mx-auto max-w-2xl text-surface-600 dark:text-surface-400">
      Browse available currencies and mediums of exchange that can be used for compensation in
      offers and requests. Don't see what you're looking for? Suggest a new one!
    </p>
  </header>

  <!-- Actions Bar -->
  <div class="card p-4">
    <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <!-- Search -->
      <div class="max-w-md flex-1">
        <label class="label">
          <span class="sr-only">Search mediums</span>
          <input
            type="text"
            class="input"
            placeholder="Search by code, name, or description..."
            value={searchQuery}
            oninput={handleSearch}
          />
        </label>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        {#if currentUser?.status?.status_type === 'accepted'}
          <button
            type="button"
            class="variant-filled-primary btn"
            onclick={() => (showSuggestionForm = !showSuggestionForm)}
          >
            {showSuggestionForm ? 'Cancel Suggestion' : 'Suggest New Medium'}
          </button>
        {/if}

        <button
          type="button"
          class="variant-soft-secondary btn"
          onclick={loadMediums}
          disabled={loading}
        >
          {#if loading}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Refresh
        </button>
      </div>
    </div>
  </div>

  <!-- Suggestion Form -->
  {#if showSuggestionForm}
    <MediumOfExchangeSuggestionForm
      onSubmitSuccess={handleSuggestionSuccess}
      onCancel={() => (showSuggestionForm = false)}
    />
  {/if}

  <!-- Content -->
  <div class="space-y-6">
    {#if loading}
      <!-- Loading State -->
      <div class="card p-8 text-center">
        <div class="flex items-center justify-center gap-2">
          <span class="loading loading-spinner loading-lg"></span>
          <span class="text-lg">Loading mediums of exchange...</span>
        </div>
      </div>
    {:else if error}
      <!-- Error State -->
      <div class="card p-8 text-center">
        <div class="alert variant-filled-error">
          <p class="text-lg font-semibold">Error Loading Mediums</p>
          <p>{error}</p>
          <button type="button" class="variant-filled-primary btn mt-4" onclick={loadMediums}>
            Try Again
          </button>
        </div>
      </div>
    {:else if filteredMediums.length === 0}
      <!-- Empty State -->
      <div class="card space-y-4 p-8 text-center">
        {#if searchQuery}
          <h2 class="h2">No Results Found</h2>
          <p class="text-surface-600 dark:text-surface-400">
            No mediums of exchange match your search for "{searchQuery}".
          </p>
          <button
            type="button"
            class="variant-soft-secondary btn"
            onclick={() => (searchQuery = '')}
          >
            Clear Search
          </button>
        {:else if approvedMediums.length === 0}
          <h2 class="h2">No Mediums Available</h2>
          <p class="text-surface-600 dark:text-surface-400">
            No mediums of exchange have been approved yet. Be the first to suggest one!
          </p>
          {#if currentUser?.status?.status_type === 'accepted'}
            <button
              type="button"
              class="variant-filled-primary btn"
              onclick={() => (showSuggestionForm = true)}
            >
              Suggest First Medium
            </button>
          {/if}
        {/if}
      </div>
    {:else}
      <!-- Mediums Grid -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="h2">Available Mediums ({filteredMediums.length})</h2>
          {#if searchQuery}
            <button
              type="button"
              class="variant-soft-secondary btn btn-sm"
              onclick={() => (searchQuery = '')}
            >
              Clear Search
            </button>
          {/if}
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each filteredMediums as medium}
            <div class="card space-y-4 p-6 shadow-lg">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="mb-2 flex items-center gap-3">
                    <h3 class="h3 font-bold text-primary-500">{medium.code}</h3>
                    <span class="variant-soft-success chip text-xs font-medium">Approved</span>
                  </div>
                  <h4 class="h4 font-semibold text-surface-700 dark:text-surface-300">
                    {medium.name}
                  </h4>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4M8 7H3a1 1 0 00-1 1v9a1 1 0 001 1h18a1 1 0 001-1V8a1 1 0 00-1-1h-5m-8 0v10a1 1 0 001 1h8a1 1 0 001-1V7"
                    ></path>
                  </svg>
                  <span>Added: {medium.createdAt.toLocaleDateString()}</span>
                </div>

                {#if medium.resourceSpecHreaId}
                  <div
                    class="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400"
                  >
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      ></path>
                    </svg>
                    <span>hREA Resource: {medium.resourceSpecHreaId}</span>
                  </div>
                {/if}
              </div>

              <div class="border-t border-surface-200 pt-3 dark:border-surface-700">
                {#if medium.description}
                  <p class="mb-2 text-sm text-surface-600 dark:text-surface-400">
                    {medium.description}
                  </p>
                {:else}
                  <p class="text-sm text-surface-600 dark:text-surface-400">
                    This medium of exchange is approved and available for use in requests and offers
                    as a form of compensation.
                  </p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Information Section -->
  <div class="card space-y-4 p-6">
    <h2 class="h2">About Mediums of Exchange</h2>
    <div class="space-y-2 text-surface-600 dark:text-surface-400">
      <p>
        Mediums of exchange represent the various forms of compensation that can be used in the
        marketplace. These can include traditional currencies (USD, EUR, etc.), cryptocurrencies
        (BTC, ETH, etc.), or other forms of value exchange.
      </p>
      <p>
        When creating offers or requests, you can specify which mediums of exchange you prefer for
        compensation. This helps match people with compatible payment preferences.
      </p>
      <p>
        <strong>Note:</strong> All suggested mediums of exchange are reviewed by administrators before
        being approved for use.
      </p>
    </div>
  </div>
</div>
