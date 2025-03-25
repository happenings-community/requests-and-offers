<script lang="ts">
  import usersStore from '@/stores/users.store.svelte';
  import NavButton from '@lib/NavButton.svelte';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  const { currentUser } = $derived(usersStore);

  let error = $state<string | null>(null);

  async function fetchUserData() {
    try {
      console.log('currentUser', currentUser);

      if (!currentUser) {
        error = 'No user profile found';
        return;
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      error = 'Failed to load user data. Please try again later.';
    }
  }

  $effect(() => {
    fetchUserData();
  });

  $effect(() => {
    if (currentUser?.original_action_hash) {
      goto(`/users/${encodeHashToBase64(currentUser.original_action_hash)}`);
    }
  });
</script>

<section class="flex flex-col items-center">
  {#if error}
    <div class="alert variant-filled-error">
      <p>{error}</p>
    </div>
  {:else if !currentUser}
    <div class="flex flex-col items-center">
      <p class="mb-4 text-center text-xl">It looks like you don't have a user profile yet!</p>
      <NavButton href="/user/create">Create Profile</NavButton>
    </div>
  {:else}
    <p class="text-center">Redirecting to your profile...</p>
  {/if}
</section>
