<script lang="ts">
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import type { ConfirmModalMeta } from '$lib/types/ui';
  import {
    Avatar,
    ConicGradient,
    getModalStore,
    getToastStore,
    type ModalComponent,
    type ModalSettings
  } from '@skeletonlabs/skeleton';
  import type { UIUser, UIOrganization } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import { queueAndReverseModal } from '$lib/utils';

  const modalStore = getModalStore();
  const { organization } = $modalStore[0].meta as { organization: UIOrganization };

  const toastStore = getToastStore();

  const users = $derived(usersStore.acceptedUsers);

  let filteredUsers: UIUser[] = $state([]);
  let searchInput = $state('');
  let isLoading = $state(true);

  const conicStops: Array<{ color: string; start: number; end: number }> = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  function compareUint8Arrays(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }

  async function loadUsers() {
    try {
      await runEffect(usersStore.getAcceptedUsers());

      // Use the existing members from the organization
      const existingMembers = organization.members || [];

      // Filter out existing members
      filteredUsers = users.filter(
        (user) =>
          !existingMembers.some((memberHash) =>
            compareUint8Arrays(memberHash, user.original_action_hash!)
          )
      );
    } catch (error) {
      toastStore.trigger({
        message: 'Failed to fetch users. Please try again.',
        background: 'variant-filled-error'
      });
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    loadUsers();
  });

  const addMemberConfirmationModalMeta: ConfirmModalMeta = {
    id: 'confirm-add-organization-member',
    message: 'Do you really want to add this user as a member of the organization?',
    confirmLabel: 'Yes',
    cancelLabel: 'No'
  };

  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  async function handleSearch() {
    try {
      // Use the existing members from the organization
      const existingMembers = organization.members || [];

      // Filter users
      filteredUsers = users.filter((user) => {
        const isNotMember = !existingMembers.some((memberHash) =>
          compareUint8Arrays(memberHash, user.original_action_hash!)
        );
        const matchesSearch =
          user.name.toLowerCase().includes(searchInput.toLowerCase()) ||
          user.email.toLowerCase().includes(searchInput.toLowerCase());

        return isNotMember && matchesSearch;
      });
    } catch (error) {
      console.error('Error in handleSearch:', error);
      filteredUsers = [];
    }
  }

  async function handleAddMember(user: UIUser) {
    if (!organization?.original_action_hash || !user.original_action_hash) return;

    const success = await runEffect(
      organizationsStore.addMember(organization.original_action_hash, user.original_action_hash)
    );

    if (success) {
      // Refresh the organization
      await runEffect(organizationsStore.getLatestOrganization(organization.original_action_hash));

      toastStore.trigger({
        message: 'Member added successfully',
        background: 'variant-filled-success'
      });
      modalStore.close();
    } else {
      toastStore.trigger({
        message: 'Failed to add member',
        background: 'variant-filled-error'
      });
    }
  }

  const confirmModal = (meta: ConfirmModalMeta, user: UIUser): ModalSettings => {
    return {
      type: 'component',
      component: confirmModalComponent,
      meta,
      async response(r: boolean) {
        if (!r) return;

        isProcessing = true;
        try {
          await handleAddMember(user);
        } catch (error) {
          toastStore.trigger({
            message: 'Failed to add member. Please try again.',
            background: 'variant-filled-error'
          });
        } finally {
          isProcessing = false;
        }
      }
    };
  };
</script>

<article class="hcron-modal p-4">
  <header class="mb-4">
    <h3 class="h3">Add Member to {organization.name}</h3>
    <div class="input-group input-group-divider mt-4 grid-cols-[auto_1fr_auto]">
      <div class="input-group-shim">🔍</div>
      <input
        type="search"
        placeholder="Search users..."
        bind:value={searchInput}
        oninput={handleSearch}
      />
    </div>
  </header>

  {#if isLoading}
    <div class="flex justify-center p-4">
      <ConicGradient stops={conicStops} spin />
    </div>
  {:else if filteredUsers.length === 0}
    <p class="text-center text-surface-400">No users available to add as members</p>
  {:else}
    <section class="space-y-4">
      {#each filteredUsers as user (user.original_action_hash)}
        <button
          type="button"
          class="card w-full cursor-pointer !bg-surface-700 p-4 text-left hover:!bg-surface-600"
          onclick={() =>
            queueAndReverseModal(confirmModal(addMemberConfirmationModalMeta, user), modalStore)}
        >
          <div class="flex items-center gap-4">
            <Avatar
              src={user?.picture
                ? URL.createObjectURL(new Blob([new Uint8Array(user.picture)]))
                : '/default_avatar.webp'}
              width="w-12"
            />
            <div class="flex-1">
              <h4 class="font-bold">{user.name}</h4>
              <p class="text-sm text-surface-400">{user.email}</p>
            </div>
          </div>
        </button>
      {/each}
    </section>
  {/if}
</article>
