<script lang="ts">
  import { onMount } from 'svelte';
  import { ConicGradient, type ConicStop, getToastStore } from '@skeletonlabs/skeleton';
  import { useOrganizationsManagement } from '$lib/composables';
  import OrganizationsTable from '$lib/components/organizations/OrganizationsTable.svelte';
  import OrganizationFilterControls from '$lib/components/organizations/OrganizationFilterControls.svelte';

  const management = useOrganizationsManagement();

  // State for search-filtered results
  let searchFilteredOrganizations = $state<typeof management.organizations>([]);

  // Handle filtered results change from search component
  function handleFilteredResultsChange(filtered: typeof management.organizations) {
    searchFilteredOrganizations = filtered;
  }

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  const organizationCategories = $derived([
    {
      title: 'Pending Organizations',
      organizations: searchFilteredOrganizations.filter((o) => o.status?.status_type === 'pending'),
      titleClass: 'text-primary-400'
    },
    {
      title: 'Accepted Organizations',
      organizations: searchFilteredOrganizations.filter(
        (o) => o.status?.status_type === 'accepted'
      ),
      titleClass: 'text-green-600'
    },
    {
      title: 'Temporarily Suspended Organizations',
      organizations: searchFilteredOrganizations.filter(
        (o) => o.status?.status_type === 'suspended temporarily'
      ),
      titleClass: 'text-orange-600'
    },
    {
      title: 'Indefinitely Suspended Organizations',
      organizations: searchFilteredOrganizations.filter(
        (o) => o.status?.status_type === 'suspended indefinitely'
      ),
      titleClass: 'text-gray-600'
    },
    {
      title: 'Rejected Organizations',
      organizations: searchFilteredOrganizations.filter(
        (o) => o.status?.status_type === 'rejected'
      ),
      titleClass: 'text-red-600'
    }
  ]);

  onMount(() => {
    management.loadOrganizations();
  });
</script>

<section class="flex flex-col gap-10">
  <h1 class="h1 text-center">Organizations Management</h1>

  <div class="flex justify-center gap-4">
    <a href="/admin/organizations/status-history" class="variant-ghost-secondary btn w-fit">
      Status History
    </a>
    {#if !management.isLoading && management.error}
      <button class="variant-filled-primary btn" onclick={management.loadOrganizations}>
        Retry Loading
      </button>
    {/if}
  </div>

  {#if management.isLoading}
    <div class="flex items-center justify-center gap-2">
      <ConicGradient stops={conicStops} spin />
      <p>Loading organizations...</p>
    </div>
  {:else if management.error}
    <div class="alert variant-filled-error">
      <span class="text-white">{management.error}</span>
    </div>
  {:else}
    <!-- Search Controls -->
    <OrganizationFilterControls
      organizations={management.organizations}
      onFilteredResultsChange={handleFilteredResultsChange}
    />

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
      {#each organizationCategories as { title, organizations, titleClass }}
        <div class="card p-4">
          <h3 class="h4 mb-4 {titleClass}">{title}</h3>
          <OrganizationsTable {organizations} />
        </div>
      {/each}
    </div>
  {/if}
</section>
