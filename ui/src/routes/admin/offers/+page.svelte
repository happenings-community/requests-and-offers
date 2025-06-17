<script lang="ts">
  import { onMount } from 'svelte';
  import OffersTable from '$lib/components/offers/OffersTable.svelte';
  import { useOffersManagement, usePagination } from '$lib/composables';
  import Pagination from '$lib/components/shared/Pagination.svelte';

  // Use the composable for all state management and operations
  const management = useOffersManagement();
  const pagination = usePagination({
    items: management.offers,
    initialPage: 1,
    pageSize: 10
  });

  onMount(async () => {
    await management.initialize();
  });

  $effect(() => {
    pagination.updateItems(management.offers);
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Offers Management</h1>
    <button class="variant-filled-primary btn" onclick={() => management.loadOffers()}>
      Refresh
    </button>
  </div>

  {#if management.error || management.storeError}
    <div class="alert variant-filled-error mb-4">
      <p>{management.error || management.storeError}</p>
      <button
        class="variant-soft btn btn-sm"
        onclick={() => {
          management.loadOffers();
        }}
      >
        Retry
      </button>
    </div>
  {/if}

  {#if management.isLoading || management.storeLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading offers...</p>
    </div>
  {:else if management.offers.length === 0}
    <div class="bg-surface-100-800-token/90 card variant-soft p-8 text-center backdrop-blur-lg">
      <span class="material-symbols-outlined mb-4 text-6xl text-surface-500">inbox</span>
      <p class="text-xl text-surface-500">
        {#if management.currentUser}
          No offers found in the system.
        {:else}
          Please log in to view offers.
        {/if}
      </p>
    </div>
  {:else}
    <div class="bg-surface-100-800-token/90 p-4 backdrop-blur-lg rounded-container-token space-y-4">
      <OffersTable
        offers={[...pagination.paginatedItems]}
        showOrganization={true}
        showCreator={true}
        title="All Offers"
      />
      <Pagination {pagination} />
    </div>
  {/if}
</section>
