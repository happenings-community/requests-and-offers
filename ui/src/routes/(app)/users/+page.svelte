<script lang="ts">
  import NavButton from '$lib/components/shared/NavButton.svelte';
  import UsersTable from '$lib/components/users/UsersTable.svelte';
  import { type ConicStop, ConicGradient } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';

  const { currentUser, acceptedUsers } = $derived(usersStore);

  $inspect('users:', acceptedUsers);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];

  let isLoading = $state(true);
  let error = $state<string | null>(null);

  async function loadUsers() {
    try {
      isLoading = true;
      error = null;
      await usersStore.getAcceptedUsers();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load users';
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    loadUsers();
  });
</script>

<section class="flex flex-col gap-4">
  <h2 class="h1 text-center">Users</h2>
  <div class="flex w-full gap-4">
    {#if !currentUser}
      <NavButton href="/user/create">Create Profile</NavButton>
    {/if}
  </div>
  {#if acceptedUsers.length}
    <UsersTable users={acceptedUsers} />
  {:else if error}
    <p class="h3 text-error-500">{error}</p>
  {:else}
    <p class="h3 text-error-500">No users found.</p>
  {/if}
  {#if isLoading && acceptedUsers.length === 0}
    <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
  {/if}
</section>
