<script lang="ts">
  import { goto } from '$app/navigation';
  import usersStore from '@stores/users.store.svelte';
  import offersStore from '@stores/offers.store.svelte';
  import type { UIOffer } from '@types/ui';
  import OffersTable from '@components/OffersTable.svelte';
  import { runEffect } from '@utils/effect';

  let isLoading = $state(true);
  let showLoading = $state(false);
  let error: string | null = $state(null);
  let filterType = $state<'all' | 'my' | 'organization'>('all');
  let hasInitialized = $state(false);
  let loadingTimeout: ReturnType<typeof setTimeout> | undefined = $state(undefined);

  const { currentUser } = $derived(usersStore);
  const { offers, getAllOffers } = $derived(offersStore);

  const filteredOffers = $derived.by(() => {
    if (!offers.length) return [];

    const filterFunctions = {
      my: (offer: UIOffer) =>
        currentUser?.original_action_hash &&
        offer.creator &&
        offer.creator.toString() === currentUser.original_action_hash.toString(),

      organization: (offer: UIOffer) =>
        currentUser?.organizations?.length! > 0 &&
        offer.organization &&
        currentUser?.organizations?.some(
          (org) => org.toString() === offer.organization?.toString()
        ),

      all: () => true
    };

    const filterFunction = filterFunctions[filterType] || filterFunctions.all;
    return offers.filter(filterFunction);
  });

  async function fetchOffers() {
    try {
      isLoading = true;
      // Only show loading UI after 150ms to prevent flickering
      loadingTimeout = setTimeout(() => {
        if (isLoading) {
          showLoading = true;
        }
      }, 150);

      error = null;
      await runEffect(getAllOffers());
      hasInitialized = true;
    } catch (err) {
      console.error('Failed to fetch offers:', err);
      error = err instanceof Error ? err.message : 'Failed to load offers';
    } finally {
      isLoading = false;
      showLoading = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    }
  }

  function handleCreateOffer() {
    goto('/offers/create');
  }

  $effect(() => {
    fetchOffers();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex flex-col items-center justify-between md:flex-row">
    <h1 class="h1 text-center md:text-left">Offers</h1>

    {#if currentUser}
      <div class="mt-4 flex flex-col gap-4 sm:flex-row md:mt-0">
        <!-- Filter options -->
        <div class="flex gap-2">
          <button
            class="btn {filterType === 'all' ? 'variant-filled-primary' : 'variant-soft'}"
            onclick={() => (filterType = 'all')}
          >
            All
          </button>
          <button
            class="btn {filterType === 'my' ? 'variant-filled-primary' : 'variant-soft'}"
            onclick={() => (filterType = 'my')}
          >
            My Offers
          </button>
          {#if currentUser.organizations?.length}
            <button
              class="btn {filterType === 'organization'
                ? 'variant-filled-primary'
                : 'variant-soft'}"
              onclick={() => (filterType = 'organization')}
            >
              Organization
            </button>
          {/if}
        </div>

        <!-- Create button -->
        {#if currentUser.status?.status_type === 'accepted'}
          <button class="btn variant-filled-secondary" onclick={handleCreateOffer}>
            Create Offer
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
      <button
        class="btn btn-sm variant-soft"
        onclick={() => {
          error = null;
          fetchOffers();
        }}
      >
        Retry
      </button>
    </div>
  {/if}

  {#if showLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading offers...</p>
    </div>
  {:else if !hasInitialized}
    <div class="flex h-64 items-center justify-center">
      <p class="text-surface-500">Loading...</p>
    </div>
  {:else if !currentUser}
    <div class="text-surface-500 text-center text-xl">Please log in to view offers.</div>
  {:else if filteredOffers.length === 0}
    <div class="text-surface-500 text-center text-xl">
      {#if filterType === 'all'}
        No offers found. Create your first offer!
      {:else if filterType === 'my'}
        You haven't created any offers yet.
      {:else}
        No organization offers found.
      {/if}
    </div>
  {:else}
    <OffersTable offers={filteredOffers} showCreator={true} showOrganization={true} />
  {/if}
</section>
