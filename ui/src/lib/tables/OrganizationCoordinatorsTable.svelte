<script lang="ts">
  import { Avatar, getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import type { UIOrganization, UIUser } from '@/types/ui';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import usersStore from '@/stores/users.store.svelte';
  import { getUserPictureUrl } from '@/utils';

  type Props = {
    title?: string;
    organization: UIOrganization;
    searchQuery?: string;
    sortBy?: 'name' | 'status';
    sortOrder?: 'asc' | 'desc';
  };

  const {
    title,
    organization,
    searchQuery = '',
    sortBy = 'name',
    sortOrder = 'asc'
  }: Props = $props();

  let agentIsCoordinator = $state(false);
  let coordinators = $state<UIUser[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const modalStore = getModalStore();
  const toastStore = getToastStore();

  $effect(() => {
    loadCoordinators();
  });

  async function loadCoordinators() {
    if (!organization.original_action_hash) return;

    try {
      loading = true;
      error = null;
      const coordinatorLinks = await organizationsStore.getOrganizationCoordinators(
        organization.original_action_hash
      );
      coordinators = await usersStore.getUsersByActionHashes(
        coordinatorLinks.map((link) => link.target)
      );
      agentIsCoordinator = await organizationsStore.isOrganizationCoordinator(
        organization.original_action_hash,
        usersStore.currentUser?.original_action_hash!
      );
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load coordinators';
      console.error('Failed to load coordinators:', e);
    } finally {
      loading = false;
    }
  }

  // Sort and filter coordinators
  function getSortedAndFilteredCoordinators() {
    if (coordinators.length === 0) return [];

    // First, sort the coordinators
    const sorted = [...coordinators].sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else {
        // Sort by status
        const statusA = a.status?.status_type || '';
        const statusB = b.status?.status_type || '';
        return sortOrder === 'asc'
          ? statusA.localeCompare(statusB)
          : statusB.localeCompare(statusA);
      }
    });

    // Then filter by search query
    if (!searchQuery) return sorted;

    return sorted.filter((coordinator) =>
      coordinator.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const displayCoordinators = $derived(getSortedAndFilteredCoordinators());

  async function handleRemoveCoordinator(coordinator: UIUser) {
    if (!coordinator.original_action_hash || !organization.original_action_hash) return;

    try {
      // Confirm removal
      const confirmed = await new Promise<boolean>((resolve) => {
        modalStore.trigger({
          type: 'confirm',
          title: 'Remove Coordinator',
          body: `Are you sure you want to remove ${coordinator.name} as a coordinator? This action cannot be undone.`,
          response: (r: boolean) => resolve(r)
        });
      });

      if (!confirmed) return;

      loading = true;
      await organizationsStore.removeCoordinator(
        organization.original_action_hash!,
        coordinator.original_action_hash
      );

      toastStore.trigger({
        message: 'Coordinator removed successfully',
        background: 'variant-filled-success'
      } as any);

      await loadCoordinators();
    } catch (e) {
      console.error('Error removing coordinator:', e);
      toastStore.trigger({
        message: 'Failed to remove coordinator',
        background: 'variant-filled-error'
      } as any);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadCoordinators();
  });
</script>

<div class="card space-y-4 p-4">
  <header class="card-header">
    <h3 class="h3">{title || 'Organization Coordinators'}</h3>
  </header>

  {#if loading}
    <div class="flex items-center justify-center p-4">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert variant-filled-error" role="alert">
      {error}
    </div>
  {:else if coordinators.length === 0}
    <div class="alert variant-ghost-surface" role="alert">No coordinators found.</div>
  {:else}
    <div class="hidden overflow-x-auto md:block">
      <table class="table-hover table w-full">
        <thead>
          <tr>
            <th class="whitespace-nowrap">Name</th>
            <th class="whitespace-nowrap">Type</th>
            <th class="whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each displayCoordinators as coordinator (coordinator.original_action_hash)}
            <tr>
              <td class="flex items-center gap-2 whitespace-nowrap">
                <Avatar src={getUserPictureUrl(coordinator)} width="w-12" />
                <span>{coordinator.name}</span>
              </td>
              <td class="whitespace-nowrap">
                <span>
                  {coordinator.user_type.charAt(0).toUpperCase() + coordinator.user_type.slice(1)}
                </span>
              </td>
              <td class="whitespace-nowrap">
                <div class="flex gap-2">
                  {#if agentIsCoordinator}
                    <button
                      class="btn btn-sm variant-filled-error"
                      onclick={() => handleRemoveCoordinator(coordinator)}
                      disabled={loading || coordinators.length <= 1}
                      title={coordinators.length <= 1 ? 'Cannot remove last coordinator' : ''}
                      aria-label={`Remove ${coordinator.name} as coordinator`}
                    >
                      Remove
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-4 md:hidden">
      {#each displayCoordinators as coordinator (coordinator.original_action_hash)}
        <div class="card variant-filled p-4">
          <div class="flex items-center gap-4">
            <Avatar src={getUserPictureUrl(coordinator)} width="w-16" />
            <div class="min-w-0 flex-1">
              <h3 class="h4 truncate font-bold">{coordinator.name}</h3>
              <p class="text-sm opacity-80">
                {coordinator.user_type.charAt(0).toUpperCase() + coordinator.user_type.slice(1)}
              </p>
            </div>
          </div>
          {#if agentIsCoordinator}
            <div class="mt-4">
              <button
                class="btn variant-filled-error w-full"
                onclick={() => handleRemoveCoordinator(coordinator)}
                disabled={loading || coordinators.length <= 1}
                title={coordinators.length <= 1 ? 'Cannot remove last coordinator' : ''}
                aria-label={`Remove ${coordinator.name} as coordinator`}
              >
                Remove Coordinator
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
