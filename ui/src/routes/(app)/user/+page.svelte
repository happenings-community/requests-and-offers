<script lang="ts">
  import {
    getModalStore,
    Avatar,
    type ModalComponent,
    type ModalSettings
  } from '@skeletonlabs/skeleton';
  import type { Revision, UIOrganization } from '@/types/ui';
  import usersStore from '@/stores/users.store.svelte';
  import administrationStore from '@stores/administration.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import StatusHistoryModal from '@lib/modals/StatusHistoryModal.svelte';
  import NavButton from '@lib/NavButton.svelte';
  import { OrganizationRole } from '@/types/ui';
  import UserOrganizationsTable from '@/lib/tables/UserOrganizationsTable.svelte';

  const modalStore = getModalStore();
  const { currentUser } = $derived(usersStore);

  let userPictureUrl = $derived.by(() =>
    currentUser?.picture
      ? URL.createObjectURL(new Blob([new Uint8Array(currentUser.picture)]))
      : '/default_avatar.webp'
  );

  let error = $state<string | null>(null);
  let suspensionDate = $state('');
  let isExpired = $state(false);

  let myOrganizations: UIOrganization[] = $state([]);
  let myCoordinatedOrganizations: UIOrganization[] = $state([]);

  $inspect('Current user:', currentUser);
  async function fetchUserData() {
    try {
      await usersStore.refreshCurrentUser();

      if (!currentUser) {
        error = 'No user profile found';
        return;
      }

      myOrganizations = await organizationsStore.getUserMemberOnlyOrganizations(
        currentUser.original_action_hash!
      );
      myCoordinatedOrganizations = await organizationsStore.getUserCoordinatedOrganizations(
        currentUser.original_action_hash!
      );
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      error = 'Failed to load user data. Please try again later.';
    }
  }

  $effect(() => {
    fetchUserData();
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
      const statusLink = await usersStore.getUserStatusLink(currentUser?.original_action_hash!);
      if (!statusLink) return;

      const statusHistory = await administrationStore.getAllRevisionsForStatus(currentUser!);

      console.log('statusHistory :', statusHistory);

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
  {:else if !currentUser}
    <p class="mb-4 text-center text-xl">It looks like you don't have a user profile yet!</p>
    <NavButton href="/user/create">Create Profile</NavButton>
  {:else}
    <div class="mb-10 flex flex-col items-center gap-5">
      <h2 class="h2">
        Welcome <span class="text-primary-500 font-bold">{currentUser.name}</span> !
      </h2>
      <a href="/user/edit" class="btn variant-filled-primary w-fit text-white">Edit profile</a>
    </div>
    <div
      class="border-surface-600 bg-surface-400 flex w-4/5 min-w-96 flex-col items-center gap-5 rounded-xl border-8 p-5 drop-shadow-xl"
    >
      <h3 class="h3"><b>Nickname :</b> {currentUser.nickname}</h3>
      <h3 class="h3 text-wrap text-center">
        <b>Status :</b>
        <span
          class:text-primary-500={currentUser!.status?.status_type === 'pending'}
          class:text-error-500={currentUser!.status?.status_type === 'rejected' ||
            currentUser!.status?.status_type === 'suspended indefinitely'}
          class:text-green-400={currentUser!.status?.status_type === 'accepted'}
          class:text-warning-500={currentUser!.status?.status_type === `suspended temporarily`}
        >
          {#if !suspensionDate}
            {currentUser!.status?.status_type}
          {:else}
            {isExpired ? 'In review' : 'suspended temporarily'}
          {/if}
        </span>
      </h3>
      {#if currentUser?.status?.status_type && currentUser.status.status_type.startsWith('suspended')}
        <p class=" text-wrap text-center"><b>Reason :</b> {currentUser.status.reason}</p>
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

      <div onload={() => URL.revokeObjectURL(userPictureUrl)}>
        <Avatar src={userPictureUrl} width="w-64" background="none" />
      </div>
      <p class="text-center">{currentUser.bio}</p>
      <p><b>Type :</b> {currentUser.user_type}</p>
      {#if currentUser.skills?.length}
        <p class="text-center"><b>Skills :</b> {currentUser.skills?.join(', ')}</p>
      {/if}
      <p><b>Email :</b> {currentUser.email}</p>
      {#if currentUser.phone}
        <p><b>Phone number :</b> {currentUser.phone}</p>
      {/if}
      {#if currentUser.time_zone}
        <p><b>Timezone :</b> {currentUser.time_zone}</p>
      {/if}
      {#if currentUser.location}
        <p><b>Location :</b> {currentUser.location}</p>
      {/if}

      <!-- Organizations Section -->
      <div class="w-full space-y-4">
        {#if myOrganizations?.length > 0}
          <UserOrganizationsTable
            title="My Organizations"
            organizations={myOrganizations}
            role={OrganizationRole.Member}
          />
        {/if}
        {#if myCoordinatedOrganizations?.length > 0}
          <UserOrganizationsTable
            title="My Coordinated Organizations"
            organizations={myCoordinatedOrganizations}
            role={OrganizationRole.Coordinator}
          />
        {/if}
      </div>
    </div>
  {/if}
</section>
