<script lang="ts">
  import administrationStore from '@/stores/administration.store.svelte';
  import type { UIUser } from '@/types/ui';
  import UsersTable from '@lib/tables/UsersTable.svelte';
  import { ConicGradient, type ConicStop, getToastStore } from '@skeletonlabs/skeleton';

  const toastStore = getToastStore();

  let isLoading = $state(true);
  let error = $state<string | null>(null);
  const { allUsers } = $derived(administrationStore);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  // Derived stores for different user categories
  const usersByStatus = $derived({
    pending: allUsers.filter((user) => user.status?.status_type === 'pending'),
    accepted: allUsers.filter((user) => user.status?.status_type === 'accepted'),
    rejected: allUsers.filter((user) => user.status?.status_type === 'rejected'),
    temporarilySuspended: allUsers.filter(
      (user) => user.status?.status_type === 'suspended temporarily'
    ),
    indefinitelySuspended: allUsers.filter(
      (user) => user.status?.status_type === 'suspended indefinitely'
    )
  });

  $inspect('allUsers', allUsers);
  $inspect(
    'usersStatus',
    allUsers.map((user) => user.status)
  );

  const userCategories = $derived([
    { title: 'Pending Users', users: usersByStatus.pending, titleClass: 'text-primary-400' },
    { title: 'Accepted Users', users: usersByStatus.accepted, titleClass: 'text-green-600' },
    {
      title: 'Temporarily Suspended Users',
      users: usersByStatus.temporarilySuspended,
      titleClass: 'text-orange-600'
    },
    {
      title: 'Indefinitely Suspended Users',
      users: usersByStatus.indefinitelySuspended,
      titleClass: 'text-gray-600'
    },
    { title: 'Rejected Users', users: usersByStatus.rejected, titleClass: 'text-red-600' }
  ]);

  async function loadUsers() {
    try {
      isLoading = true;
      error = null;
      await administrationStore.getAllUsers();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load users';
      const t = {
        message: 'Failed to load users. Please try again.',
        background: 'variant-filled-error',
        autohide: true,
        timeout: 5000
      };
      toastStore.trigger(t);
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    loadUsers();
  });
</script>

<section class="flex flex-col gap-10">
  <h1 class="h1 text-center">Users Management</h1>

  <div class="flex justify-center gap-4">
    <a href="/admin/users/status-history" class="btn variant-ghost-secondary w-fit">
      Status History
    </a>
    {#if !isLoading && error}
      <button class="btn variant-filled-primary" onclick={loadUsers}> Retry Loading </button>
    {/if}
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center gap-2">
      <ConicGradient stops={conicStops} spin />
      <p>Loading users...</p>
    </div>
  {:else if error}
    <div class="alert variant-filled-error">
      <span class="text-white">{error}</span>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
      {#each userCategories as { title, users, titleClass }}
        {@render usersTable(title, users, titleClass)}
      {/each}
    </div>
  {/if}
</section>

{#snippet usersTable(title: string, users: UIUser[], titleClass: string)}
  {#if title === 'Rejected Users' || title === 'Indefinitely Suspended Users'}
    <details class="flex flex-col gap-4 border-b-2 border-slate-900 pb-4">
      <summary class="h3 {titleClass}">{title} ({users.length})</summary>
      {#if users.length > 0}
        <UsersTable {users} />
      {:else}
        <p class="text-surface-500 text-center">No {title.toLowerCase()}</p>
      {/if}
    </details>
  {:else}
    <div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-4">
      <h2 class="h3 {titleClass}">{title} ({users.length})</h2>
      {#if users.length > 0}
        <UsersTable {users} />
      {:else}
        <p class="text-surface-500 text-center">No {title.toLowerCase()}</p>
      {/if}
    </div>
  {/if}
{/snippet}
