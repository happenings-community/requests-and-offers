<script lang="ts">
  import { onMount } from 'svelte';
  import MyListings from '$lib/components/shared/listings/MyListings.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';

  // Initialize stores
  const toastStore = getToastStore();

  // State
  let currentUserHash: Uint8Array | null = $state(null);
  let loading: boolean = $state(false);
  let error: string | null = $state(null);

  // Load current user
  async function loadCurrentUser() {
    loading = true;
    error = null;

    try {
      const user = usersStore.currentUser;
      if (user?.original_action_hash) {
        currentUserHash = user.original_action_hash;
      } else {
        error = 'Please create or complete your user profile to access your listings.';
      }
    } catch (err) {
      console.error('Failed to load current user:', err);
      error = err instanceof Error ? err.message : 'Unknown error';
      toastStore.trigger({
        message: 'Failed to load user profile',
        background: 'variant-filled-error'
      });
    } finally {
      loading = false;
    }
  }

  // Initialize
  onMount(() => {
    loadCurrentUser();
  });
</script>

<svelte:head>
  <title>My Listings - Requests & Offers</title>
  <meta
    name="description"
    content="Manage your requests and offers in the Requests & Offers platform."
  />
</svelte:head>

<div class="container mx-auto space-y-6 p-4">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="h1 font-bold">My Listings</h1>
      <p class="text-surface-600 dark:text-surface-400">Manage your requests and offers</p>
    </div>
  </div>

  {#if loading}
    <div class="card p-8 text-center">
      <p>Loading your profile...</p>
    </div>
  {:else if error}
    <div class="card p-8 text-center">
      <h2 class="h3 mb-2">Welcome!</h2>
      <p class="mb-4 text-surface-600 dark:text-surface-400">
        {error}
      </p>
      <a href="/user/create" class="variant-filled-primary btn"> Create Profile </a>
    </div>
  {:else if currentUserHash}
    <MyListings userHash={currentUserHash} />
  {/if}
</div>
