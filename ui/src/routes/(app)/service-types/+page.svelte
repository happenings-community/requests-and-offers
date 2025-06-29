<script lang="ts">
  import { onMount } from 'svelte';
  import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';
  import ServiceTypeSearch from '$lib/components/service-types/ServiceTypeSearch.svelte';
  import { useServiceTypesManagement } from '$lib/composables';
  import usersStore from '$lib/stores/users.store.svelte';

  // Use the standardized composable in public mode (only approved service types)
  const management = useServiceTypesManagement();
  const { currentUser } = $derived(usersStore);

  onMount(async () => {
    await management.initialize();
  });

  // Refresh data when the page becomes visible again (e.g., returning from suggest page)
  $effect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) {
        management.loadServiceTypes();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>

<section class="container mx-auto space-y-6 p-4">
  <div class="flex items-center justify-between">
    <h1 class="h1">Available Service Types</h1>
    {#if currentUser?.status?.status_type === 'accepted'}
      <a href="/service-types/suggest" class="variant-filled-primary btn">
        Suggest a Service Type
      </a>
    {/if}
  </div>

  <!-- Search and Filter Section -->
  <div class="mb-6">
    {#key management.searchKey}
      <ServiceTypeSearch
        serviceTypes={[...management.serviceTypes]}
        onFilteredResultsChange={management.handleFilteredResultsChange}
        searchOptions={{ tagCloudBehavior: 'add-only' }}
      />
    {/key}
  </div>

  <!-- Loading State -->
  {#if management.isLoading}
    <div class="flex items-center justify-center space-x-2 text-center">
      <span class="loading loading-spinner"></span>
      <span>Loading available services...</span>
    </div>

    <!-- Error State -->
  {:else if management.error || management.storeError}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{management.error || management.storeError}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={() => management.loadServiceTypes()}>
          Try Again
        </button>
      </div>
    </div>

    <!-- Content -->
  {:else if management.filteredServiceTypes.length === 0 && management.serviceTypes.length > 0}
    <div class="card p-8 text-center">
      <h3 class="h3">No Service Types Found</h3>
      <p class="text-surface-600">No service types match your current search criteria.</p>
    </div>
  {:else if management.serviceTypes.length === 0}
    <div class="card p-8 text-center">
      <h3 class="h3">No Service Types Available</h3>
      <p class="text-surface-600">
        There are currently no approved service types. Please check back later.
      </p>
    </div>
  {:else}
    <!-- Service Types Grid -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="h2">Service Types ({management.filteredServiceTypes.length})</h2>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each management.filteredServiceTypes as serviceType (serviceType.original_action_hash?.toString() || `${serviceType.name}-${serviceType.description.slice(0, 10)}`)}
          <ServiceTypeCard {serviceType} showActions={false} />
        {/each}
      </div>
    </div>
  {/if}
</section>
