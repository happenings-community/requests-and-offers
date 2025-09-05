<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import NavButton from '$lib/components/shared/NavButton.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import type { UserInput } from '$lib/types/holochain';
  import AlertModal from '$lib/components/shared/dialogs/AlertModal.svelte';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import UserForm from '$lib/components/users/UserForm.svelte';
  import { runEffect } from '$lib/utils/effect';

  const { currentUser } = $derived(usersStore);
  const modalStore = getModalStore();

  const alertModalComponent: ModalComponent = { ref: AlertModal };
  const alertModal = (meta: unknown): ModalSettings => ({
    type: 'component',
    component: alertModalComponent,
    meta
  });

  async function updateUser(input: UserInput) {
    try {
      await runEffect(usersStore.updateCurrentUser(input));

      modalStore.trigger(
        alertModal({
          id: 'profile-updated',
          message: 'Your profile has been successfully updated!',
          confirmLabel: 'Ok'
        })
      );

      goto('/user');
    } catch (err) {
      return Promise.reject(err instanceof Error ? err.message : 'Failed to update user profile');
    }
  }
</script>

<section class="flex w-1/2 flex-col gap-10">
  {#if !currentUser}
    <p class="mb-4 text-center text-xl">It looks like you don't have a profile yet !</p>
    <NavButton href="/user/create">Create Profile</NavButton>
  {:else}
    <h2 class="h2">Edit User</h2>
    <UserForm
      mode="edit"
      user={currentUser}
      serviceTypeHashes={currentUser.service_type_hashes || []}
      onSubmit={updateUser}
    />
  {/if}
</section>
