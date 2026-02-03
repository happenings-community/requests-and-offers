<script lang="ts">
  import { Avatar, FileDropzone, getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import type { UserInDHT, UserType } from '$lib/types/holochain';
  import TimeZoneSelect from '$lib/components/shared/TimeZoneSelect.svelte';
  import AlertModal from '$lib/components/shared/dialogs/AlertModal.svelte';
  import type { AlertModalMeta } from '$lib/types/ui';
  import { createMockedUsers } from '$lib/utils/mocks';
  import { shouldShowMockButtons } from '$lib/services/devFeatures.service';
  import { goto } from '$app/navigation';
  import weaveStore from '$lib/stores/weave.store.svelte';

  type Props = {
    mode: 'create' | 'edit';
    user?: UserInDHT;
    onSubmit: (input: UserInDHT) => Promise<void>;
  };

  const { mode = 'create', user, onSubmit }: Props = $props();

  // Modal setup
  const alertModalComponent: ModalComponent = { ref: AlertModal };
  const modalStore = getModalStore();
  const alertModal = (meta: AlertModalMeta): ModalSettings => ({
    type: 'component',
    component: alertModalComponent,
    meta
  });

  // Form state
  let form: HTMLFormElement | undefined = $state();
  let userPicture: Blob | null = $state(null);
  let files: FileList | undefined = $state();
  let fileMessage: string = $state('');
  let isChanged = $state(mode === 'create');
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  const welcomeAndNextStepsMessage = (name: string) => `
  <img src="/hAppeningsCIClogo.png" alt="hAppenings Community Logo" class="w-28" />
  <h2 class="text-center text-xl font-semibold">Welcome to hCRON!</h2>
  <p class="text-center text-lg">Hello ${name}, we're thrilled to have you join our community!</p>
  <div class="space-y-4">
    <div class="rounded-lg border-l-4 border-blue-500 p-4">
      <h3 class="text-tertiary-500 text-lg font-bold">Important Next Steps:</h3>
      <ul class="mt-2 list-disc space-y-2 pl-5 text-left">
        <li>A network administrator will contact you via email and platform message shortly.</li>
        <li>You'll be invited to schedule a meeting for identity verification.</li>
        <li>After successful verification, your status will update to "accepted".</li>
      </ul>
    </div>
    <p class="text-sm">
      Once accepted, you'll gain full access to participate in our vibrant community!
    </p>
  </div>`;

  // Initialize picture if editing
  $effect(() => {
    if (mode === 'edit' && user?.picture) {
      userPicture = new Blob([new Uint8Array(user.picture)]);
    }
  });

  // Sync Moss avatar to userPicture in create mode
  $effect(() => {
    if (mode === 'create' && weaveStore.mossAvatarBlob) {
      userPicture = weaveStore.mossAvatarBlob;
    }
  });

  async function onPictureFileChange() {
    fileMessage = `${files![0].name}`;
    userPicture = new Blob([new Uint8Array(await files![0].arrayBuffer())]);
    isChanged = true;
  }

  function removeUserPicture() {
    isChanged = true;
    userPicture = null;
    fileMessage = '';
    const pictureInput = form!.querySelector('input[name="picture"]') as HTMLInputElement;
    if (pictureInput) {
      pictureInput.value = '';
    }
  }

  async function mockUser() {
    isLoading = true;
    error = null;
    try {
      let userData: UserInDHT = (await createMockedUsers())[0];

      await onSubmit(userData);
      isLoading = false;

      modalStore.trigger(
        alertModal({
          id: 'welcome-and-next-steps',
          message: welcomeAndNextStepsMessage(userData.name),
          confirmLabel: 'Ok !'
        })
      );

      goto('/user');
    } catch (err) {
      isLoading = false;
      error = err instanceof Error ? err.message : 'Failed to create mocked user';
      console.error('Mocked user creation error:', err);
    }
  }

  async function submitForm(event: SubmitEvent) {
    event.preventDefault();
    isLoading = true;
    error = null;

    try {
      const data = new FormData(event.target as HTMLFormElement);
      const pictureBuffer = await (data.get('picture') as File).arrayBuffer();
      const picture = new Uint8Array(pictureBuffer);

      const userInput: UserInDHT = {
        name: data.get('name') as string,
        nickname: data.get('nickname') as string,
        bio: data.get('bio') as string,
        picture: picture.byteLength > 0 ? picture : mode === 'edit' ? user?.picture : undefined,
        user_type: data.get('user_type') as UserType,
        email: data.get('email') as string,
        phone: data.get('phone') as string,
        time_zone: data.get('timezone') as string,
        location: data.get('location') as string
      };

      await onSubmit(userInput);

      if (mode === 'create') {
        modalStore.trigger(
          alertModal({
            id: 'welcome-and-next-steps',
            message: welcomeAndNextStepsMessage(userInput.name),
            confirmLabel: 'Ok !'
          })
        );
      }

      goto('/user');

      // Reset form if creating
      if (mode === 'create') {
        form?.reset();
        userPicture = null;
        fileMessage = '';
        isChanged = false;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to submit user profile';
      console.error(`User ${mode} error:`, err);
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
        class="variant-soft btn btn-sm"
        onclick={() => {
          error = null;
        }}
      >
        Dismiss
      </button>
    </div>
  {/if}

  <p>*required fields</p>

  <label class="label text-lg">
    Name* :
    <input type="text" class="input" name="name" value={user?.name || ''} required />
  </label>

  <label class="label text-lg">
    Nickname* :
    <input
      type="text"
      class="input"
      name="nickname"
      value={weaveStore.mossNickname ?? user?.nickname ?? ''}
      readonly={weaveStore.hasMossNickname}
      required
    />
  </label>

  <label class="label text-lg">
    Bio :
    <textarea class="textarea h-52" name="bio">{user?.bio || ''}</textarea>
  </label>

  <div class="space-y-2">
    <label class="label space-y-2">
      <span>User Picture :</span>
      <FileDropzone
        name="picture"
        accept="image/*"
        bind:files
        onchange={onPictureFileChange}
        disabled={weaveStore.hasMossAvatar}
      />
      <div class="mt-2 flex items-center gap-2">
        {#if fileMessage}
          <span class="text-sm">{fileMessage}</span>
        {/if}
        <button
          type="button"
          class="variant-soft btn btn-sm"
          onclick={removeUserPicture}
          disabled={weaveStore.hasMossAvatar}
        >
          Remove
        </button>
      </div>
    </label>

    {#if userPicture}
      <div class="mt-4">
        <Avatar src={URL.createObjectURL(userPicture)} width="w-32" />
      </div>
    {/if}
  </div>

  <div class="flex gap-6">
    <p class="label text-lg">Type* :</p>

    <div class="flex gap-4">
      <label class="label flex items-center gap-2">
        <input
          type="radio"
          name="user_type"
          value="advocate"
          checked={user?.user_type === 'advocate' || !user}
          required
        />
        Advocate
      </label>
      <label class="label flex items-center gap-2">
        <input
          type="radio"
          name="user_type"
          value="creator"
          checked={user?.user_type === 'creator'}
          required
        />
        Creator
      </label>
    </div>
  </div>

  <label class="label text-lg">
    Email* :
    <input type="email" class="input" name="email" value={user?.email || ''} required />
  </label>

  <label class="label text-lg">
    Phone number :
    <input type="text" class="input" name="phone" value={user?.phone || ''} />
  </label>

  <TimeZoneSelect
    value={user?.time_zone || undefined}
    required={true}
    name="timezone"
    id="user-timezone"
  />

  <label class="label text-lg">
    Location :
    <input type="text" class="input" name="location" value={user?.location || ''} />
  </label>

  <div class="flex justify-center gap-4">
    <button
      type="submit"
      class="variant-filled-primary btn w-fit self-center"
      disabled={!isChanged || isLoading}
    >
      {#if isLoading}
        {mode === 'create' ? 'Creating' : 'Updating'} Profile...
      {:else}
        {mode === 'create' ? 'Create' : 'Update'} Profile
      {/if}
    </button>

    {#if mode === 'create' && shouldShowMockButtons()}
      <button
        type="button"
        class="variant-filled-tertiary btn w-fit self-center"
        onclick={mockUser}
      >
        Create Mocked User
      </button>
    {/if}
  </div>
</form>
