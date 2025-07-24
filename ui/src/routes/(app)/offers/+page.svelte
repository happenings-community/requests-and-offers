<script lang="ts">
  import { goto } from '$app/navigation';
  import { useOffersManagement } from '$lib/composables';
  import OffersTable from '$lib/components/offers/OffersTable.svelte';

  // Use the composable for all state management and operations
  const management = useOffersManagement();

  // Handle create offer action
  function handleCreateOffer() {
    goto('/offers/create');
  }

  // Initialize on mount
  $effect(() => {
    management.initialize();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex flex-col items-center justify-between md:flex-row">
    <h1 class="h1 text-center md:text-left">Offers</h1>

    {#if management.currentUser}
      <div class="mt-4 flex flex-col gap-4 sm:flex-row md:mt-0">
        <!-- Filter options -->
        <div class="flex gap-2">
          <button
            class="btn {management.filterType === 'all'
              ? 'variant-filled-primary'
              : 'variant-soft'}"
            onclick={() => management.setFilterType('all')}
          >
            All
          </button>
          <button
            class="btn {management.filterType === 'my' ? 'variant-filled-primary' : 'variant-soft'}"
            onclick={() => management.setFilterType('my')}
          >
            My Offers
          </button>
          {#if management.currentUser.organizations?.length}
            <button
              class="btn {management.filterType === 'organization'
                ? 'variant-filled-primary'
                : 'variant-soft'}"
              onclick={() => management.setFilterType('organization')}
            >
              Organization
            </button>
          {/if}
        </div>

        <!-- Create button -->
        {#if management.canCreateOffers}
          <button class="variant-filled-secondary btn" onclick={handleCreateOffer}>
            Create Offer
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if management.error || management.storeError}
    <div class="alert variant-filled-error mb-4">
      <div class="alert-message">
        <h3 class="h3">Access Required</h3>
        <p>{management.error || management.storeError}</p>
      </div>
      <div class="alert-actions">
        {#if management.error?.includes('create a user profile') || !management.currentUser}
          <!-- User needs to create a profile -->
          <a href="/user/create" class="variant-filled-primary btn btn-sm"> Create Profile </a>
          <a href="/users" class="variant-soft btn btn-sm"> Browse Community </a>
        {:else if management.error?.includes('pending approval') || management.currentUser?.status?.status_type === 'pending'}
          <!-- User is pending approval -->
          <button class="variant-soft btn btn-sm" onclick={() => management.loadOffers()}>
            Check Status
          </button>
          <a href="/users" class="variant-soft btn btn-sm"> Browse Community </a>
        {:else}
          <!-- Generic retry for other errors -->
          <button class="variant-soft btn btn-sm" onclick={() => management.loadOffers()}>
            Retry
          </button>
        {/if}
      </div>
    </div>
  {/if}

  {#if management.isLoading || management.storeLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading offers...</p>
    </div>
  {:else if !management.hasInitialized}
    <div class="flex h-64 items-center justify-center">
      <p class="text-surface-500">Loading...</p>
    </div>
  {:else if !management.currentUser}
    <div class="text-surface-500 text-center text-xl">Please log in to view offers.</div>
  {:else if management.filteredOffers.length === 0}
    <div class="text-surface-500 text-center text-xl">
      {#if management.filterType === 'all'}
        No offers found. Create your first offer!
      {:else if management.filterType === 'my'}
        You haven't created any offers yet.
      {:else}
        No organization offers found.
      {/if}
    </div>
  {:else}
    <OffersTable offers={management.filteredOffers} showCreator={true} showOrganization={true} />
  {/if}
</section>
