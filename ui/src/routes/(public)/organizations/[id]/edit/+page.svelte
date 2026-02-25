<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import type { OrganizationInDHT } from '$lib/types/holochain';
  import OrganizationForm from '$lib/components/organizations/OrganizationForm.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { UIOrganization } from '@/lib/composables';

  const toastStore = getToastStore();
  const organizationHash = $page.params.id
    ? (decodeHashFromBase64($page.params.id) as ActionHash)
    : null;

  let organization: UIOrganization | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Contact management state
  let resolvedContactName = $state('');
  let contactRole = $state('');
  let selectedContactCoordinatorHash = $state<ActionHash | null>(null);
  let coordinatorOptions = $state<{ hash: ActionHash; name: string }[]>([]);

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
      if (!organizationHash) {
        throw new Error('Invalid organization ID');
      }
      organization = await runEffect(organizationsStore.getLatestOrganization(organizationHash));
    } catch (e) {
      console.error('Error loading organization:', e);
      error = 'Failed to load organization';
    } finally {
      loading = false;
    }
  }

  // Resolve contact name when organization has a contact
  $effect(() => {
    if (organization?.contact?.user_hash) {
      runEffect(usersStore.getUserByActionHash(organization.contact.user_hash)).then((user) => {
        if (user) resolvedContactName = user.name;
      });
    } else {
      resolvedContactName = '';
    }
  });

  // Load coordinator options when organization is loaded
  $effect(() => {
    if (organization?.coordinators) {
      Promise.all(
        organization.coordinators.map(async (hash) => {
          const user = await runEffect(usersStore.getUserByActionHash(hash));
          return { hash, name: user?.name || encodeHashToBase64(hash).slice(0, 8) };
        })
      ).then((resolved) => {
        coordinatorOptions = resolved;
      });
    }
  });

  async function handleSetContact() {
    if (!organization?.original_action_hash || !selectedContactCoordinatorHash || !contactRole)
      return;
    try {
      await runEffect(
        organizationsStore.setContact(
          organization.original_action_hash,
          selectedContactCoordinatorHash,
          contactRole
        )
      );
      toastStore.trigger({
        message: 'Contact person set successfully',
        background: 'variant-filled-success'
      });
      contactRole = '';
      selectedContactCoordinatorHash = null;
      await loadOrganization();
    } catch (err) {
      toastStore.trigger({
        message: `Failed to set contact: ${err}`,
        background: 'variant-filled-error'
      });
    }
  }

  async function handleRemoveContact() {
    if (!organization?.original_action_hash) return;
    try {
      await runEffect(organizationsStore.removeContact(organization.original_action_hash));
      toastStore.trigger({
        message: 'Contact person removed',
        background: 'variant-filled-success'
      });
      await loadOrganization();
    } catch (err) {
      toastStore.trigger({
        message: `Failed to remove contact: ${err}`,
        background: 'variant-filled-error'
      });
    }
  }

  async function handleUpdateOrganization(updates: OrganizationInDHT) {
    if (!organization) return;

    try {
      loading = true;

      if (!organization.original_action_hash) {
        throw new Error('Organization action hash not found');
      }

      if (!organizationHash) {
        throw new Error('Invalid organization ID');
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

      if (!organizationHash) {
        throw new Error('Invalid organization ID');
      }
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

    <!-- Contact Person Management -->
    <div class="card mt-6 w-full p-6">
      <h3 class="h3 mb-4">Contact Person</h3>

      {#if organization.contact}
        <div class="mb-4 flex items-center justify-between">
          <p>
            <strong>Current Contact:</strong>
            {resolvedContactName || '...'} - {organization.contact.role}
          </p>
          <button class="variant-soft-error btn btn-sm" onclick={handleRemoveContact}>
            Remove Contact
          </button>
        </div>
      {:else}
        <p class="text-surface-600-300-token mb-4">No contact person set.</p>
      {/if}

      <div class="space-y-3">
        <label class="label">
          <span>Coordinator</span>
          <select
            class="select"
            onchange={(e) => {
              const idx = parseInt(e.currentTarget.value);
              selectedContactCoordinatorHash = isNaN(idx) ? null : coordinatorOptions[idx].hash;
            }}
          >
            <option value="">Select a coordinator...</option>
            {#each coordinatorOptions as coordinator, i}
              <option value={i}>{coordinator.name}</option>
            {/each}
          </select>
        </label>
        <label class="label">
          <span>Role / Title</span>
          <input
            class="input"
            type="text"
            placeholder="e.g. Director, President, Contact Person"
            bind:value={contactRole}
          />
        </label>
        <button
          class="variant-filled-primary btn"
          disabled={!selectedContactCoordinatorHash || !contactRole}
          onclick={handleSetContact}
        >
          {organization.contact ? 'Change Contact' : 'Set Contact'}
        </button>
      </div>
    </div>
  {:else}
    <div class="flex justify-center p-8">
      <p class="text-surface-600-300-token">Organization not found</p>
    </div>
  {/if}
</div>
