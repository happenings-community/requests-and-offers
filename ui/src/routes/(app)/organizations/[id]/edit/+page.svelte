<script lang="ts">
  import { page } from '$app/stores';
  import { Avatar, getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import { FileDropzone } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import type { UIOrganization } from '@types/ui';
  import organizationsStore from '@stores/organizations.store.svelte';
  import { decodeHashFromBase64, type ActionHash } from '@holochain/client';

  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const organizationHash = decodeHashFromBase64($page.params.id) as ActionHash;

  let form: HTMLFormElement | undefined = $state();
  let organization: UIOrganization | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Form state
  let formName = $state('');
  let formDescription = $state('');
  let formEmail = $state('');
  let formLocation = $state('');
  let formUrls = $state('');

  // Logo state
  let organizationLogo: Blob | null = $state(null);
  let files: FileList | undefined = $state();
  let fileMessage: string = $state('');
  let isChanged = $state(false);

  // Update form values when organization changes
  $effect(() => {
    if (organization) {
      formName = organization.name;
      formDescription = organization.description;
      formEmail = organization.email;
      formLocation = organization.location;
      formUrls = organization.urls.join(', ');
    }
  });

  // Update logo when organization changes
  $effect(() => {
    if (organization?.logo) {
      organizationLogo = new Blob([organization.logo]);
    }
  });

  async function onLogoFileChange() {
    fileMessage = `${files![0].name}`;
    organizationLogo = new Blob([new Uint8Array(await files![0].arrayBuffer())]);
    isChanged = true;
  }

  function RemoveOrganizationLogo() {
    isChanged = true;
    organizationLogo = null;
    fileMessage = '';
    const logoInput = form!.querySelector('input[name="logo"]') as HTMLInputElement;
    if (logoInput) {
      logoInput.value = '';
    }

    if (organization) {
      organization.logo = undefined;
    }
  }

  async function handleUpdateSettings(event: Event) {
    event.preventDefault();
    if (!organization) return;

    try {
      loading = true;

      // Parse URLs from comma-separated string
      const urls = formUrls
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);

      // Create update object
      const updates = {
        name: formName,
        description: formDescription,
        email: formEmail,
        location: formLocation,
        urls,
        ...(isChanged
          ? {
              logo: organizationLogo
                ? new Uint8Array(await organizationLogo.arrayBuffer())
                : undefined
            }
          : { logo: organization.logo })
      };

      // Update organization
      if (!organization.original_action_hash) {
        throw new Error('Organization action hash not found');
      }

      const updatedOrganization = await organizationsStore.updateOrganization(
        organization.original_action_hash,
        updates
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
      toastStore.trigger({
        message: 'Failed to update organization',
        background: 'variant-filled-error'
      });
    } finally {
      loading = false;
    }
  }

  async function handleDeleteOrganization() {
    if (!organization) return;

    try {
      // Confirm deletion
      const confirmed = await new Promise<boolean>((resolve) => {
        modalStore.trigger({
          type: 'confirm',
          title: 'Delete Organization',
          body: `Are you sure you want to delete the organization <b>${organization!.name}</b>? This action cannot be undone.`,
          response: (r: boolean) => resolve(r)
        });
      });

      if (!confirmed) return;

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
      toastStore.trigger({
        message: 'Failed to delete organization',
        background: 'variant-filled-error'
      });
    } finally {
      loading = false;
    }
  }

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
      organization = await organizationsStore.getLatestOrganization(organizationHash);
    } catch (e) {
      console.error('Error loading organization:', e);
      error = 'Failed to load organization';
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto max-w-3xl py-8">
  {#if error}
    <div class="alert variant-filled-error" role="alert">
      <p>{error}</p>
      <button class="btn btn-sm variant-soft" onclick={loadOrganization}>Try Again</button>
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
            class="btn variant-ghost-surface"
            onclick={() => goto(`/organizations/${$page.params.id}`)}
          >
            Cancel
          </button>
        </div>
      </header>

      <form bind:this={form} onsubmit={handleUpdateSettings} class="space-y-4">
        <label class="label">
          <span>Name</span>
          <input class="input" type="text" name="name" bind:value={formName} required />
        </label>

        <label class="label">
          <span>Description</span>
          <textarea
            class="textarea"
            name="description"
            rows="3"
            bind:value={formDescription}
            required
          ></textarea>
        </label>

        <label class="label">
          <span>Email</span>
          <input class="input" type="email" name="email" bind:value={formEmail} required />
        </label>

        <label class="label">
          <span>Location</span>
          <input class="input" type="text" name="location" bind:value={formLocation} required />
        </label>

        <label class="label">
          <span>URLs (comma-separated)</span>
          <input class="input" type="text" name="urls" bind:value={formUrls} />
        </label>

        <div class="space-y-2">
          <label class="label">
            <span>Organization Logo</span>
            <FileDropzone name="logo" accept="image/*" bind:files onchange={onLogoFileChange} />
            <div class="mt-2 flex items-center gap-2">
              {#if fileMessage}
                <span class="text-sm">{fileMessage}</span>
              {/if}
              <button
                type="button"
                class="btn btn-sm variant-soft"
                onclick={RemoveOrganizationLogo}
              >
                Remove
              </button>
            </div>
          </label>

          {#if organizationLogo}
            <div class="mt-4">
              <Avatar src={URL.createObjectURL(organizationLogo)} width="w-32" />
            </div>
          {/if}
        </div>

        <div class="flex gap-4">
          <button type="submit" class="btn variant-filled-primary" disabled={loading}>
            {#if loading}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Save Changes
          </button>

          <button
            type="button"
            class="btn variant-filled-error"
            onclick={handleDeleteOrganization}
            disabled={loading}
          >
            {#if loading}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Delete Organization
          </button>
        </div>
      </form>
    </div>
  {:else}
    <div class="flex justify-center p-8">
      <p class="text-surface-600-300-token">Organization not found</p>
    </div>
  {/if}
</div>
