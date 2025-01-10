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
    sortBy?: 'name' | 'role' | 'status';
    sortOrder?: 'asc' | 'desc';
    memberOnly?: boolean;
  };

  const {
    title,
    organization,
    searchQuery = '',
    sortBy = 'name',
    sortOrder = 'asc',
    memberOnly = false
  }: Props = $props();

  let agentIsCoordinator = $state(false);
  let members = $state<UIUser[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const modalStore = getModalStore();
  const toastStore = getToastStore();

  $effect(() => {
    loadMembers();
  });

  async function loadMembers() {
    if (!organization.original_action_hash) return;

    try {
      loading = true;
      error = null;
      const memberLinks = await organizationsStore.getOrganizationMembers(
        organization.original_action_hash
      );
      members = await usersStore.getUsersByActionHashes(memberLinks.map((link) => link.target));
      agentIsCoordinator = await organizationsStore.isOrganizationCoordinator(
        organization.original_action_hash,
        usersStore.currentUser?.original_action_hash!
      );
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load members';
      console.error('Failed to load members:', e);
    } finally {
      loading = false;
    }
  }

  // Sort and filter members
  function getSortedAndFilteredMembers() {
    if (members.length === 0) return [];

    console.log('Organization Members:', members);
    console.log('Organization coordinators:', organization.coordinators);

    // First, sort the members
    let sorted = [...members].sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else if (sortBy === 'role') {
        const aIsCoordinator = organization.coordinators.some((coordinatorHash) =>
          compareUint8Arrays(coordinatorHash, a.original_action_hash!)
        );
        const bIsCoordinator = organization.coordinators.some((coordinatorHash) =>
          compareUint8Arrays(coordinatorHash, b.original_action_hash!)
        );
        return sortOrder === 'asc'
          ? aIsCoordinator === bIsCoordinator
            ? 0
            : aIsCoordinator
              ? 1
              : -1
          : aIsCoordinator === bIsCoordinator
            ? 0
            : aIsCoordinator
              ? -1
              : 1;
      } else {
        // Sort by status
        const statusA = a.status?.status_type || '';
        const statusB = b.status?.status_type || '';
        return sortOrder === 'asc'
          ? statusA.localeCompare(statusB)
          : statusB.localeCompare(statusA);
      }
    });

    // Then filter by search query and member-only
    if (memberOnly) {
      sorted = sorted.filter(
        (member) =>
          !organization.coordinators.some((coordinatorHash) =>
            compareUint8Arrays(coordinatorHash, member.original_action_hash!)
          )
      );
    }

    console.log(
      'Organization Members after filtering:',
      sorted.map((member) => ({
        name: member.name,
        role: member.role,
        status: member.status?.status_type,
        isCoordinator: organization.coordinators.some((coordinatorHash) =>
          compareUint8Arrays(coordinatorHash, member.original_action_hash!)
        )
      }))
    );

    if (!searchQuery) return sorted;

    return sorted.filter((member) => member.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  function compareUint8Arrays(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }

  const displayMembers = $derived(getSortedAndFilteredMembers());

  async function handleRemoveMember(member: UIUser) {
    if (!member.original_action_hash || !organization.original_action_hash) return;

    try {
      // Confirm removal
      const confirmed = await new Promise<boolean>((resolve) => {
        modalStore.trigger({
          type: 'confirm',
          title: 'Remove Member',
          body: `Are you sure you want to remove ${member.name} from the organization? This action cannot be undone.`,
          response: (r: boolean) => resolve(r)
        });
      });

      if (!confirmed) return;

      loading = true;
      await organizationsStore.removeMember(
        organization.original_action_hash,
        member.original_action_hash
      );

      toastStore.trigger({
        message: 'Member removed successfully',
        background: 'variant-filled-success'
      } as any);

      await loadMembers();
    } catch (e) {
      console.error('Error removing member:', e);
      toastStore.trigger({
        message: 'Failed to remove member',
        background: 'variant-filled-error'
      } as any);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    isCoordinator();
  });

  async function isCoordinator() {
    if (!organization?.original_action_hash || !usersStore.currentUser?.original_action_hash)
      return;
    agentIsCoordinator = await organizationsStore.isOrganizationCoordinator(
      organization.original_action_hash,
      usersStore.currentUser?.original_action_hash
    );
  }
</script>

<div class="card space-y-4 p-4">
  <header class="card-header">
    <h3 class="h3">{title || 'Organization Members'}</h3>
  </header>

  {#if loading}
    <div class="flex items-center justify-center p-4">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert variant-filled-error" role="alert">
      {error}
    </div>
  {:else if members.length === 0}
    <div class="alert variant-ghost-surface" role="alert">No members found.</div>
  {:else}
    <!-- Table view for larger screens -->
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
          {#each displayMembers as member (member.original_action_hash)}
            <tr>
              <td class="flex items-center gap-2 whitespace-nowrap">
                <Avatar src={getUserPictureUrl(member)} width="w-12" />
                <span>{member.name}</span>
              </td>
              <td class="whitespace-nowrap">
                <span>
                  {member.user_type.charAt(0).toUpperCase() + member.user_type.slice(1)}
                </span>
              </td>
              <td class="whitespace-nowrap">
                {#if agentIsCoordinator}
                  <button
                    class="btn btn-sm variant-filled-error"
                    onclick={() => handleRemoveMember(member)}
                    disabled={loading}
                    aria-label={`Remove ${member.name} from organization`}
                  >
                    Remove
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-4 md:hidden">
      {#each displayMembers as member (member.original_action_hash)}
        <div class="card variant-filled p-4">
          <div class="flex items-center gap-4">
            <Avatar src={getUserPictureUrl(member)} width="w-16" />
            <div class="min-w-0 flex-1">
              <h3 class="h4 truncate font-bold">{member.name}</h3>
              <p class="text-sm opacity-80">
                {member.user_type.charAt(0).toUpperCase() + member.user_type.slice(1)}
              </p>
            </div>
          </div>
          {#if agentIsCoordinator}
            <div class="mt-4">
              <button
                class="btn variant-filled-error w-full"
                onclick={() => handleRemoveMember(member)}
                disabled={loading}
                aria-label={`Remove ${member.name} from organization`}
              >
                Remove Member
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
