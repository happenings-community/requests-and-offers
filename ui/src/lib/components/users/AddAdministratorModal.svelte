<script lang="ts">
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import type { ConfirmModalMeta } from '$lib/types/ui';
  import { Avatar, ConicGradient, getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import type { UIUser } from '$lib/types/ui';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { queueAndReverseModal } from '$lib/utils';

  const toastStore = getToastStore();

  const { nonAdministrators } = $derived(administrationStore);
  const { currentUser } = $derived(usersStore);

  let filteredUsers: UIUser[] = $state([]);
  let searchInput = $state('');
  let isLoading = $state(true);

  const conicStops: any[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  async function fetchUsers() {
    try {
      await administrationStore.fetchAllUsers();
      filteredUsers = nonAdministrators;
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
    fetchUsers();
  });

  const modalStore = getModalStore();

  const addAdministratorConfirmationModalMeta: ConfirmModalMeta = {
    id: 'confirm-add-administrator',
    message: 'Do you really want to make this user an administrator?',
    confirmLabel: 'Yes',
    cancelLabel: 'No'
  };

  const confirmModalComponent: any = { ref: ConfirmModal };

  async function handleSearch() {
    filteredUsers = nonAdministrators.filter(
      (user) =>
        user.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        user.email.toLowerCase().includes(searchInput.toLowerCase())
    );
  }

  const confirmModal = (meta: ConfirmModalMeta, user: UIUser): any => {
    return {
      type: 'component',
      component: confirmModalComponent,
      meta,
      async response(r: boolean) {
        if (!r) return;

        try {
          if (!currentUser?.original_action_hash || !user.original_action_hash) return;

          const userAgents = await usersStore.getUserAgents(user.original_action_hash!);

          if (!userAgents.length) {
            toastStore.trigger({
              message: 'User agents not found',
              background: 'variant-filled-error'
            });
            modalStore.close();
            return;
          }

          await administrationStore.addNetworkAdministrator(userAgents, user.original_action_hash);
          await administrationStore.fetchAllUsers();

          toastStore.trigger({
            message: 'Administrator added successfully',
            background: 'variant-filled-success'
          });
          modalStore.close();
        } catch (error) {
          toastStore.trigger({
            message: 'Failed to add administrator. Please try again.',
            background: 'variant-filled-error'
          });
          modalStore.clear();
        }
      }
    };
  };
</script>

<article class="hcron-modal">
  <header class="mb-4">
    <h3 class="h3">Add Administrator</h3>
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
    <p class="text-surface-400 text-center">No users found</p>
  {:else}
    <section class="space-y-4">
      {#each filteredUsers as user (user.original_action_hash)}
        <button
          type="button"
          class="card !bg-surface-700 hover:!bg-surface-600 w-full cursor-pointer p-4 text-left"
          onclick={() =>
            queueAndReverseModal(
              confirmModal(addAdministratorConfirmationModalMeta, user),
              modalStore
            )}
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
              <p class="text-surface-400 text-sm">{user.email}</p>
            </div>
          </div>
        </button>
      {/each}
    </section>
  {/if}
</article>

<style lang="postcss">
  .hcron-modal {
    @apply p-4;
  }
</style>
