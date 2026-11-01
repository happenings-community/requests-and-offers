<script lang="ts">
  import { page } from '$app/state';
  import type { UIUser } from '$lib/types/ui';
  import usersStore from '$lib/stores/users.store.svelte';
  import { decodeHashFromBase64 } from '@holochain/client';
  import UserProfile from '$lib/components/users/UserProfile.svelte';
  import { contactAbout } from '$lib/components/shared/contact-about.svelte';
  import { formatUserName } from '$lib/schemas/users.schemas';
  import { runEffect } from '$lib/utils/effect';

  const userHash = page.params.id ? decodeHashFromBase64(page.params.id) : null;
  const { currentUser } = $derived(usersStore);

  let user = $state<UIUser | null>(null);

  // Whether this is the member's own profile. The footer's "Contact admin"
  // names the profile only when it is someone else's.
  const isMe = $derived(
    !!(
      user &&
      currentUser?.original_action_hash &&
      user.original_action_hash.toString() === currentUser.original_action_hash.toString()
    )
  );
  let error = $state<string | null>(null);

  async function fetchUserData() {
    try {
      if (!userHash) {
        error = 'Invalid user ID';
        return;
      }
      user = await runEffect(usersStore.getUserByActionHash(userHash));

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

  $effect(() => {
    contactAbout.set(user && !isMe ? { type: 'profile', title: formatUserName(user.name) } : null);
    return () => contactAbout.set(null);
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
