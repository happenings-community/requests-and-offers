<script lang="ts">
  import { pageTitle } from '$lib/utils/page-title';
  import PageHeader from '$lib/components/shared/PageHeader.svelte';
  import { useOffersManagement } from '$lib/composables';
  import OffersTable from '$lib/components/offers/OffersTable.svelte';
  import OfferFilterControls from '$lib/components/offers/OfferFilterControls.svelte';
  import ProfileGuard from '$lib/components/common/ProfileGuard.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { paths } from '$lib/paths';

  // Use the composable for all state management and operations
  const management = useOffersManagement();

  // State for search-filtered results
  let searchFilteredOffers = $state<typeof management.filteredOffers>([]);

  const emptyStateMessage = $derived.by(() => {
    const messages = {
      active: {
        all: 'No active offers yet.',
        my: "You haven't created any active offers yet.",
        organization: 'No active organization offers found.'
      },
      archived: {
        all: 'No archived offers found.',
        my: "You don't have any archived offers.",
        organization: 'No archived organization offers found.'
      }
    };
    return messages[management.listingTab][management.filterType];
  });

  // Handle filtered results change from search component
  function handleFilteredResultsChange(filtered: typeof management.filteredOffers) {
    searchFilteredOffers = filtered;
  }

  // Initialize on mount
  $effect(() => {
    management.initialize();
  });
</script>

<svelte:head>
  <title>{pageTitle('Offers')}</title>
</svelte:head>

<!-- SIMPLE WORKING VERSION -->
<ProfileGuard
  allowBrowsing={true}
  allowCreating={false}
  title="Profile Required for Creating Offers"
  description="Create a profile to make offers to the community."
  blockedAction="view or create offers"
>
  <div class="container mx-auto space-y-6 p-4">
    <PageHeader title="Offers" subtitle="What members are offering">
      {#snippet actions()}
        {#if usersStore.currentUser?.status?.status_type === 'accepted'}
          <a href={paths.offerCreate()} class="variant-filled-warning btn btn-sm">+ Offer</a>
        {:else if usersStore.currentUser}
          <button class="variant-filled-warning btn btn-sm" disabled>+ Offer</button>
          <span class="text-sm text-surface-500">Once your profile is approved</span>
        {:else}
          <a href={paths.myProfileCreate()} class="variant-filled-primary btn btn-sm">
            Create a profile to post offers
          </a>
        {/if}
      {/snippet}
    </PageHeader>

    <!-- Which offers, and whose: toggle buttons in My Exchanges' style, violet when chosen -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Active or archived offers">
        {#each [['active', 'Active Offers'], ['archived', 'Archived Offers']] as const as [tab, label] (tab)}
          <button
            class="btn btn-sm {management.listingTab === tab
              ? 'variant-filled-primary'
              : 'variant-ghost'}"
            aria-pressed={management.listingTab === tab}
            onclick={() => management.setListingTab(tab)}
          >
            {label}
          </button>
        {/each}
      </div>
      <div class="flex flex-wrap gap-2" role="group" aria-label="Whose offers">
        {#each [['all', 'All'], ['my', 'My'], ['organization', 'Organization']] as const as [filter, label] (filter)}
          <button
            class="btn btn-sm {management.filterType === filter
              ? 'variant-filled-primary'
              : 'variant-ghost'}"
            aria-pressed={management.filterType === filter}
            onclick={() => management.setFilterType(filter)}
          >
            {label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Search Controls -->
    <OfferFilterControls
      offers={management.filteredOffers}
      onFilteredResultsChange={handleFilteredResultsChange}
    />

    {#if management.isLoading || management.storeLoading}
      <div class="flex h-64 items-center justify-center">
        <div class="flex items-center gap-4">
          <span class="animate-spin text-2xl">⏳</span>
          <p class="text-lg">Loading offers...</p>
        </div>
      </div>
    {:else if !management.hasInitialized}
      <div class="flex h-64 items-center justify-center">
        <p class="text-surface-500">Initializing...</p>
      </div>
    {:else if searchFilteredOffers.length === 0}
      {#key `${management.listingTab}-${management.filterType}`}
        <div class="card space-y-3 p-6 text-center">
          <!-- A search that matches none of a list that has some: say so, with nothing to create. -->
          {#if management.filteredOffers.length > 0}
            <p class="text-surface-500">No offers match your search.</p>
          {:else}
            <p class="text-surface-500">{emptyStateMessage}</p>
          {/if}
          {#if management.filteredOffers.length === 0 && management.listingTab === 'active' && management.filterType !== 'organization' && usersStore.currentUser?.status?.status_type === 'accepted'}
            <a href={paths.offerCreate()} class="variant-filled-warning btn">Create an offer</a>
          {/if}
        </div>
      {/key}
    {:else}
      <OffersTable offers={searchFilteredOffers} showCreator={true} showOrganization={true} />
    {/if}
  </div>
</ProfileGuard>
