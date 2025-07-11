<script lang="ts">
  import { page } from '$app/state';
  import type { UIUser } from '$lib/types/ui';
  import usersStore from '$lib/stores/users.store.svelte';
  import { decodeHashFromBase64 } from '@holochain/client';
  import UserProfile from '$lib/components/users/UserProfile.svelte';
  import { Effect as E } from 'effect';

  const userHash = decodeHashFromBase64(page.params.id);
  const { currentUser } = $derived(usersStore);

  let user = $state<UIUser | null>(null);
  let error = $state<string | null>(null);

  async function fetchUserData() {
    try {
      user = await E.runPromise(usersStore.getUserByActionHash(userHash));

      if (!user) {
        error = 'User not found';
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
</script>

{#if error}
  <div class="alert variant-filled-error">
    <p>{error}</p>
  </div>
{:else if !user}
  <p class="mb-4 text-center text-xl">Loading user profile...</p>
{:else}
  <UserProfile
    {user}
    isCurrentUser={currentUser?.original_action_hash === user.original_action_hash}
  />
{/if}
