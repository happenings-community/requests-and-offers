<script lang="ts">
  import { onMount } from 'svelte';
  import ServiceTypeSearch from '$lib/components/service-types/ServiceTypeSearch.svelte';
  import ServiceTypesActionBar from '$lib/components/service-types/ServiceTypesActionBar.svelte';
  import ServiceTypesGrid from '$lib/components/service-types/ServiceTypesGrid.svelte';
  import { useServiceTypesManagement } from '$lib/composables/useServiceTypesManagement.svelte';

  // Use the composable for all state management and operations
  const management = useServiceTypesManagement();

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
</script>

<section class="space-y-6">
  <!-- Action Bar -->
  <ServiceTypesActionBar
    pendingCount={management.pendingCount}
    isLoading={management.state.isLoading}
    onCreateMockServiceTypes={management.createMockServiceTypes}
  />

  <!-- Search and Filter Controls -->
  <div class="mb-6">
    {#key management.state.searchKey}
      <ServiceTypeSearch
        serviceTypes={management.serviceTypes}
        onFilteredResultsChange={management.handleFilteredResultsChange}
        searchOptions={{ tagCloudBehavior: 'toggle' }}
      />
    {/key}
  </div>

  <!-- Service Types Grid -->
  <ServiceTypesGrid
    serviceTypes={management.serviceTypes}
    filteredServiceTypes={management.state.filteredServiceTypes}
    isLoading={management.state.isLoading}
    error={management.state.error || management.storeError}
    onDeleteServiceType={management.deleteServiceType}
    onRetry={management.loadServiceTypes}
  />
</section>
