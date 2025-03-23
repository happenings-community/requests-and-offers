<script lang="ts">
  import { page } from '$app/state';
  import {
    Avatar,
    TabGroup,
    Tab,
    type ModalComponent,
    type ModalSettings,
    getModalStore
  } from '@skeletonlabs/skeleton';
  import type { UIOrganization, UIRequest, Revision, UIUser } from '@/types/ui';
  import usersStore from '@/stores/users.store.svelte';
  import administrationStore from '@stores/administration.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import requestsStore from '@/stores/requests.store.svelte';
  import StatusHistoryModal from '@lib/modals/StatusHistoryModal.svelte';
  import UserOrganizationsTable from '@/lib/tables/UserOrganizationsTable.svelte';
  import RequestsTable from '@/lib/tables/RequestsTable.svelte';
  import { OrganizationRole } from '@/types/ui';
  import { decodeHashFromBase64 } from '@holochain/client';

  const modalStore = getModalStore();
  const userHash = decodeHashFromBase64(page.params.id);

  let user = $state<UIUser | null>(null);
  let error = $state<string | null>(null);
  let suspensionDate = $state('');
  let isExpired = $state(false);
  let tabSet = $state(0);
  let userPictureUrl = $state('/default_avatar.webp');

  // Data for tabs
  let userOrganizations: UIOrganization[] = $state([]);
  let userCoordinatedOrganizations: UIOrganization[] = $state([]);
  let userRequests: UIRequest[] = $state([]);
  let isLoadingRequests = $state(false);

  async function fetchUserData() {
    try {
      user = await usersStore.getUserByActionHash(userHash);

      if (!user) {
        error = 'User not found';
        return;
      }

      // Set user picture URL
      if (user.picture) {
        userPictureUrl = URL.createObjectURL(new Blob([new Uint8Array(user.picture)]));
      }

      // Fetch organizations and filter for accepted ones only
      const allMemberOrgs = await organizationsStore.getUserMemberOnlyOrganizations(
        user.original_action_hash!
      );
      userOrganizations = allMemberOrgs.filter((org) => org.status?.status_type === 'accepted');

      const allCoordinatedOrgs = await organizationsStore.getUserCoordinatedOrganizations(
        user.original_action_hash!
      );
      userCoordinatedOrganizations = allCoordinatedOrgs.filter(
        (org) => org.status?.status_type === 'accepted'
      );

      // Fetch requests
      isLoadingRequests = true;
      userRequests = await requestsStore.getUserRequests(user.original_action_hash!);
      isLoadingRequests = false;
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      error = 'Failed to load user data. Please try again later.';
      isLoadingRequests = false;
    }
  }

  $effect(() => {
    fetchUserData();
  });

  // Clean up blob URLs when component is destroyed
  $effect(() => {
    return () => {
      if (userPictureUrl && userPictureUrl !== '/default_avatar.webp') {
        URL.revokeObjectURL(userPictureUrl);
      }
    };
  });

  const statusHistoryModalComponent: ModalComponent = { ref: StatusHistoryModal };
  const statusHistoryModal = (statusHistory: Revision[]): ModalSettings => {
    return {
      type: 'component',
      component: statusHistoryModalComponent,
      meta: {
        statusHistory
      }
    };
  };

  async function handleStatusHistoryModal() {
    try {
      const statusLink = await usersStore.getUserStatusLink(user?.original_action_hash!);
      if (!statusLink) return;

      const statusHistory = await administrationStore.getAllRevisionsForStatus(user!);
      modalStore.trigger(statusHistoryModal(statusHistory));
      modalStore.update((modals) => modals.reverse());
    } catch (err) {
      console.error('Failed to fetch status history:', err);
      // TODO: show an error toast or modal
    }
  }
</script>

<section class="flex flex-col items-center">
  {#if error}
    <div class="alert variant-filled-error">
      <p>{error}</p>
    </div>
  {:else if !user}
    <p class="mb-4 text-center text-xl">Loading user profile...</p>
  {:else}
    <div class="mb-10 flex flex-col items-center gap-5">
      <h2 class="h2">
        <span class="text-primary-500 font-bold">{user.name}</span>'s Profile
      </h2>
    </div>
    <div
      class="border-surface-600 bg-surface-400 flex w-4/5 min-w-96 flex-col items-center gap-5 rounded-xl border-8 p-5 drop-shadow-xl"
    >
      <!-- User Profile Information -->
      <div class="flex w-full flex-col items-center gap-5">
        <h3 class="h3"><b>Nickname :</b> {user.nickname}</h3>
        <h3 class="h3 text-wrap text-center">
          <b>Status :</b>
          <span
            class:text-primary-500={user!.status?.status_type === 'pending'}
            class:text-error-500={user!.status?.status_type === 'rejected' ||
              user!.status?.status_type === 'suspended indefinitely'}
            class:text-green-400={user!.status?.status_type === 'accepted'}
            class:text-warning-500={user!.status?.status_type === `suspended temporarily`}
          >
            {#if !suspensionDate}
              {user!.status?.status_type}
            {:else}
              {isExpired ? 'In review' : 'suspended temporarily'}
            {/if}
          </span>
        </h3>
        {#if user?.status?.status_type && user.status.status_type.startsWith('suspended')}
          <p class=" text-wrap text-center"><b>Reason :</b> {user.status.reason}</p>
          {#if suspensionDate}
            <p class=" text-wrap text-center">
              <b>Suspended until :</b>
              {suspensionDate}
            </p>
          {/if}
        {/if}

        <button class="btn variant-filled-secondary" onclick={handleStatusHistoryModal}>
          Status History
        </button>

        <div>
          <Avatar src={userPictureUrl} width="w-64" background="none" />
        </div>
        <p class="text-center">{user.bio}</p>
        <p><b>Type :</b> {user.user_type}</p>
        {#if user.skills?.length}
          <p class="text-center"><b>Skills :</b> {user.skills?.join(', ')}</p>
        {/if}
        <p><b>Email :</b> {user.email}</p>
        {#if user.phone}
          <p><b>Phone number :</b> {user.phone}</p>
        {/if}
        {#if user.time_zone}
          <p><b>Timezone :</b> {user.time_zone}</p>
        {/if}
        {#if user.location}
          <p><b>Location :</b> {user.location}</p>
        {/if}
      </div>

      <!-- Tabbed Interface -->
      <div class="mt-8 w-full">
        <TabGroup
          justify="justify-center"
          spacing="space-y-1"
          border="border-none"
          rounded="rounded-container-token"
          active="bg-primary-500 text-white"
          hover="hover:bg-primary-400-500-token"
        >
          <Tab bind:group={tabSet} name="organizations" value={0}>Organizations</Tab>
          <Tab bind:group={tabSet} name="requests" value={1}>Requests</Tab>
          <Tab bind:group={tabSet} name="offers" value={2}>Offers</Tab>

          <!-- Tab Panels -->
          <svelte:fragment slot="panel">
            {#if tabSet === 0}
              <!-- Organizations Tab -->
              <div
                class="card bg-surface-100-800-token/90 rounded-container-token p-4 backdrop-blur-lg"
              >
                <div class="space-y-4">
                  {#if userOrganizations?.length > 0 || userCoordinatedOrganizations?.length > 0}
                    {#if userCoordinatedOrganizations?.length > 0}
                      <UserOrganizationsTable
                        title="Coordinated Organizations"
                        organizations={userCoordinatedOrganizations}
                        role={OrganizationRole.Coordinator}
                      />
                    {/if}
                    {#if userOrganizations?.length > 0}
                      <UserOrganizationsTable
                        title="Member Organizations"
                        organizations={userOrganizations}
                        role={OrganizationRole.Member}
                      />
                    {/if}
                  {:else}
                    <div class="flex flex-col items-center justify-center p-8">
                      <p class="mb-4 text-center text-lg">
                        This user is not a member of any organizations.
                      </p>
                    </div>
                  {/if}
                </div>
              </div>
            {:else if tabSet === 1}
              <!-- Requests Tab -->
              <div
                class="card bg-surface-100-800-token/90 rounded-container-token p-4 backdrop-blur-lg"
              >
                <div class="mb-4 flex items-center justify-between">
                  <h3 class="h3">Requests</h3>
                </div>

                {#if isLoadingRequests}
                  <div class="flex items-center justify-center p-8">
                    <span class="loading loading-spinner text-primary"></span>
                    <p class="ml-4">Loading requests...</p>
                  </div>
                {:else if userRequests?.length > 0}
                  <RequestsTable requests={userRequests} showOrganization />
                {:else}
                  <div class="flex flex-col items-center justify-center p-8">
                    <p class="mb-4 text-center text-lg">
                      This user hasn't created any requests yet.
                    </p>
                  </div>
                {/if}
              </div>
            {:else if tabSet === 2}
              <!-- Offers Tab -->
              <div
                class="card bg-surface-100-800-token/90 rounded-container-token p-4 backdrop-blur-lg"
              >
                <div class="mb-4 flex items-center justify-between">
                  <h3 class="h3">Offers</h3>
                </div>

                <div class="flex flex-col items-center justify-center p-8">
                  <p class="mb-4 text-center text-lg">Offers functionality coming soon!</p>
                </div>
              </div>
            {/if}
          </svelte:fragment>
        </TabGroup>
      </div>
    </div>
  {/if}
</section>
