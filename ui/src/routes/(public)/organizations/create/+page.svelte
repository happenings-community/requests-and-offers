<script lang="ts">
  import { goto } from '$app/navigation';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import type { OrganizationInDHT } from '$lib/types/holochain';
  import usersStore from '$lib/stores/users.store.svelte';
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import OrganizationForm from '$lib/components/organizations/OrganizationForm.svelte';
  import { runEffect } from '$lib/utils/effect';

  let isContact = $state(false);
  let contactRole = $state('');

  async function setCreatorAsContact(orgActionHash: ActionHash) {
    if (isContact && contactRole && usersStore.currentUser?.original_action_hash) {
      try {
        await runEffect(
          organizationsStore.setContact(
            orgActionHash,
            usersStore.currentUser.original_action_hash,
            contactRole
          )
        );
      } catch (err) {
        console.warn('Failed to set contact, can be done later from edit page:', err);
      }
    }
  }

  async function createOrganization(organization: OrganizationInDHT) {
    try {
      const record = await runEffect(organizationsStore.createOrganization(organization));

      // Refresh the current user to include the new organization
      await runEffect(usersStore.refreshCurrentUser());

      await setCreatorAsContact(record.signed_action.hashed.hash);

      goto(`/organizations/${encodeHashToBase64(record.signed_action.hashed.hash)}`);
    } catch (err) {
      console.error('Error creating organization:', err);
      return Promise.reject(err);
    }
  }

  async function handleMockCreated(orgActionHash: ActionHash) {
    await runEffect(usersStore.refreshCurrentUser());
    await setCreatorAsContact(orgActionHash);
  }
</script>

<section class="flex w-4/5 flex-col gap-10 md:w-3/4 lg:w-1/2">
  <h2 class="h2">Create new Organization</h2>

  <div class="space-y-2">
    <label class="flex items-center gap-2">
      <input type="checkbox" class="checkbox" bind:checked={isContact} />
      <span>I am the contact person for this organization</span>
    </label>
    {#if isContact}
      <label class="label">
        <span>Role / Title</span>
        <input
          class="input"
          type="text"
          placeholder="e.g. Director, President, Contact Person"
          bind:value={contactRole}
        />
      </label>
    {/if}
  </div>

  <OrganizationForm mode="create" onSubmit={createOrganization} onMockCreated={handleMockCreated} />
</section>
