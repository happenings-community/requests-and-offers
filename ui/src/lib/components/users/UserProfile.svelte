<script lang="ts">
  import {
    getModalStore,
    getToastStore,
    Avatar,
    type ModalComponent,
    type ModalSettings,
    TabGroup,
    Tab
  } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '@/lib/stores/offers.store.svelte';
  import StatusHistoryModal from '$lib/components/shared/status/StatusHistoryModal.svelte';
  import UserOrganizationsTable from '$lib/components/organizations/UserOrganizationsTable.svelte';
  import RequestsTable from '$lib/components/requests/RequestsTable.svelte';
  import OffersTable from '$lib/components/offers/OffersTable.svelte';
  import {
    OrganizationRole,
    type UIOrganization,
    type UIRequest,
    type UIOffer,
    type UIUser,
    type Revision
  } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import { Effect as E } from 'effect';

  // Props
  let { user, isCurrentUser = false } = $props<{ user: UIUser; isCurrentUser?: boolean }>();

  const modalStore = getModalStore();
  const toastStore = getToastStore();

  let error = $state<string | null>(null);
  let suspensionDate = $state('');
  let isExpired = $state(false);
  let tabSet = $state(0);
  let userPictureUrl = $state('/default_avatar.webp');

  // Data for tabs
  let userOrganizations: UIOrganization[] = $state([]);
  let userCoordinatedOrganizations: UIOrganization[] = $state([]);
  let userRequests: UIRequest[] = $state([]);
  let userOffers: UIOffer[] = $state([]);
  let isLoadingRequests = $state(false);
  let isLoadingOffers = $state(false);

  async function fetchUserData() {
    try {
      if (!user) {
        error = 'User not found';
        return;
      }

      // Set user picture URL
      if (user.picture) {
        userPictureUrl = URL.createObjectURL(new Blob([new Uint8Array(user.picture)]));
      }

      // Fetch organizations
      const allUserOrganizations = await E.runPromise(
        organizationsStore.getUserOrganizations(user.original_action_hash!)
      );

      // Distinguish between coordinator and member roles
      const coordinated: UIOrganization[] = [];
      const memberOrgs: UIOrganization[] = [];

      for (const org of allUserOrganizations) {
        if (org.original_action_hash) {
          try {
            // Only check coordinator status if user has an action hash
            const isCoordinator = user.original_action_hash
              ? await E.runPromise(
                  organizationsStore.isOrganizationCoordinator(
                    org.original_action_hash,
                    user.original_action_hash
                  )
                )
              : false;

            if (isCoordinator) {
              coordinated.push(org);
            } else {
              memberOrgs.push(org);
            }
          } catch (err) {
            console.warn('Error checking coordinator status, defaulting to member role:', err);
            memberOrgs.push(org);
          }
        }
      }

      userCoordinatedOrganizations = coordinated;
      userOrganizations = memberOrgs;

      // Fetch requests
      isLoadingRequests = true;
      const userRequestsResult = await runEffect(
        requestsStore.getUserRequests(user.original_action_hash!)
      );
      userRequests = userRequestsResult;
      isLoadingRequests = false;

      // Fetch offers
      isLoadingOffers = true;
      const userOffersResult = await runEffect(
        offersStore.getUserOffers(user.original_action_hash!)
      );
      userOffers = userOffersResult;
      isLoadingOffers = false;
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      error = 'Failed to load user data. Please try again later.';
      isLoadingRequests = false;
      isLoadingOffers = false;
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
        statusHistory: [...statusHistory] // Sanitize for Svelte 5 state proxies
      }
    };
  };

  async function handleStatusHistoryModal() {
    try {
      const statusLink = await runEffect(usersStore.getUserStatusLink(user?.original_action_hash));
      if (!statusLink) return;

      // Fetch proper status history directly as Revision[]
      const statusHistory = await runEffect(administrationStore.getEntityStatusHistory(user!));
      modalStore.trigger(statusHistoryModal(statusHistory));
      modalStore.update((modals) => modals.reverse());
    } catch (err) {
      console.error('Failed to fetch status history:', err);
      toastStore.trigger({
        message: 'Failed to load status history. Please try again.',
        background: 'variant-filled-error',
        autohide: true,
        timeout: 5000
      });
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
        {#if isCurrentUser}
          Welcome <span class="font-bold text-primary-500">{user.name}</span>!
        {:else}
          <span class="font-bold text-primary-500">{user.name}</span>'s Profile
        {/if}
      </h2>
      {#if isCurrentUser}
        <a href="/user/edit" class="variant-filled-primary btn w-fit text-white">Edit profile</a>
      {/if}
    </div>
    <div
      class="flex w-4/5 min-w-96 flex-col items-center gap-5 rounded-xl border-8 border-surface-600 bg-surface-400 p-5 drop-shadow-xl"
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

        <button class="variant-filled-secondary btn" onclick={handleStatusHistoryModal}>
          Status History
        </button>

        <div>
          <Avatar src={userPictureUrl} width="w-64" background="none" />
        </div>
        <p class="text-center">{user.bio}</p>
        <p><b>Type :</b> {user.user_type}</p>
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
          <Tab bind:group={tabSet} name="requests" value={1}
            >{isCurrentUser ? 'My Requests' : 'Requests'}</Tab
          >
          <Tab bind:group={tabSet} name="offers" value={2}
            >{isCurrentUser ? 'My Offers' : 'Offers'}</Tab
          >

          <!-- Tab Panels -->
          <svelte:fragment slot="panel">
            {#if tabSet === 0}
              <!-- Organizations Tab -->
              <div
                class="bg-surface-100-800-token/90 card p-4 backdrop-blur-lg rounded-container-token"
              >
                <div class="space-y-4">
                  {#if userOrganizations?.length > 0 || userCoordinatedOrganizations?.length > 0}
                    {#if userCoordinatedOrganizations?.length > 0}
                      <UserOrganizationsTable
                        title={isCurrentUser
                          ? 'My Coordinated Organizations'
                          : 'Coordinated Organizations'}
                        organizations={userCoordinatedOrganizations}
                        role={OrganizationRole.Coordinator}
                      />
                    {/if}
                    {#if userOrganizations?.length > 0}
                      <UserOrganizationsTable
                        title={isCurrentUser ? 'My Organizations' : 'Member Organizations'}
                        organizations={userOrganizations}
                        role={OrganizationRole.Member}
                      />
                    {/if}
                  {:else}
                    <div class="flex flex-col items-center justify-center p-8">
                      <p class="mb-4 text-center text-lg">
                        {#if isCurrentUser}
                          You are not a member of any organizations yet.
                        {:else}
                          This user is not a member of any organizations.
                        {/if}
                      </p>
                      {#if isCurrentUser}
                        <a href="/organizations" class="variant-filled-primary btn"
                          >Browse Organizations</a
                        >
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            {:else if tabSet === 1}
              <!-- Requests Tab -->
              <div
                class="bg-surface-100-800-token/90 card p-4 backdrop-blur-lg rounded-container-token"
              >
                <div class="mb-4 flex items-center justify-between">
                  <h3 class="h3">{isCurrentUser ? 'My Requests' : 'Requests'}</h3>
                  {#if isCurrentUser && user.status?.status_type === 'accepted'}
                    <a href="/requests/create" class="variant-filled-primary btn"
                      >Create New Request</a
                    >
                  {/if}
                </div>

                {#if isLoadingRequests}
                  <div class="flex items-center justify-center p-8">
                    <p>Loading requests...</p>
                  </div>
                {:else if userRequests.length === 0}
                  <div class="flex flex-col items-center justify-center p-8">
                    <p class="mb-4 text-center text-lg">
                      {#if isCurrentUser}
                        You haven't created any requests yet.
                      {:else}
                        This user hasn't created any requests yet.
                      {/if}
                    </p>
                  </div>
                {:else}
                  <RequestsTable requests={userRequests} />
                {/if}
              </div>
            {:else if tabSet === 2}
              <!-- Offers Tab -->
              <div
                class="bg-surface-100-800-token/90 card p-4 backdrop-blur-lg rounded-container-token"
              >
                <div class="mb-4 flex items-center justify-between">
                  <h3 class="h3">{isCurrentUser ? 'My Offers' : 'Offers'}</h3>
                  {#if isCurrentUser && user.status?.status_type === 'accepted'}
                    <a href="/offers/create" class="variant-filled-primary btn">Create New Offer</a>
                  {/if}
                </div>

                {#if isLoadingOffers}
                  <div class="flex items-center justify-center p-8">
                    <p>Loading offers...</p>
                  </div>
                {:else if userOffers.length === 0}
                  <div class="flex flex-col items-center justify-center p-8">
                    <p class="mb-4 text-center text-lg">
                      {#if isCurrentUser}
                        You haven't created any offers yet.
                      {:else}
                        This user hasn't created any offers yet.
                      {/if}
                    </p>
                  </div>
                {:else}
                  <OffersTable offers={userOffers} />
                {/if}
              </div>
            {/if}
          </svelte:fragment>
        </TabGroup>
      </div>
    </div>
  {/if}
</section>
