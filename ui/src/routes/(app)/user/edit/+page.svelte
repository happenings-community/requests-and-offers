<script lang="ts">
  import moment from 'moment-timezone';
  import { Avatar, FileDropzone, InputChip, getModalStore } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import NavButton from '@lib/NavButton.svelte';
  import usersStore from '@stores/users.store.svelte';
  import type { UserInDHT, UserType } from '@types/holochain';
  import AlertModal from '@lib/dialogs/AlertModal.svelte';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';

  type FormattedTimezone = {
    name: string;
    formatted: string;
    offset: number;
  };

  const { currentUser } = $derived(usersStore);
  const modalStore = getModalStore();

  const alertModalComponent: ModalComponent = { ref: AlertModal };
  const alertModal = (meta: any): ModalSettings => ({
    type: 'component',
    component: alertModalComponent,
    meta
  });

  let form: HTMLFormElement | undefined = $state();
  let timezones = moment.tz.names();
  let filteredTimezones: string[] = $state([]);
  let formattedTimezones: FormattedTimezone[] = $state([]);
  let userPicture: Blob | null = $state(null);
  let files: FileList | undefined = $state();
  let fileMessage: string = $state('');
  let search = $state('');
  let isChanged = $state(false);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  function formatTimezones(timezones: string[]): FormattedTimezone[] {
    return timezones.map((timezone) => {
      const offset = moment.tz(timezone).utcOffset();
      const hours = Math.floor(Math.abs(offset) / 60);
      const minutes = Math.abs(offset) % 60;
      const sign = offset >= 0 ? '+' : '-';

      const formatted = `GMT${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${timezone}`;

      return { name: timezone, formatted, offset };
    });
  }

  $effect(() => {
    search
      ? (formattedTimezones = formatTimezones(filteredTimezones))
      : (formattedTimezones = formatTimezones(timezones));
  });

  $effect(() => {
    formattedTimezones.sort((a, b) => a.offset - b.offset);
  });

  function filterTimezones(event: any) {
    search = event.target.value.trim();
    filteredTimezones = timezones.filter((tz) => tz.toLowerCase().includes(search.toLowerCase()));
  }

  async function onPictureFileChange() {
    fileMessage = `${files![0].name}`;
    userPicture = new Blob([new Uint8Array(await files![0].arrayBuffer())]);
    isChanged = true;
  }

  function RemoveUserPicture() {
    isChanged = true;
    userPicture = null;
    fileMessage = '';
    const pictureInput = form!.querySelector('input[name="picture"]') as HTMLInputElement;
    if (pictureInput) {
      pictureInput.value = '';
    }

    usersStore.currentUser!.picture = undefined;
  }

  $effect(() => {
    if (currentUser?.picture) userPicture = new Blob([currentUser?.picture]);
  });

  async function updateUser(user: UserInDHT) {
    try {
      isLoading = true;
      error = null;

      await usersStore.updateCurrentUser(user);

      modalStore.trigger(
        alertModal({
          id: 'profile-updated',
          message: 'Your profile has been successfully updated!',
          confirmLabel: 'Ok'
        })
      );

      goto('/user');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update user profile';
      console.error('User update error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function submitForm(event: SubmitEvent) {
    event.preventDefault();

    const data = new FormData(form);
    const pictureBuffer = await (data.get('picture') as File).arrayBuffer();
    const picture = new Uint8Array(pictureBuffer);

    const user: UserInDHT = {
      name: data.get('name') as string,
      nickname: data.get('nickname') as string,
      bio: data.get('bio') as string,
      picture: picture.byteLength > 0 ? picture : currentUser?.picture,
      user_type: data.get('user_type') as UserType,
      skills: data.getAll('skills') as string[],
      email: data.get('email') as string,
      phone: data.get('phone') as string,
      time_zone: data.get('timezone') as string,
      location: data.get('location') as string
    };

    await updateUser(user);
  }
</script>

<section class="flex w-1/2 flex-col gap-10">
  {#if !currentUser}
    <p class="mb-4 text-center text-xl">It looks like you don't have a profile yet !</p>
    <NavButton href="/user/create">Create Profile</NavButton>
  {:else}
    <h2 class="h2">Edit User</h2>

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

    <form
      class="flex flex-col gap-4"
      enctype="multipart/form-data"
      bind:this={form}
      onsubmit={submitForm}
      oninput={() => (isChanged = true)}
    >
      <p>*required fields</p>
      <label class="label text-lg">
        Name* :<input type="text" class="input" name="name" value={currentUser.name} required />
      </label>

      <label class="label text-lg">
        Nickname* :
        <input type="text" class="input" name="nickname" value={currentUser.nickname} required />
      </label>

      <label class="label text-lg">
        Bio :
        <textarea class="textarea h-52" name="bio">{currentUser.bio}</textarea>
      </label>

      <div class="space-y-2">
        <label class="label space-y-2">
          <span>User Picture :</span>
          <FileDropzone name="picture" accept="image/*" bind:files onchange={onPictureFileChange} />
          <div class="mt-2 flex items-center gap-2">
            {#if fileMessage}
              <span class="text-sm">{fileMessage}</span>
            {/if}
            <button type="button" class="btn btn-sm variant-soft" onclick={RemoveUserPicture}>
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
              checked={currentUser.user_type === 'advocate'}
              required
            />
            Advocate
          </label>
          <label class="label flex items-center gap-2">
            <input
              type="radio"
              name="user_type"
              value="creator"
              checked={currentUser.user_type === 'creator'}
              required
            />
            Creator
          </label>
        </div>
      </div>

      <div class="flex gap-2">
        <p class="label w-16 text-lg">Skills :</p>
        <InputChip
          id="skills"
          value={currentUser.skills}
          name="skills"
          placeholder="Write a skill and press enter"
          chips="variant-filled-secondary"
        />
      </div>

      <label class="label text-lg">
        Email* :
        <input type="email" class="input" name="email" value={currentUser.email} required />
      </label>

      <label class="label text-lg">
        Phone number :
        <input type="text" class="input" name="phone" value={currentUser.phone} />
      </label>

      <label class="label text-lg">
        Time Zone :
        <input
          type="text"
          placeholder="Search timezones..."
          class="input w-1/2"
          oninput={filterTimezones}
        />
        <select name="timezone" id="timezone" class="select">
          {#each formattedTimezones as tz}
            <option class="" value={tz.name} selected={tz.name === currentUser.time_zone}>
              {tz.formatted}
            </option>
          {/each}
        </select>
      </label>

      <label class="label text-lg">
        Location :
        <input type="text" class="input" name="location" value={currentUser.location} />
      </label>

      <button
        type="submit"
        class="btn variant-filled-primary w-fit self-center"
        disabled={!isChanged || isLoading}
      >
        {#if isLoading}
          Updating Profile...
        {:else}
          Update Profile
        {/if}
      </button>
    </form>
  {/if}
</section>
