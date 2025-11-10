<script lang="ts">
  import { onMount } from 'svelte';
  import { useUsersManagement } from '$lib/composables';
  import UserFilterControls from '$lib/components/users/UserFilterControls.svelte';
  import type { UIUser } from '$lib/types/ui';
  import { ConicGradient, type ConicStop } from '@skeletonlabs/skeleton';
  import UsersTable from '$lib/components/users/UsersTable.svelte';
  import { runEffect } from '@/lib/utils/effect';

  const management = useUsersManagement();

  let filteredUsers: UIUser[] = $state([...management.users]);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  const userCategories = $derived([
    {
      title: 'Pending Users',
      users: filteredUsers.filter((u) => u.status?.status_type === 'pending'),
      titleClass: 'text-primary-400'
    },
    {
      title: 'Accepted Users',
      users: filteredUsers.filter((u) => u.status?.status_type === 'accepted'),
      titleClass: 'text-green-600'
    },
    {
      title: 'Temporarily Suspended Users',
      users: filteredUsers.filter((u) => u.status?.status_type === 'suspended temporarily'),
      titleClass: 'text-orange-600'
    },
    {
      title: 'Indefinitely Suspended Users',
      users: filteredUsers.filter((u) => u.status?.status_type === 'suspended indefinitely'),
      titleClass: 'text-gray-600'
    },
    {
      title: 'Rejected Users',
      users: filteredUsers.filter((u) => u.status?.status_type === 'rejected'),
      titleClass: 'text-red-600'
    }
  ]);

  onMount(() => {
    runEffect(management.loadUsers());
  });
</script>

<section class="flex flex-col gap-10">
  <h1 class="h1 text-center">Users Management</h1>

  <!-- User Search and Filter Controls -->
  {#if management.users.length > 0}
    <div class="mx-auto w-full max-w-4xl">
      <UserFilterControls
        users={[...management.users]}
        onFilteredResultsChange={(filtered) => (filteredUsers = filtered)}
        showStatistics={true}
        searchOptions={{ debounceMs: 300 }}
      />
    </div>
  {/if}

  <div class="flex justify-center gap-4">
    <a href="/admin/users/status-history" class="variant-ghost-secondary btn w-fit">
      Status History
    </a>
    {#if !management.isLoading && management.error}
      <button class="variant-filled-primary btn" onclick={management.loadUsers}>
        Retry Loading
      </button>
    {/if}
  </div>

  {#if management.isLoading}
    <div class="flex items-center justify-center gap-2">
      <ConicGradient stops={conicStops} spin />
      <p>Loading users...</p>
    </div>
  {:else if management.error}
    <div class="alert variant-filled-error">
      <span class="text-white">{management.error}</span>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
      {#each userCategories as { title, users, titleClass }}
        {@render usersTables(title, users, titleClass)}
      {/each}
    </div>
  {/if}
</section>

{#snippet usersTables(title: string, users: UIUser[], titleClass: string)}
  {#if title === 'Rejected Users' || title === 'Indefinitely Suspended Users'}
    <details class="flex flex-col gap-4 border-b-2 border-slate-900 pb-4">
      <summary class="h3 {titleClass}">{title} ({users.length})</summary>
      {#if users.length > 0}
        <UsersTable {users} />
      {:else}
        <p class="text-center text-surface-500">No {title.toLowerCase()}</p>
      {/if}
    </details>
  {:else}
    <div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-4">
      <h2 class="h3 {titleClass}">{title} ({users.length})</h2>
      {#if users.length > 0}
        <UsersTable {users} />
      {:else}
        <p class="text-center text-surface-500">No {title.toLowerCase()}</p>
      {/if}
    </div>
  {/if}
{/snippet}
