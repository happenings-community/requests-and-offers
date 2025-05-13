<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  import { goto } from '$app/navigation';
  import AlertModal from '$lib/components/shared/dialogs/AlertModal.svelte';
  import type { AlertModalMeta } from '$lib/types/ui';
  import type { UserInDHT } from '$lib/types/holochain';
  import UserForm from '$lib/components/users/UserForm.svelte';

  const alertModalComponent: ModalComponent = { ref: AlertModal };
  const alertModal = (meta: AlertModalMeta): ModalSettings => ({
    type: 'component',
    component: alertModalComponent,
    meta
  });

  const { currentUser } = $derived(usersStore);
  const modalStore = getModalStore();

  async function createUser(user: UserInDHT) {
    try {
      await usersStore.createUser(user);
      await usersStore.refreshCurrentUser();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  $effect(() => {
    if (currentUser) {
      goto('/user');
    }
  });
</script>

<section class="flex w-4/5 flex-col gap-10 md:w-3/4 lg:w-1/2">
  <h2 class="h2">Create User Profile</h2>

  <UserForm mode="create" onSubmit={createUser} />
</section>
