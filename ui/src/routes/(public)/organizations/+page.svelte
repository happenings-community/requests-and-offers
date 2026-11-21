<script lang="ts">
  import { pageTitle } from '$lib/utils/page-title';
  import PageHeader from '$lib/components/shared/PageHeader.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import OrganizationsTable from '$lib/components/organizations/OrganizationsTable.svelte';
  import OrganizationFilterControls from '$lib/components/organizations/OrganizationFilterControls.svelte';
  import { useOrganizationsManagement } from '$lib/composables';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { ConicGradient, type ConicStop } from '@skeletonlabs/skeleton';
  import { paths } from '$lib/paths';

  const management = useOrganizationsManagement({ filter: 'accepted' });
  const { currentUser } = $derived(usersStore);

  // State for search-filtered results
  let searchFilteredOrganizations = $state<typeof management.organizations>([]);

  // Handle filtered results change from search component
  function handleFilteredResultsChange(filtered: typeof management.organizations) {
    searchFilteredOrganizations = filtered;
  }

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];

  onMount(() => {
    management.loadOrganizations();
    runEffect(usersStore.refreshCurrentUser()).catch((e) =>
      console.error('Failed to refresh the current user:', e)
    );
  });

  function handleCreateOrganization() {
    if (!currentUser) {
      // This case should ideally be handled by disabling the button,
      // but we keep it for robustness.
      return;
    }
    goto(paths.organizationCreate());
  }
</script>

<svelte:head>
  <title>{pageTitle('Organizations')}</title>
</svelte:head>

<section class="container mx-auto flex flex-col gap-8 p-4">
  <PageHeader title="Organizations" subtitle="Groups and projects in the community">
    {#snippet actions()}
      {#if currentUser}
        <button onclick={handleCreateOrganization} class="variant-filled-primary btn btn-sm">
          Create Organization
        </button>
      {/if}
    {/snippet}
  </PageHeader>

  {#if management.error}
    <div class="alert variant-filled-error">
      <p>{management.error}</p>
      <button class="variant-soft btn btn-sm" onclick={management.loadOrganizations}>
        Try Again
      </button>
    </div>
  {/if}

  {#if management.isLoading}
    <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
  {:else}
    <!-- Search Controls -->
    <OrganizationFilterControls
      organizations={management.organizations}
      onFilteredResultsChange={handleFilteredResultsChange}
    />

    {#if searchFilteredOrganizations.length > 0}
      <OrganizationsTable organizations={searchFilteredOrganizations} />
    {:else if management.organizations.length === 0}
      <p class="text-surface-500">No organizations found.</p>
    {:else}
      <p class="text-surface-500">No organizations match your search.</p>
    {/if}
  {/if}
</section>
