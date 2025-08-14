<script lang="ts">
  import { onMount } from 'svelte';
  import ServiceTypesTable from '$lib/components/service-types/ServiceTypesTable.svelte';
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
        searchOptions={{ enableSorting: true, initialSortField: 'type', initialSortDirection: 'asc' }}
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
  {:else}
    <!-- Service Types Table -->
    <ServiceTypesTable
      serviceTypes={[...management.serviceTypes]}
      filteredServiceTypes={[...management.filteredServiceTypes]}
      totalFilteredCount={management.filteredServiceTypes.length}
      isLoading={management.isLoading}
      error={management.error || management.storeError}
      onDeleteServiceType={() => {}}
      onRetry={management.loadServiceTypes}
      enableSorting={true}
      showActions={false}
    />
  {/if}
</section>
