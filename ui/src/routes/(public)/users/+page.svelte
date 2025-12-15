<script lang="ts">
  import NavButton from '$lib/components/shared/NavButton.svelte';
  import UsersTable from '$lib/components/users/UsersTable.svelte';
  import UserFilterControls from '$lib/components/users/UserFilterControls.svelte';
  import { type ConicStop, ConicGradient } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { isTestModeUserListEnabled } from '$lib/services/devFeatures.service';
  import type { UIUser } from '@/lib/composables';

  const { currentUser, acceptedUsers, loading } = $derived(usersStore);

  $inspect('users:', acceptedUsers);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];

  let error = $state<string | null>(null);
  let filteredUsers: UIUser[] = $state([]);
  let networkPeers: string[] = $state([]);
  let showTestMode = $state(false);

  // Check if test mode is enabled
  const isTestMode = isTestModeUserListEnabled();

  $effect(() => {
    runEffect(usersStore.getAcceptedUsers()).catch((error) => {
      console.error('Failed to load users:', error);
    });
  });

  // Load network peers if in test mode
  $effect(() => {
    if (isTestMode) {
      loadNetworkPeers();
    }
  });

  // Update filtered users when accepted users change
  $effect(() => {
    filteredUsers = acceptedUsers;
  });

  async function loadNetworkPeers() {
    try {
      const peers = await runEffect(usersStore.getNetworkPeers());
      networkPeers = peers;
      showTestMode = peers.length > 0;
    } catch (error) {
      console.error('Failed to load network peers:', error);
      showTestMode = false;
    }
  }
</script>

<section class="flex flex-col gap-4">
  <h2 class="h1 text-center">Users</h2>

  <!-- Test mode banner -->
  {#if showTestMode}
    <div class="alert variant-ghost-warning" role="alert">
      <div class="alert-message">
        <strong>⚠️ Test Mode Active:</strong> Showing all network peers (including non-user agents)
      </div>
    </div>
  {/if}

  <div class="flex w-full gap-4">
    {#if !currentUser}
      <NavButton href="/user/create">Create Profile</NavButton>
    {/if}
  </div>

  <!-- Network peers section (test mode only) -->
  {#if showTestMode && networkPeers.length > 0}
    <div class="test-peers-section">
      <h3 class="h4 mb-4">All Network Peers (Test Mode)</h3>
      <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each networkPeers as peer (peer)}
          <div class="card variant-ghost p-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 font-bold text-white"
              >
                {peer[0]?.toUpperCase() || '?'}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">Network Peer</p>
                <p class="text-xs text-surface-500">
                  ID: {peer.slice(0, 16)}...
                </p>
                <p class="text-xs text-surface-600">Connected Peer</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
      <hr class="divider" />
    </div>
  {/if}

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
