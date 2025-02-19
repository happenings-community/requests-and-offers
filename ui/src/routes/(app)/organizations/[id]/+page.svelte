<script lang="ts">
  import { page } from '$app/stores';
  import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import type { Revision, UIOrganization } from '@/types/ui';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import administrationStore from '@/stores/administration.store.svelte';
  import { Avatar } from '@skeletonlabs/skeleton';
  import usersStore from '@/stores/users.store.svelte';
  import OrganizationMembersTable from '@/lib/tables/OrganizationMembersTable.svelte';
  import OrganizationCoordinatorsTable from '@/lib/tables/OrganizationCoordinatorsTable.svelte';
  import StatusHistoryModal from '@/lib/modals/StatusHistoryModal.svelte';
  import AddOrganizationMemberModal from '@/lib/modals/AddOrganizationMemberModal.svelte';
  import AddOrganizationCoordinatorModal from '@/lib/modals/AddOrganizationCoordinatorModal.svelte';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';

  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const organizationHash = decodeHashFromBase64($page.params.id) as ActionHash;

  let agentIsCoordinator = $state(false);
  let agentIsMember = $state(false);
  let organization = $state<UIOrganization | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  // Table controls
  let memberSearchQuery = $state('');
  let memberSortBy = $state<'name' | 'role' | 'status'>('name');
  let memberSortOrder = $state<'asc' | 'desc'>('asc');

  let coordinatorSearchQuery = $state('');
  let coordinatorSortBy = $state<'name' | 'status'>('name');
  let coordinatorSortOrder = $state<'asc' | 'desc'>('asc');

  const currentUserIsAccepted = $derived(
    usersStore.currentUser?.status?.status_type === 'accepted'
  );

  const statusHistoryModalComponent: ModalComponent = { ref: StatusHistoryModal };
  const statusHistoryModal = (statusHistory: Revision[]): ModalSettings => ({
    type: 'component',
    component: statusHistoryModalComponent,
    meta: {
      statusHistory,
      title: 'Organization Status History'
    }
  });

  const addMemberModalComponent: ModalComponent = { ref: AddOrganizationMemberModal };
  const addMemberModal = (): ModalSettings => ({
    type: 'component',
    component: addMemberModalComponent,
    meta: {
      organization
    }
  });

  const addCoordinatorModalComponent: ModalComponent = { ref: AddOrganizationCoordinatorModal };
  const addCoordinatorModal = (): ModalSettings => ({
    type: 'component',
    component: addCoordinatorModalComponent,
    meta: {
      organization
    }
  });

  async function loadOrganization() {
    try {
      loading = true;
      error = null;
      organization = await organizationsStore.getLatestOrganization(organizationHash);
      if (!organization) {
        throw new Error('Organization not found');
      }

      organizationsStore.setCurrentOrganization(organization);
    } catch (e) {
      error = e instanceof Error ? e.message : 'An unknown error occurred';
      organization = null;
    } finally {
      loading = false;
    }
  }

  async function isCoordinator() {
    if (!organization?.original_action_hash || !usersStore.currentUser?.original_action_hash) {
      agentIsCoordinator = false;
      return;
    }

    agentIsCoordinator = await organizationsStore.isOrganizationCoordinator(
      organization.original_action_hash,
      usersStore.currentUser.original_action_hash
    );
  }

  async function isMember() {
    if (!organization?.original_action_hash || !usersStore.currentUser?.original_action_hash) {
      agentIsMember = false;
      return;
    }

    agentIsMember = organization?.members.some(
      (member) =>
        encodeHashToBase64(member) ===
        encodeHashToBase64(usersStore.currentUser?.original_action_hash!)
    );
  }

  $effect(() => {
    if (organization && usersStore.currentUser) {
      isCoordinator();
      isMember();
    }
  });

  $inspect('currentUserStatus', usersStore.currentUser?.status);

  // Load organization when the component mounts
  $effect(() => {
    Promise.all([loadOrganization(), usersStore.refreshCurrentUser()]);
  });

  $inspect('currentUserStatus', usersStore.currentUser?.status);

  let organizationLogoUrl = $derived.by(() =>
    organization?.logo
      ? URL.createObjectURL(new Blob([new Uint8Array(organization.logo)]))
      : '/default_avatar.webp'
  );

  async function handleStatusHistoryModal() {
    try {
      const statusLink = await organizationsStore.getOrganizationStatusLink(
        organization!.original_action_hash!
      );
      if (!statusLink) return;

      const statusHistory = await administrationStore.getAllRevisionsForStatus(organization!);

      console.log('statusHistory:', statusHistory);

      modalStore.trigger(statusHistoryModal(statusHistory));
      modalStore.update((modals) => modals.reverse());
    } catch (err) {
      console.error('Failed to fetch status history:', err);
      toastStore.trigger({
        message: 'Failed to load status history',
        background: 'variant-filled-error'
      });
    }
  }

  async function handleLeaveOrganization() {
    modalStore.trigger({
      type: 'confirm',
      title: 'Leave Organization',
      body: 'Are you sure you want to leave this organization?',
      response: async (confirmed) => {
        if (confirmed) {
          try {
            const success = await organizationsStore.leaveOrganization(organizationHash);
            if (success) {
              toastStore.trigger({
                message: 'Successfully left the organization',
                background: 'variant-filled-success'
              });
              goto('/organizations');
            } else {
              toastStore.trigger({
                message: 'Failed to leave the organization',
                background: 'variant-filled-error'
              });
            }
          } catch (error) {
            toastStore.trigger({
              message: `Error: ${error}`,
              background: 'variant-filled-error'
            });
          }
        }
      }
    });
  }
</script>

<section class="flex flex-col items-center">
  {#if error}
    <div class="alert variant-filled-error" role="alert">
      <p>{error}</p>
      <button class="btn btn-sm variant-soft" onclick={loadOrganization}>Try Again</button>
    </div>
  {:else if loading}
    <div class="flex flex-col items-center gap-4">
      <span class="loading loading-spinner loading-lg"></span>
      <p>Loading organization...</p>
    </div>
  {:else if organization}
    <!-- Organization Header -->
    <div class="card w-full p-6">
      <header class="flex items-center gap-6">
        <Avatar src={organizationLogoUrl} width="w-24" />
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <h1 class="h1">{organization.name}</h1>
            <div class="ml-4 flex flex-col gap-4">
              {#if agentIsCoordinator}
                <a href="/organizations/{$page.params.id}/edit" class="btn variant-filled-primary">
                  Edit Organization
                </a>
              {/if}
            </div>
          </div>
          <p class="text-lg">{organization.description}</p>
          <div class="mt-4 flex flex-col gap-2">
            <h3 class="h3 text-wrap">
              <b>Status :</b>
              <span
                class:text-primary-500={organization.status?.status_type === 'pending'}
                class:text-error-500={organization.status?.status_type === 'rejected' ||
                  organization.status?.status_type === 'suspended indefinitely'}
                class:text-green-400={organization.status?.status_type === 'accepted'}
                class:text-warning-500={organization.status?.status_type ===
                  `suspended temporarily`}
              >
                {organization.status?.status_type || 'pending'}
              </span>
            </h3>
            {#if organization?.status?.status_type && organization.status.status_type.startsWith('suspended')}
              <p class="text-wrap"><b>Reason :</b> {organization.status.reason}</p>
              {#if organization.status.suspended_until}
                <p class="text-wrap">
                  <b>Suspended until :</b>
                  {new Date(organization.status.suspended_until).toLocaleString()}
                </p>
              {/if}
            {/if}
            <button class="btn variant-filled-secondary w-fit" onclick={handleStatusHistoryModal}>
              Status History
            </button>
          </div>
        </div>
      </header>

      <!-- Organization Details -->
      <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="card p-4">
          <h3 class="h3 mb-2">Contact</h3>
          <p><strong>Email:</strong> {organization.email}</p>
          <p><strong>Location:</strong> {organization.location}</p>
        </div>
        <div class="card p-4">
          <h3 class="h3 mb-2">Links</h3>
          <ul class="list-inside list-disc">
            {#each organization.urls as url}
              <li>
                <a href={url} target="_blank" rel="noopener noreferrer" class="anchor">{url}</a>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </div>

    <!-- Members Section -->
    <div class="card mt-6 w-full p-6">
      <div class="mb-4 flex items-center justify-between gap-4">
        <div class="input-group input-group-divider w-full max-w-sm grid-cols-[auto_1fr_auto]">
          <div class="input-group-shim">🔍</div>
          <input
            type="search"
            placeholder="Search members..."
            bind:value={memberSearchQuery}
            class="border-0 bg-transparent ring-0 focus:ring-0"
          />
        </div>
        {#if agentIsCoordinator && organization?.status?.status_type === 'accepted' && currentUserIsAccepted}
          <button
            class="btn variant-filled-primary"
            onclick={() => modalStore.trigger(addMemberModal())}
          >
            Add Member
          </button>
        {/if}
        {#if !agentIsCoordinator && currentUserIsAccepted && agentIsMember}
          <button class="btn variant-filled-error" onclick={handleLeaveOrganization}>
            Leave Organization
          </button>
        {/if}
      </div>
      <OrganizationMembersTable
        {organization}
        searchQuery={memberSearchQuery}
        sortBy={memberSortBy}
        sortOrder={memberSortOrder}
        memberOnly
        title="Members"
      />
    </div>

    <!-- Coordinators Section -->
    <div class="card mt-6 w-full p-6">
      <div class="mb-4 flex items-center justify-between gap-4">
        <div class="input-group input-group-divider w-full max-w-sm grid-cols-[auto_1fr_auto]">
          <div class="input-group-shim">🔍</div>
          <input
            type="search"
            placeholder="Search coordinators..."
            bind:value={coordinatorSearchQuery}
            class="border-0 bg-transparent ring-0 focus:ring-0"
          />
        </div>
        {#if agentIsCoordinator && organization?.status?.status_type === 'accepted' && currentUserIsAccepted}
          <button
            class="btn variant-filled-primary"
            onclick={() => modalStore.trigger(addCoordinatorModal())}
          >
            Add Coordinator
          </button>
        {/if}
      </div>
      <OrganizationCoordinatorsTable
        title="Coordinators"
        {organization}
        searchQuery={coordinatorSearchQuery}
        sortBy={coordinatorSortBy}
        sortOrder={coordinatorSortOrder}
      />
    </div>
  {:else}
    <div class="flex justify-center p-8">
      <p class="text-surface-600-300-token">Organization not found</p>
    </div>
  {/if}
</section>
