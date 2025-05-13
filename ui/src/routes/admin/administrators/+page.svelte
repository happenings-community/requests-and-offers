<script lang="ts">
  import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
  import { onMount } from 'svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import UsersTable from '$lib/components/users/UsersTable.svelte';
  import AddAdministratorModal from '$lib/components/users/AddAdministratorModal.svelte';

  const { administrators } = $derived(administrationStore);

  const modalStore = getModalStore();
  const addAdministratorModalComponent: ModalComponent = { ref: AddAdministratorModal };
  const addAdministratorModal: ModalSettings = {
    type: 'component',
    component: addAdministratorModalComponent
  };

  let isLoading = $state(true);

  $inspect('administrators:', administrators);

  onMount(async () => {
    await administrationStore.getAllNetworkAdministrators();

    isLoading = false;
  });
</script>

<section class="flex flex-col gap-10">
  <h1 class="h1 text-center">Administrators management</h1>

  <div class="flex flex-col gap-4 lg:pr-4">
    <div class="flex flex-col items-center justify-center sm:flex-row sm:justify-around">
      <h2 class="h3">Network administrators</h2>
      <button
        class="btn variant-filled-secondary w-fit"
        onclick={() => modalStore.trigger(addAdministratorModal)}>Add administrator</button
      >
    </div>

    {#if administrators && administrators.length > 0}
      <UsersTable users={administrators} />
    {/if}
  </div>
</section>
