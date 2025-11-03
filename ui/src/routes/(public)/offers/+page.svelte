<script lang="ts">
  import { goto } from '$app/navigation';
  import { useOffersManagement } from '$lib/composables';
  import OffersTable from '$lib/components/offers/OffersTable.svelte';
  import ProfileGuard from '$lib/components/common/ProfileGuard.svelte';
  import usersStore from '$lib/stores/users.store.svelte';

  // Use the composable for all state management and operations
  const management = useOffersManagement();

  // Handle create offer action
  function handleCreateOffer() {
    goto('/offers/create');
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
    <div class="mb-4 flex items-center justify-between">
      <h1 class="h1">Offers</h1>
      {#if usersStore.currentUser?.status?.status_type === 'accepted'}
        <button class="variant-filled-primary btn" onclick={handleCreateOffer}>
          Create Offer
        </button>
      {:else if usersStore.currentUser}
        <button class="variant-soft btn" disabled>
          Create Offer (Profile Approval Required)
        </button>
      {:else}
        <a href="/user/create" class="variant-filled-primary btn">
          Create Profile to Make Offers
        </a>
      {/if}
    </div>

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
    {:else if management.filteredOffers.length === 0}
      <div class="text-center text-xl text-surface-500">
        {#if management.filterType === 'all'}
          No offers found. Create your first offer!
        {:else if management.filterType === 'my'}
          You haven't created any offers yet.
        {:else}
          No organization offers found.
        {/if}
      </div>
    {:else}
      <OffersTable offers={management.filteredOffers} showCreator={true} showOrganization={true} />
    {/if}
  </div>
</ProfileGuard>
