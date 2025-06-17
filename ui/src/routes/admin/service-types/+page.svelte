<script lang="ts">
  import { onMount } from 'svelte';
  import ServiceTypeSearch from '$lib/components/service-types/ServiceTypeSearch.svelte';
  import ServiceTypesActionBar from '$lib/components/service-types/ServiceTypesActionBar.svelte';
  import ServiceTypesGrid from '$lib/components/service-types/ServiceTypesGrid.svelte';
  import { useServiceTypesManagement, usePagination } from '$lib/composables';
  import Pagination from '$lib/components/shared/Pagination.svelte';

  // Use the composable for all state management and operations
  const management = useServiceTypesManagement();
  const pagination = usePagination({
    items: management.filteredServiceTypes,
    initialPage: 1,
    pageSize: 9, // 3x3 grid
    pageSizeOptions: [9, 12, 15, 24]
  });

  onMount(async () => {
    await management.initialize();
  });

  // Refresh data when the page becomes visible again (e.g., returning from create page)
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

  // Update pagination when filtered results change
  $effect(() => {
    pagination.updateItems(management.filteredServiceTypes);
  });
</script>

<section class="space-y-6">
  <!-- Action Bar -->
  <ServiceTypesActionBar
    pendingCount={management.pendingCount}
    isLoading={management.isLoading}
    onCreateMockServiceTypes={management.createMockServiceTypes}
  />

  <!-- Search and Filter Controls -->
  <div class="mb-6">
    {#key management.searchKey}
      <ServiceTypeSearch
        serviceTypes={[...management.serviceTypes]}
        onFilteredResultsChange={management.handleFilteredResultsChange}
        searchOptions={{ tagCloudBehavior: 'toggle' }}
      />
    {/key}
  </div>

  <!-- Service Types Grid -->
  <ServiceTypesGrid
    serviceTypes={[...pagination.paginatedItems]}
    filteredServiceTypes={management.filteredServiceTypes}
    isLoading={management.isLoading}
    error={management.error || management.storeError}
    onDeleteServiceType={management.deleteServiceType}
    onRetry={management.loadServiceTypes}
  />
  
  <Pagination {pagination} />
</section>
