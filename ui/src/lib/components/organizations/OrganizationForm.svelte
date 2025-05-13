<script lang="ts">
  import { goto } from '$app/navigation';
  import { FileDropzone, Avatar, getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import { createMockedOrganizations } from '$lib/utils/mocks';
  import type { OrganizationInDHT } from '$lib/types/holochain';
  import AlertModal from '$lib/components/shared/dialogs/AlertModal.svelte';
  import type { ActionHash } from '@holochain/client';
  import { encodeHashToBase64 } from '@holochain/client';

  type Props = {
    mode: 'create' | 'edit';
    organization?: OrganizationInDHT & {
      original_action_hash?: ActionHash;
    };
    onSubmit?: (organization: OrganizationInDHT) => Promise<void>;
    onDelete?: () => Promise<void>;
  };

  const { mode = 'create', organization, onSubmit, onDelete }: Props = $props();

  // Modal setup
  const alertModalComponent: ModalComponent = { ref: AlertModal };
  const modalStore = getModalStore();
  const alertModal = (meta: any): ModalSettings => ({
    type: 'component',
    component: alertModalComponent,
    meta
  });

  // Form state
  let form: HTMLFormElement | undefined = $state();
  let organizationLogo: Blob | null = $state(null);
  let files: FileList | undefined = $state();
  let fileMessage: string = $state('');
  let isChanged = $state(mode === 'create');
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Form fields
  let formName = $state(organization?.name || '');
  let formDescription = $state(organization?.description || '');
  let formEmail = $state(organization?.email || '');
  let formLocation = $state(organization?.location || '');
  let formUrls = $state(organization?.urls?.join(', ') || '');

  const welcomeAndNextStepsMessage = (name: string) => `
    <img src="/hAppeningsLogoWsun2.webp" alt="hAppenings Community Logo" class="w-28" />
    <h2 class="text-center text-xl font-semibold">Your organization has been created!</h2>
    <p class="text-center text-lg">Your organization ${name}, has been successfully created!</p>
    <div class="space-y-4">
      <div class="rounded-lg border-l-4 border-blue-500 p-4">
        <h3 class="text-tertiary-500 text-lg font-bold">Important Next Steps:</h3>
        <ul class="mt-2 list-disc space-y-2 pl-5 text-left">
          <li>A network administrator will contact you via email and platform message shortly.</li>
          <li>You'll be invited to schedule a meeting for identity verification.</li>
          <li>
            After successful verification, the status of your organization will update to "accepted".
          </li>
        </ul>
      </div>
      <p class="text-sm">
        Once accepted, you'll gain full access to participate in our vibrant community!
      </p>
    </div>`;

  // Initialize logo if editing
  $effect(() => {
    if (mode === 'edit' && organization?.logo) {
      organizationLogo = new Blob([organization.logo]);
    }
  });

  async function onLogoFileChange() {
    fileMessage = `${files![0].name}`;
    organizationLogo = new Blob([new Uint8Array(await files![0].arrayBuffer())]);
    isChanged = true;
  }

  function removeOrganizationLogo() {
    isChanged = true;
    organizationLogo = null;
    fileMessage = '';
    const logoInput = form!.querySelector('input[name="logo"]') as HTMLInputElement;
    if (logoInput) {
      logoInput.value = '';
    }
  }

  async function mockOrganization() {
    isLoading = true;
    error = null;
    try {
      let org: OrganizationInDHT = (await createMockedOrganizations())[0];

      const record = await organizationsStore.createOrganization(org);

      const organization = await organizationsStore.getLatestOrganization(
        record.signed_action.hashed.hash
      );

      modalStore.trigger(
        alertModal({
          id: 'welcome-and-next-steps',
          message: welcomeAndNextStepsMessage(organization?.name || ''),
          confirmLabel: 'Ok !'
        })
      );

      const orgId = encodeHashToBase64(record.signed_action.hashed.hash);
      goto(`/organizations/${orgId}`);
    } catch (err) {
      error = 'Failed to create mocked organization';
      console.error('Mocked organization creation error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete() {
    if (!organization) return;

    try {
      // Confirm deletion
      const confirmed = await new Promise<boolean>((resolve) => {
        modalStore.trigger({
          type: 'confirm',
          title: 'Delete Organization',
          body: `Are you sure you want to delete the organization <b>${formName}</b>? This action cannot be undone.`,
          response: (r: boolean) => resolve(r)
        });
      });

      if (!confirmed) return;

      isLoading = true;

      if (onDelete) {
        await onDelete();
      }
    } catch (e) {
      console.error('Error deleting organization:', e);
      error = 'Failed to delete organization';
    } finally {
      isLoading = false;
    }
  }

  async function submitForm(event: SubmitEvent) {
    event.preventDefault();
    isLoading = true;
    error = null;

    try {
      const data = new FormData(event.target as HTMLFormElement);
      const logoBuffer = await (data.get('logo') as File).arrayBuffer();
      const logo = new Uint8Array(logoBuffer);

      // Parse URLs from comma-separated string
      const urls = formUrls
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);

      const organizationData: OrganizationInDHT = {
        name: formName,
        description: formDescription,
        email: formEmail,
        location: formLocation,
        urls,
        logo: logo.byteLength > 0 ? logo : mode === 'edit' ? organization?.logo : undefined
      };

      if (onSubmit) {
        await onSubmit(organizationData);
      } else {
        // Default behavior if no onSubmit provided
        if (mode === 'create') {
          const record = await organizationsStore.createOrganization(organizationData);
          const orgId = encodeHashToBase64(record.signed_action.hashed.hash);
          goto(`/organizations/${orgId}`);
        } else if (mode === 'edit' && organization?.original_action_hash) {
          await organizationsStore.updateOrganization(
            organization.original_action_hash,
            organizationData
          );
          goto('/organizations');
        }
      }

      // Reset form if creating
      if (mode === 'create') {
        form?.reset();
        organizationLogo = null;
        fileMessage = '';
        isChanged = false;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : `Failed to ${mode} organization`;
      console.error(`Organization ${mode} error:`, err);
    } finally {
      isLoading = false;
    }
  }
</script>

<form
  class="flex flex-col gap-4"
  enctype="multipart/form-data"
  onsubmit={submitForm}
  bind:this={form}
  oninput={() => (isChanged = true)}
>
  {#if error}
    <div class="alert variant-filled-error">
      <p>{error}</p>
      <button
        class="btn btn-sm variant-soft"
        onclick={() => {
          error = null;
        }}
      >
        Dismiss
      </button>
    </div>
  {/if}

  {#if mode === 'create'}
    <p>*required fields</p>
  {/if}

  <label class="label">
    <span>Name*</span>
    <input class="input" type="text" name="name" bind:value={formName} required />
  </label>

  <label class="label">
    <span>Description*</span>
    <textarea class="textarea" name="description" rows="3" bind:value={formDescription} required
    ></textarea>
  </label>

  <div class="space-y-2">
    <label class="label space-y-2">
      <span>Organization Logo</span>
      <FileDropzone name="logo" accept="image/*" bind:files onchange={onLogoFileChange} />
      <div class="mt-2 flex items-center gap-2">
        {#if fileMessage}
          <span class="text-sm">{fileMessage}</span>
        {/if}
        <button type="button" class="btn btn-sm variant-soft" onclick={removeOrganizationLogo}>
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

  <label class="label">
    <span>Email*</span>
    <input class="input" type="email" name="email" bind:value={formEmail} required />
  </label>

  <label class="label">
    <span>URLs (comma-separated)</span>
    <input
      class="input"
      type="text"
      name="urls"
      placeholder="website, x, github, other..."
      bind:value={formUrls}
    />
  </label>

  <label class="label">
    <span>Location*</span>
    <input class="input" type="text" name="location" bind:value={formLocation} required />
  </label>

  <div class="flex gap-4">
    <button type="submit" class="btn variant-filled-primary" disabled={!isChanged || isLoading}>
      {#if isLoading}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      {mode === 'create' ? 'Create' : 'Save'} Organization
    </button>

    {#if mode === 'create'}
      <button
        type="button"
        class="btn variant-filled-tertiary"
        onclick={mockOrganization}
        disabled={isLoading}
      >
        Create Mocked Organization
      </button>
    {:else if onDelete}
      <button
        type="button"
        class="btn variant-filled-error"
        onclick={handleDelete}
        disabled={isLoading}
      >
        {#if isLoading}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Delete Organization
      </button>
    {/if}
  </div>
</form>
