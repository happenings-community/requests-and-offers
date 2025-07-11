<script lang="ts">
  import { onMount } from 'svelte';
  import ServiceTypeSearch from '$lib/components/service-types/ServiceTypeSearch.svelte';
  import ServiceTypesActionBar from '$lib/components/service-types/ServiceTypesActionBar.svelte';
  import ServiceTypesGrid from '$lib/components/service-types/ServiceTypesGrid.svelte';
  import ServiceTypesInitializer from '$lib/components/service-types/ServiceTypesInitializer.svelte';
  import { useServiceTypesManagement } from '$lib/composables';

  // Use the composable in admin mode, but only display approved service types
  // Pending service types are handled separately in the moderation page
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
  <ServiceTypesActionBar pendingCount={management.pendingCount} />

  <!-- Initialization Section -->
  <div class="mb-8">
    <ServiceTypesInitializer />
  </div>

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
    serviceTypes={management.filteredServiceTypes}
    filteredServiceTypes={management.filteredServiceTypes}
    totalFilteredCount={management.filteredServiceTypes.length}
    isLoading={management.isLoading}
    error={management.error || management.storeError}
    onDeleteServiceType={management.deleteServiceType}
    onRetry={management.loadServiceTypes}
  />
</section>
