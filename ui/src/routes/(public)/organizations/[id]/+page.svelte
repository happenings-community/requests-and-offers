<script lang="ts">
  import { page } from '$app/state';
  import { getModalStore, getToastStore, TabGroup, Tab } from '@skeletonlabs/skeleton';
  import type { Revision, UIOrganization, UIRequest, UIOffer } from '$lib/types/ui';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { OrganizationsServiceTag } from '$lib/services/zomes/organizations.service';
  import { pipe } from 'effect';
  import { Avatar } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  import OrganizationMembersTable from '$lib/components/organizations/OrganizationMembersTable.svelte';
  import OrganizationCoordinatorsTable from '$lib/components/organizations/OrganizationCoordinatorsTable.svelte';
  import RequestsTable from '$lib/components/requests/RequestsTable.svelte';
  import StatusHistoryModal from '$lib/components/shared/status/StatusHistoryModal.svelte';
  import AddOrganizationMemberModal from '$lib/components/organizations/AddOrganizationMemberModal.svelte';
  import AddOrganizationCoordinatorModal from '$lib/components/organizations/AddOrganizationCoordinatorModal.svelte';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { runEffect } from '$lib/utils/effect';
  import offersStore from '$lib/stores/offers.store.svelte';
  import OffersTable from '$lib/components/offers/OffersTable.svelte';
  import { Effect as E } from 'effect';

  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const organizationHash = page.params.id
    ? (decodeHashFromBase64(page.params.id) as ActionHash)
    : null;

  let agentIsCoordinator = $state(false);
  let agentIsMember = $state(false);
  let organization = $state<UIOrganization | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let tabSet = $state(0);

  // Table controls
  let memberSearchQuery = $state('');
  let memberSortBy = $state<'name' | 'role' | 'status'>('name');
  let memberSortOrder = $state<'asc' | 'desc'>('asc');

  let coordinatorSearchQuery = $state('');
  let coordinatorSortBy = $state<'name' | 'status'>('name');
  let coordinatorSortOrder = $state<'asc' | 'desc'>('asc');

  // Organization requests
  let organizationRequests: UIRequest[] = $state([]);
  let organizationOffers: UIOffer[] = $state([]);
  let isLoadingRequests = $state(false);
  let isLoadingOffers = $state(false);

  const currentUserIsAccepted = $derived(
    usersStore.currentUser?.status?.status_type === 'accepted'
  );

  const statusHistoryModalComponent: ModalComponent = { ref: StatusHistoryModal };
  const statusHistoryModal = (statusHistory: Revision[]): ModalSettings => ({
    type: 'component',
    component: statusHistoryModalComponent,
    meta: {
      statusHistory: [...statusHistory], // Sanitize for Svelte 5 state proxies
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
      if (!organizationHash) {
        throw new Error('Invalid organization ID');
      }
      organization = await runEffect(organizationsStore.getLatestOrganization(organizationHash));
      if (!organization) {
        throw new Error('Organization not found');
      }

      await runEffect(organizationsStore.setCurrentOrganization(organization));
    } catch (e) {
      error = e instanceof Error ? e.message : 'An unknown error occurred';
      organization = null;
    } finally {
      loading = false;
    }
  }

  async function loadOrganizationData() {
    if (!organization?.original_action_hash) return;

    try {
      isLoadingRequests = true;
      isLoadingOffers = true;

      const [organizationRequestsResult, organizationOffersResult] = await Promise.all([
        runEffect(requestsStore.getOrganizationRequests(organization.original_action_hash)),
        runEffect(offersStore.getOrganizationOffers(organization.original_action_hash))
      ]);

      organizationRequests = organizationRequestsResult;
      organizationOffers = organizationOffersResult;
    } catch (error) {
      console.error('Failed to load organization data:', error);
    } finally {
      isLoadingRequests = false;
      isLoadingOffers = false;
    }
  }

  async function isCoordinator() {
    if (!organization?.original_action_hash || !usersStore.currentUser?.original_action_hash) {
      agentIsCoordinator = false;
      return;
    }

    agentIsCoordinator = await runEffect(
      organizationsStore.isOrganizationCoordinator(
        organization.original_action_hash,
        usersStore.currentUser.original_action_hash
      )
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
      loadOrganizationData();
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

  // Clean up blob URLs when component is destroyed
  $effect(() => {
    return () => {
      if (organizationLogoUrl && organizationLogoUrl !== '/default_avatar.webp') {
        URL.revokeObjectURL(organizationLogoUrl);
      }
    };
  });

  async function handleStatusHistoryModal() {
    try {
      // Get status history directly as Revision[]
      const statusHistory = await runEffect(
        administrationStore.getEntityStatusHistory(organization!)
      );

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
            if (!organizationHash) return;
            const success = await runEffect(organizationsStore.leaveOrganization(organizationHash));
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
      <button class="variant-soft btn btn-sm" onclick={loadOrganization}>Try Again</button>
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
                <a href="/organizations/{page.params.id}/edit" class="variant-filled-primary btn">
                  Edit Organization
                </a>
              {/if}
              {#if !agentIsCoordinator && currentUserIsAccepted && agentIsMember}
                <button class="variant-filled-error btn" onclick={handleLeaveOrganization}>
                  Leave Organization
                </button>
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
            <button class="variant-filled-secondary btn w-fit" onclick={handleStatusHistoryModal}>
              Status History
            </button>
          </div>
        </div>
      </header>

      <!-- Organization Details -->
      <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="card p-4">
          <h3 class="h3 mb-2">Contact</h3>
          {#if organization.full_legal_name}
            <p><strong>Legal Name:</strong> {organization.full_legal_name}</p>
          {/if}
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

    <!-- Tabbed Interface -->
    <div class="card mt-6 w-full p-6">
      <TabGroup
        justify="justify-center"
        border="border-none"
        rounded="rounded-container-token"
        active="bg-primary-500 text-white"
        hover="hover:bg-primary-400-500-token"
        class="bg-surface-100-800-token/90 p-2 rounded-container-token"
      >
        <Tab bind:group={tabSet} name="members" value={0}>Members</Tab>
        <Tab bind:group={tabSet} name="coordinators" value={1}>Coordinators</Tab>
        <Tab bind:group={tabSet} name="requests" value={2}>Requests</Tab>
        <Tab bind:group={tabSet} name="offers" value={3}>Offers</Tab>

        <!-- Tab Panels -->
        <svelte:fragment slot="panel">
          {#if tabSet === 0}
            <!-- Members Tab -->
            <div
              class="bg-surface-100-800-token/90 card p-4 backdrop-blur-lg rounded-container-token"
            >
              <div class="mb-4 flex items-center justify-between gap-4">
                <div
                  class="input-group input-group-divider w-full max-w-sm grid-cols-[auto_1fr_auto]"
                >
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
                    class="variant-filled-primary btn"
                    onclick={() => modalStore.trigger(addMemberModal())}
                  >
                    Add Member
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
          {:else if tabSet === 1}
            <!-- Coordinators Tab -->
            <div
              class="bg-surface-100-800-token/90 card p-4 backdrop-blur-lg rounded-container-token"
            >
              <div class="mb-4 flex items-center justify-between gap-4">
                <div
                  class="input-group input-group-divider w-full max-w-sm grid-cols-[auto_1fr_auto]"
                >
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
                    class="variant-filled-primary btn"
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
          {:else if tabSet === 2}
            <!-- Requests Tab -->
            <div
              class="bg-surface-100-800-token/90 card p-4 backdrop-blur-lg rounded-container-token"
            >
              <div class="mb-4 flex items-center justify-between">
                <h3 class="h3">Organization Requests</h3>
                {#if (agentIsCoordinator || agentIsMember) && organization?.status?.status_type === 'accepted'}
                  <a
                    href={`/requests/create?organization=${page.params.id}`}
                    class="variant-filled-primary btn">Create New Request</a
                  >
                {/if}
              </div>

              {#if isLoadingRequests}
                <div class="flex items-center justify-center p-8">
                  <span class="loading loading-spinner text-primary"></span>
                  <p class="ml-4">Loading organization requests...</p>
                </div>
              {:else if organizationRequests?.length > 0}
                <RequestsTable requests={organizationRequests} showCreator />
              {:else}
                <div class="flex flex-col items-center justify-center p-8">
                  <p class="mb-4 text-center text-lg">
                    This organization hasn't created any requests yet.
                  </p>
                  {#if organization?.status?.status_type !== 'accepted'}
                    <p class="text-center text-warning-500">
                      This organization needs to be accepted before creating requests.
                    </p>
                  {:else if agentIsCoordinator || agentIsMember}
                    <a
                      href={`/requests/create?organization=${page.params.id}`}
                      class="variant-filled-primary btn">Create First Request</a
                    >
                  {/if}
                </div>
              {/if}
            </div>
          {:else if tabSet === 3}
            <!-- Offers Tab -->
            <div
              class="bg-surface-100-800-token/90 card p-4 backdrop-blur-lg rounded-container-token"
            >
              <div class="mb-4 flex items-center justify-between">
                <h3 class="h3">Organization Offers</h3>
                {#if (agentIsCoordinator || agentIsMember) && organization?.status?.status_type === 'accepted'}
                  <a
                    href={`/offers/create?organization=${page.params.id}`}
                    class="variant-filled-primary btn">Create New Offer</a
                  >
                {/if}
              </div>

              {#if isLoadingOffers}
                <div class="flex items-center justify-center p-8">
                  <span class="loading loading-spinner text-primary"></span>
                  <p class="ml-4">Loading organization offers...</p>
                </div>
              {:else if organizationOffers?.length > 0}
                <OffersTable offers={organizationOffers} showCreator />
              {:else}
                <div class="flex flex-col items-center justify-center p-8">
                  <p class="mb-4 text-center text-lg">
                    This organization hasn't created any offers yet.
                  </p>
                  {#if organization?.status?.status_type !== 'accepted'}
                    <p class="text-center text-warning-500">
                      This organization needs to be accepted before creating offers.
                    </p>
                  {:else if agentIsCoordinator || agentIsMember}
                    <a
                      href={`/offers/create?organization=${page.params.id}`}
                      class="variant-filled-primary btn">Create First Offer</a
                    >
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </svelte:fragment>
      </TabGroup>
    </div>
  {:else}
    <div class="flex justify-center p-8">
      <p class="text-surface-600-300-token">Organization not found</p>
    </div>
  {/if}
</section>
