<script lang="ts">
  import NavButton from '$lib/components/shared/NavButton.svelte';
  import UsersTable from '$lib/components/users/UsersTable.svelte';
  import UserFilterControls from '$lib/components/users/UserFilterControls.svelte';
  import { type ConicStop, ConicGradient } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { UIUser } from '@/lib/composables';

  const { currentUser, acceptedUsers, loading } = $derived(usersStore);

  $inspect('users:', acceptedUsers);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];

  let error = $state<string | null>(null);
  let filteredUsers: UIUser[] = $state([]);

  $effect(() => {
    runEffect(usersStore.getAcceptedUsers()).catch((error) => {
      console.error('Failed to load users:', error);
    });
  });

  // Update filtered users when accepted users change
  $effect(() => {
    filteredUsers = acceptedUsers;
  });
</script>

<section class="flex flex-col gap-4">
  <h2 class="h1 text-center">Users</h2>
  <div class="flex w-full gap-4">
    {#if !currentUser}
      <NavButton href="/user/create">Create Profile</NavButton>
    {/if}
  </div>

  <!-- Add UserFilterControls component -->
  {#if acceptedUsers.length > 0}
    <UserFilterControls
      users={acceptedUsers}
      onFilteredResultsChange={(filtered) => (filteredUsers = filtered)}
    />
  {/if}

  {#if filteredUsers.length}
    <UsersTable users={filteredUsers} />
  {:else if error}
    <p class="h3 text-error-500">{error}</p>
  {:else if acceptedUsers.length > 0}
    <p class="h3 text-error-500">No users found matching your criteria.</p>
  {:else}
    <p class="h3 text-error-500">No users found.</p>
  {/if}
  {#if loading && acceptedUsers.length === 0}
    <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
  {/if}
</section>
