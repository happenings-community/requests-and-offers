<script lang="ts">
  import { fade } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { useOffersManagement } from '$lib/composables';
  import OffersTable from '$lib/components/offers/OffersTable.svelte';
  import OfferFilterControls from '$lib/components/offers/OfferFilterControls.svelte';
  import ProfileGuard from '$lib/components/common/ProfileGuard.svelte';
  import usersStore from '$lib/stores/users.store.svelte';

  // Use the composable for all state management and operations
  const management = useOffersManagement();

  // State for search-filtered results
  let searchFilteredOffers = $state<typeof management.filteredOffers>([]);

  // Computed empty state message for smooth transitions
  const emptyStateMessage = $derived.by(() => {
    const messages = {
      active: {
        all: 'No active offers found. Create your first offer!',
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

  // Handle create offer action
  function handleCreateOffer() {
    goto('/offers/create');
  }

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
  <title>Offers | Happening Community</title>
</svelte:head>

<!-- SIMPLE WORKING VERSION -->
<ProfileGuard
  allowBrowsing={true}
  allowCreating={false}
  title="Profile Required for Creating Offers"
  description="Create a profile to make offers to the community."
>
  <div class="container mx-auto p-4">
    <!-- Tab Switcher -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex gap-2">
        <button
          class="btn btn-sm"
          class:variant-filled-primary={management.listingTab === 'active'}
          class:variant-ghost-primary={management.listingTab !== 'active'}
          onclick={() => management.setListingTab('active')}
        >
          📋 Active Offers
        </button>
        <button
          class="btn btn-sm"
          class:variant-filled-warning={management.listingTab === 'archived'}
          class:variant-ghost-warning={management.listingTab !== 'archived'}
          onclick={() => management.setListingTab('archived')}
        >
          📦 Archived Offers
        </button>
      </div>
      <div>
        {#if usersStore.currentUser?.status?.status_type === 'accepted'}
          <button class="variant-filled-primary btn btn-sm" onclick={handleCreateOffer}>
            Create Offer
          </button>
        {:else if usersStore.currentUser}
          <button class="variant-soft btn btn-sm" disabled>
            Create Offer (Profile Approval Required)
          </button>
        {:else}
          <a href="/user/create" class="variant-filled-primary btn btn-sm">
            Create Profile to Make Offers
          </a>
        {/if}
      </div>
    </div>

    <!-- Filter Buttons -->
    <div class="mb-4 flex items-center gap-2">
      <button
        class="btn btn-sm"
        class:variant-filled-primary={management.filterType === 'all'}
        class:variant-ghost-primary={management.filterType !== 'all'}
        onclick={() => management.setFilterType('all')}
      >
        All
      </button>
      <button
        class="btn btn-sm"
        class:variant-filled-secondary={management.filterType === 'my'}
        class:variant-ghost-secondary={management.filterType !== 'my'}
        onclick={() => management.setFilterType('my')}
      >
        My
      </button>
      <button
        class="btn btn-sm"
        class:variant-filled-tertiary={management.filterType === 'organization'}
        class:variant-ghost-tertiary={management.filterType !== 'organization'}
        onclick={() => management.setFilterType('organization')}
      >
        Organization
      </button>
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
        <div class="text-center text-xl text-surface-500">
          <p>{emptyStateMessage}</p>
        </div>
      {/key}
    {:else}
      <OffersTable offers={searchFilteredOffers} showCreator={true} showOrganization={true} />
    {/if}
  </div>
</ProfileGuard>
