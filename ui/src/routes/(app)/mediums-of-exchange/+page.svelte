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
        medium.name.toLowerCase().includes(searchQuery.toLowerCase())
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
    <p class="text-surface-600 dark:text-surface-400 mx-auto max-w-2xl">
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
            placeholder="Search by code or name..."
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
            class="btn variant-filled-primary"
            onclick={() => (showSuggestionForm = !showSuggestionForm)}
          >
            {showSuggestionForm ? 'Cancel Suggestion' : 'Suggest New Medium'}
          </button>
        {/if}

        <button
          type="button"
          class="btn variant-soft-secondary"
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
          <button type="button" class="btn variant-filled-primary mt-4" onclick={loadMediums}>
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
            class="btn variant-soft-secondary"
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
              class="btn variant-filled-primary"
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
              class="btn btn-sm variant-soft-secondary"
              onclick={() => (searchQuery = '')}
            >
              Clear Search
            </button>
          {/if}
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each filteredMediums as medium}
            <div class="card space-y-2 p-4">
              <div class="flex items-center justify-between">
                <h3 class="h3 text-primary-500">{medium.code}</h3>
                <span class="variant-soft-success chip text-xs">Approved</span>
              </div>

              <h4 class="h4 font-semibold">{medium.name}</h4>

              <div class="text-surface-600 dark:text-surface-400 text-sm">
                <p>Added: {medium.createdAt.toLocaleDateString()}</p>
                {#if medium.resourceSpecHreaId}
                  <p class="text-surface-500 text-xs">
                    Resource ID: {medium.resourceSpecHreaId}
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
    <div class="text-surface-600 dark:text-surface-400 space-y-2">
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
