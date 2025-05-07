<script lang="ts">
  import { goto } from '$app/navigation';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import organizationsStore from '@stores/organizations.store.svelte';
  import type { OrganizationInDHT } from '@lib/types/holochain';
  import AlertModal from '@components/shared/dialogs/AlertModal.svelte';
  import type { AlertModalMeta } from '@lib/types/ui';
  import usersStore from '@stores/users.store.svelte';
  import { encodeHashToBase64 } from '@holochain/client';
  import OrganizationForm from '@lib/components/organizations/OrganizationForm.svelte';

  const alertModalComponent: ModalComponent = { ref: AlertModal };
  const alertModal = (meta: AlertModalMeta): ModalSettings => ({
    type: 'component',
    component: alertModalComponent,
    meta
  });

  const modalStore = getModalStore();

  async function createOrganization(organization: OrganizationInDHT) {
    try {
      const record = await organizationsStore.createOrganization(organization);

      await organizationsStore.getLatestOrganization(record.signed_action.hashed.hash);

      await usersStore.refreshCurrentUser();

      goto(`/organizations/${encodeHashToBase64(record.signed_action.hashed.hash)}`);
    } catch (err) {
      return Promise.reject(err);
    }
  }
</script>

<section class="flex w-4/5 flex-col gap-10 md:w-3/4 lg:w-1/2">
  <h2 class="h2">Create new Organization</h2>
  <OrganizationForm mode="create" onSubmit={createOrganization} />
</section>
