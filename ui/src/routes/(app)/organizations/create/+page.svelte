<script lang="ts">
  import { goto } from '$app/navigation';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import type { OrganizationInDHT } from '$lib/types/holochain';
  import AlertModal from '$lib/components/shared/dialogs/AlertModal.svelte';
  import type { AlertModalMeta } from '$lib/types/ui';
  import usersStore from '$lib/stores/users.store.svelte';
  import { encodeHashToBase64 } from '@holochain/client';
  import OrganizationForm from '$lib/components/organizations/OrganizationForm.svelte';
  import { runEffect } from '$lib/utils/effect';

  async function createOrganization(organization: OrganizationInDHT) {
    try {
      const record = await runEffect(organizationsStore.createOrganization(organization));

      // Refresh the current user to include the new organization
      await runEffect(usersStore.refreshCurrentUser());

      goto(`/organizations/${encodeHashToBase64(record.signed_action.hashed.hash)}`);
    } catch (err) {
      console.error('Error creating organization:', err);
      return Promise.reject(err);
    }
  }
</script>

<section class="flex w-4/5 flex-col gap-10 md:w-3/4 lg:w-1/2">
  <h2 class="h2">Create new Organization</h2>
  <OrganizationForm mode="create" onSubmit={createOrganization} />
</section>
