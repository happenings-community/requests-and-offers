<script lang="ts">
  import usersStore from '@stores/users.store.svelte';
  import NavButton from '@components/shared/NavButton.svelte';
  import UserProfile from '@components/users/UserProfile.svelte';
  const { currentUser } = $derived(usersStore);

  let error = $state<string | null>(null);

  async function fetchUserData() {
    try {
      await usersStore.refreshCurrentUser();

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
    <UserProfile user={currentUser} isCurrentUser />
  {/if}
</section>
