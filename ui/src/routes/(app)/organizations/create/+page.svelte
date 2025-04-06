<script lang="ts">
  import { goto } from '$app/navigation';
  import { FileDropzone, Avatar, getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import organizationsStore from '@stores/organizations.store.svelte';
  import { createMockedOrganizations } from '@utils/mocks';
  import type { OrganizationInDHT } from '@lib/types/holochain';
  import AlertModal from '@components/shared/dialogs/AlertModal.svelte';
  import type { AlertModalMeta } from '@lib/types/ui';
  import usersStore from '@stores/users.store.svelte';
  import { encodeHashToBase64 } from '@holochain/client';

  const alertModalComponent: ModalComponent = { ref: AlertModal };
  const alertModal = (meta: AlertModalMeta): ModalSettings => ({
    type: 'component',
    component: alertModalComponent,
    meta
  });

  const modalStore = getModalStore();

  let isLoading = $state(false);
  let error = $state<string | null>(null);

  let form: HTMLFormElement;
  let organizationLogo: Blob | null = $state(null);
  let files: FileList | undefined = $state();
  let fileMessage: string = $state('');

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

  async function onLogoFileChange() {
    fileMessage = `${files![0].name}`;
    organizationLogo = new Blob([new Uint8Array(await files![0].arrayBuffer())]);
  }

  function RemoveOrganizationLogo() {
    organizationLogo = null;
    fileMessage = '';
    const pictureInput = form.querySelector('input[name="logo"]') as HTMLInputElement;
    if (pictureInput) {
      pictureInput.value = '';
    }
  }

  async function createOrganization(organization: OrganizationInDHT) {
    try {
      const record = await organizationsStore.createOrganization(organization);

      await organizationsStore.getLatestOrganization(record.signed_action.hashed.hash);

      await usersStore.refreshCurrentUser();

      modalStore.trigger(
        alertModal({
          id: 'welcome-and-next-steps',
          message: welcomeAndNextStepsMessage(organization.name),
          confirmLabel: 'Ok !'
        })
      );

      goto(`/organizations/${encodeHashToBase64(record.signed_action.hashed.hash)}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create organization';
      console.error('Organization creation error:', err);
    }
  }

  async function mockOrganization() {
    isLoading = true;
    error = null;
    try {
      let organization: OrganizationInDHT = (await createMockedOrganizations())[0];
      await createOrganization(organization);
    } catch (err) {
      error = 'Failed to create mocked organization';
      console.error('Mocked organization creation error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function submitForm(event: SubmitEvent) {
    event.preventDefault();
    isLoading = true;
    error = null;

    const data = new FormData(event.target as HTMLFormElement);
    const logoBuffer = await (data.get('logo') as File).arrayBuffer();
    const logo = new Uint8Array(logoBuffer);

    const organization: OrganizationInDHT = {
      name: data.get('name') as string,
      description: data.get('description') as string,
      logo: logo.byteLength > 0 ? logo : undefined,
      email: data.get('email') as string,
      urls: (data.get('urls') as string).split(',').map((url) => url.trim()),
      location: data.get('location') as string
    };

    try {
      await createOrganization(organization);
    } catch (err) {
      error = 'Failed to submit organization';
      console.error('Organization submission error:', err);
    } finally {
      isLoading = false;
    }
  }
</script>

<section class="flex w-4/5 flex-col gap-10 md:w-3/4 lg:w-1/2">
  <h2 class="h2">Create new Organization</h2>

  {#if error}
    <div class="alert variant-filled-error">
      <p>{error}</p>
      <button
        class="btn btn-sm variant-soft"
        onclick={() => {
          error = null;
        }}>Dismiss</button
      >
    </div>
  {/if}

  <form
    class="flex flex-col gap-4"
    enctype="multipart/form-data"
    onsubmit={submitForm}
    bind:this={form}
  >
    <p>*required fields</p>
    <label class="label text-lg">
      Name* :<input type="text" class="input" name="name" required />
    </label>

    <label class="label text-lg">
      Description :
      <textarea class="textarea" name="description"></textarea>
    </label>

    <p class="label text-lg">Organization's logo :</p>
    <FileDropzone name="logo" bind:files onchange={onLogoFileChange} accept="image/*" />
    <div class="flex items-center justify-between">
      <p class="italic">{fileMessage}</p>
      {#if files && organizationLogo}
        <div>
          <Avatar src={URL.createObjectURL(organizationLogo)} />
          <button class="cursor-pointer underline" onclick={RemoveOrganizationLogo}>
            Remove
          </button>
        </div>
      {/if}
    </div>

    <label class="label text-lg">
      Email* :
      <input type="email" class="input" name="email" required />
    </label>

    <legend class="border-surface-500 flex flex-col gap-2 rounded-lg border-2 p-4">
      <p class="label text-lg font-bold">URLs</p>
      <label class="label text-lg">
        <span>URLs (comma-separated)</span>
        <input type="text" class="input" name="urls" placeholder="website, x, github, other..." />
      </label>
    </legend>

    <label class="label text-lg">
      Location :
      <input type="text" class="input" name="location" />
    </label>

    <div class="flex justify-around">
      <button
        type="submit"
        class="btn variant-filled-primary w-fit self-center"
        disabled={isLoading}
      >
        {#if isLoading}
          Creating Organization...
        {:else}
          Create Organization
        {/if}
      </button>

      <button
        type="button"
        class="btn variant-filled-tertiary w-fit self-center"
        onclick={mockOrganization}
        disabled={isLoading}
      >
        Create Mocked Organization
      </button>
    </div>
  </form>
</section>
