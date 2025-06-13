<script lang="ts">
  import { onMount } from 'svelte';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';
  import { runEffect } from '$lib/utils/effect';
  import usersStore from '$lib/stores/users.store.svelte';

  let pageState = $state({
    isLoading: true,
    error: null as string | null
  });

  const {currentUser} = $derived(usersStore);

  // Reactive getter for approved service types from the store
  const { approvedServiceTypes } = $derived(serviceTypesStore);

  let searchTerm = $state('');

  const filteredServiceTypes = $derived(
    approvedServiceTypes.filter((serviceType) => {
      if (!searchTerm) return true;
      const lowerSearchTerm = searchTerm.toLowerCase();
      return (
        serviceType.name.toLowerCase().includes(lowerSearchTerm) ||
        serviceType.description.toLowerCase().includes(lowerSearchTerm) ||
        (serviceType.tags &&
          serviceType.tags.some((tag) => tag.toLowerCase().includes(lowerSearchTerm)))
      );
    })
  );

  async function loadApprovedServiceTypes() {
    pageState.isLoading = true;
    pageState.error = null;

    try {
      await runEffect(serviceTypesStore.getApprovedServiceTypes());
    } catch (error) {
      pageState.error = error instanceof Error ? error.message : 'Failed to load service types';
    } finally {
      pageState.isLoading = false;
    }
  }

  onMount(loadApprovedServiceTypes);
</script>

<section class="container mx-auto space-y-6 p-4">
  <div class="flex items-center justify-between">
    <h1 class="h1">Available Service Types</h1>
    {#if currentUser?.status?.status_type === 'accepted'}
      <a href="/service-types/suggest" class="variant-filled-primary btn"> Suggest a Service Type </a>
    {/if}
  </div>

  <!-- Search Input -->
  <div class="mb-4">
    <input
      type="search"
      bind:value={searchTerm}
      placeholder="Search by name, description, or tag..."
      class="input w-full max-w-md"
    />
  </div>

  <!-- Loading State -->
  {#if pageState.isLoading}
    <div class="flex items-center justify-center space-x-2 text-center">
      <span class="loading loading-spinner"></span>
      <span>Loading available services...</span>
    </div>

    <!-- Error State -->
  {:else if pageState.error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{pageState.error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={loadApprovedServiceTypes}> Try Again </button>
      </div>
    </div>

    <!-- Content -->
  {:else if filteredServiceTypes.length === 0 && approvedServiceTypes.length > 0 && searchTerm}
    <div class="card p-8 text-center">
      <h3 class="h3">No Service Types Found</h3>
      <p class="text-surface-600">
        No service types match your search for "{searchTerm}".
      </p>
    </div>
  {:else if approvedServiceTypes.length === 0}
    <div class="card p-8 text-center">
      <h3 class="h3">No Service Types Available</h3>
      <p class="text-surface-600">
        There are currently no approved service types. Please check back later.
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each filteredServiceTypes as serviceType (serviceType.original_action_hash?.toString())}
        <ServiceTypeCard {serviceType} showActions={false} />
      {/each}
    </div>
  {/if}
</section>
