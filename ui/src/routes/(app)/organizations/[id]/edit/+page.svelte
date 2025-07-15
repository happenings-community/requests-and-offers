<script lang="ts">
  import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import type { OrganizationInDHT } from '$lib/types/holochain';
  import OrganizationForm from '$lib/components/organizations/OrganizationForm.svelte';
  import AlertModal from '$lib/components/shared/dialogs/AlertModal.svelte';
  import { Effect as E } from 'effect';
  import { runEffect } from '$lib/utils/effect';
  import type { UIOrganization } from '@/lib/composables';

  const toastStore = getToastStore();
  const organizationHash = decodeHashFromBase64($page.params.id) as ActionHash;

  let organization: UIOrganization | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Load organization when the component mounts
  $effect(() => {
    if (organizationHash) {
      loadOrganization();
    }
  });

  async function loadOrganization() {
    try {
      loading = true;
      error = null;
      organization = await E.runPromise(organizationsStore.getLatestOrganization(organizationHash));
    } catch (e) {
      console.error('Error loading organization:', e);
      error = 'Failed to load organization';
    } finally {
      loading = false;
    }
  }

  async function handleUpdateOrganization(updates: OrganizationInDHT) {
    if (!organization) return;

    try {
      loading = true;

      if (!organization.original_action_hash) {
        throw new Error('Organization action hash not found');
      }

      const updatedOrganization = await runEffect(
        organizationsStore.updateOrganization(organizationHash, updates)
      );

      if (!updatedOrganization) {
        throw new Error('Failed to update organization');
      }

      toastStore.trigger({
        message: 'Organization updated successfully',
        background: 'variant-filled-success'
      });

      // Navigate back to organization page
      goto(`/organizations/${$page.params.id}`);
    } catch (e) {
      console.error('Error updating organization:', e);
      return Promise.reject('Failed to update organization');
    } finally {
      loading = false;
    }
  }

  async function handleDeleteOrganization() {
    try {
      loading = true;

      const success = await organizationsStore.deleteOrganization(organizationHash);

      if (success) {
        toastStore.trigger({
          message: 'Organization deleted successfully',
          background: 'variant-filled-success'
        });

        goto('/organizations');
      } else {
        throw new Error('Failed to delete organization');
      }
    } catch (e) {
      console.error('Error deleting organization:', e);
      return Promise.reject('Failed to delete organization');
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto max-w-3xl py-8">
  {#if error}
    <div class="alert variant-filled-error" role="alert">
      <p>{error}</p>
      <button class="variant-soft btn btn-sm" onclick={loadOrganization}>Try Again</button>
    </div>
  {:else if loading && !organization}
    <div class="flex justify-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if organization}
    <div class="card w-full p-6">
      <header class="mb-4">
        <div class="flex items-center justify-between">
          <h2 class="h2">Edit Organization</h2>
          <button
            class="variant-ghost-surface btn"
            onclick={() => goto(`/organizations/${$page.params.id}`)}
          >
            Cancel
          </button>
        </div>
      </header>

      <OrganizationForm
        mode="edit"
        {organization}
        onSubmit={handleUpdateOrganization}
        onDelete={handleDeleteOrganization}
      />
    </div>
  {:else}
    <div class="flex justify-center p-8">
      <p class="text-surface-600-300-token">Organization not found</p>
    </div>
  {/if}
</div>
