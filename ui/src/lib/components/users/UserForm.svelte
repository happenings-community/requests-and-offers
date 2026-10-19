<script lang="ts">
  import { browser } from '$app/environment';
  import { encodeHashToBase64 } from '@holochain/client';
  import { Avatar, FileDropzone, getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import type { UserInDHT, UserType } from '$lib/types/holochain';
  import type { UIUser } from '$lib/types/ui';
  import { formInputToDHT, dhtToFormInput, formatUserName, type UserFormInput } from '$lib/schemas/users.schemas';
  import TimeZoneSelect from '$lib/components/shared/TimeZoneSelect.svelte';
  import AlertModal from '$lib/components/shared/dialogs/AlertModal.svelte';
  import type { AlertModalMeta } from '$lib/types/ui';
  import { createMockedUsers } from '$lib/utils/mocks';
  import { shouldShowMockButtons } from '$lib/services/devFeatures.service';
  import { goto } from '$app/navigation';
  import { recheckAdminStatusNow } from '$lib/services/adminStatus.service.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { ADMIN_SHORTCUT_HINT } from '$lib/utils/admin-shortcut';
  import { needsSelfAcceptance } from '$lib/utils/progenitor-hint';
  import weaveStore from '$lib/stores/weave.store.svelte';
  import MarkdownField from '$lib/components/shared/MarkdownField.svelte';

  type Props = {
    mode: 'create' | 'edit';
    user?: UIUser;
    onSubmit: (input: UserInDHT) => Promise<void>;
  };

  const { mode = 'create', user, onSubmit }: Props = $props();

  // Issue #139: split given/family name handling
  const initialFormInput = user
    ? dhtToFormInput(user)
    : { given_name: '', family_name: '' };
  const initialGiven = initialFormInput.given_name;
  const initialFamily = initialFormInput.family_name;
  // Migration banner for users created before #139 (name field split into given/family).
  // TODO: Remove this banner and its localStorage flag once all alpha testers have
  // confirmed their split (estimated next release after #151 lands).
  const migrationAckKey =
    user?.original_action_hash && browser
      ? `name-split-acknowledged-${encodeHashToBase64(user.original_action_hash)}`
      : null;
  const wasAcknowledged =
    migrationAckKey ? localStorage.getItem(migrationAckKey) === 'true' : false;
  const showMigrationBanner =
    mode === 'edit' && !!user?.name && user.name.trim().length > 0 && !wasAcknowledged;
  let migrationConfirmed = $state(false);

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
  let bio = $state(user?.bio || '');

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

  // The progenitor is the network's first administrator, so the standard next steps, which
  // say an administrator will be in touch, are wrong for them.
  const progenitorWelcomeMessage = `
  <img src="/hAppeningsCIClogo.png" alt="hAppenings Community Logo" class="w-28" />
  <h2 class="text-center text-xl font-semibold">You're the first administrator</h2>
  <div class="space-y-4">
    <div class="rounded-lg border-l-4 border-blue-500 p-4">
      <h3 class="text-tertiary-500 text-lg font-bold">One step left</h3>
      <p class="mt-2 text-left">
        Accept your own membership. Until you do, your status is pending and the app treats you
        as a new member.
      </p>
    </div>
    <p class="text-sm">Tip: ${ADMIN_SHORTCUT_HINT}.</p>
  </div>`;

  function welcomeModal(name: string): ModalSettings {
    const status = usersStore.currentUser?.status?.status_type;
    if (needsSelfAcceptance(administrationStore.agentIsAdministrator, status)) {
      return alertModal({
        id: 'progenitor-welcome',
        message: progenitorWelcomeMessage,
        confirmLabel: 'Open the members page',
        confirmHref: '/admin/users'
      });
    }
    return alertModal({
      id: 'welcome-and-next-steps',
      message: welcomeAndNextStepsMessage(name),
      confirmLabel: 'Ok !'
    });
  }

  // Creating a profile can make this agent an administrator, and the store keeps the new
  // profile without its status. The Admin button and the first-run hint need both, so read
  // them again now rather than waiting for the next background check. Failures are logged:
  // the background checks still catch up.
  async function refreshAfterCreate() {
    await recheckAdminStatusNow();
    try {
      await runEffect(usersStore.refreshCurrentUser());
    } catch (err) {
      console.warn('Re-reading the new profile failed:', err);
    }
  }

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
      await refreshAfterCreate();
      isLoading = false;

      modalStore.trigger(welcomeModal(formatUserName(userData.name)));

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

      const formInput: UserFormInput = {
        given_name: data.get('given_name') as string,
        family_name: data.get('family_name') as string,
        nickname: data.get('nickname') as string,
        bio: data.get('bio') as string,
        picture: picture.byteLength > 0 ? picture : mode === 'edit' ? user?.picture : undefined,
        user_type: data.get('user_type') as UserType,
        email: data.get('email') as string,
        phone: data.get('phone') as string,
        time_zone: data.get('timezone') as string,
        location: data.get('location') as string
      };
      const userInput: UserInDHT = formInputToDHT(formInput);

      await onSubmit(userInput);
      if (mode === 'create') await refreshAfterCreate();

      // Persist migration banner acknowledgment so it doesn't return on subsequent edits.
      if (mode === 'edit' && migrationConfirmed && migrationAckKey) {
        localStorage.setItem(migrationAckKey, 'true');
      }

      if (mode === 'create') {
        modalStore.trigger(welcomeModal(formatUserName(userInput.name)));
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

  {#if showMigrationBanner}
    <aside class="alert variant-soft-warning">
      <p>
        We've split the name field in two. Please check the values below and adjust if
        needed.
      </p>
      <label class="flex items-center gap-2">
        <input type="checkbox" class="checkbox" bind:checked={migrationConfirmed} />
        <span>Confirmed: my name's split correctly!</span>
      </label>
    </aside>
  {/if}

  <div class="flex flex-col gap-4 sm:flex-row">
    <label class="label flex-1 text-lg">
      Given name* :
      <input
        type="text"
        class="input"
        name="given_name"
        value={initialGiven}
        required
        minlength="1"
        maxlength="100"
        pattern="\S.*"
        title="Must contain at least one non-whitespace character"
      />
    </label>

    <label class="label flex-1 text-lg">
      Family name* :
      <input
        type="text"
        class="input"
        name="family_name"
        value={initialFamily}
        required
        minlength="1"
        maxlength="100"
        pattern="\S.*"
        title="Must contain at least one non-whitespace character"
      />
    </label>
  </div>

  <p class="text-sm opacity-75">
    Names come in many shapes. Enter yours across the two fields. If you go by a single
    name, put a dot [ . ] in the family field; we'll hide it when displaying your name.
  </p>

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

  <MarkdownField
    bind:value={bio}
    name="bio"
    label="Bio"
    labelClass="text-lg"
    height="h-52"
    placeholder="Tell us about yourself... (Markdown supported)"
  />

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

  <p class="text-sm text-surface-600 dark:text-surface-400">
    Your email and phone number are stored on the shared network and visible to all its members.
  </p>

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
