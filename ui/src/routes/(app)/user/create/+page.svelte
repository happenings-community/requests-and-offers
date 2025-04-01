<script lang="ts">
  import moment from 'moment-timezone';
  import { FileDropzone, InputChip, Avatar, getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import usersStore from '@stores/users.store.svelte';
  import { goto } from '$app/navigation';
  import { createMockedUsers } from '@mocks';
  import { onMount } from 'svelte';
  import AlertModal from '@lib/dialogs/AlertModal.svelte';
  import type { AlertModalMeta } from '@lib/types';
  import type { UserInDHT, UserType } from '@/types/holochain';

  type FormattedTimezone = {
    name: string;
    formatted: string;
    offset: number;
  };

  const alertModalComponent: ModalComponent = { ref: AlertModal };
  const alertModal = (meta: AlertModalMeta): ModalSettings => ({
    type: 'component',
    component: alertModalComponent,
    meta
  });

  const { currentUser } = $derived(usersStore);
  const modalStore = getModalStore();

  let isLoading = $state(false);
  let error = $state<string | null>(null);

  let form: HTMLFormElement;
  let timezones = moment.tz.names();
  let userPicture: Blob | null = $state(null);
  let files: FileList | undefined = $state();
  let fileMessage: string = $state('');
  let filteredTimezones: string[] = $state([]);
  let formattedTimezones: FormattedTimezone[] = $state([]);
  let search = $state('');

  const welcomeAndNextStepsMessage = (name: string) => `
  <img src="/hAppeningsLogoWsun2.webp" alt="hAppenings Community Logo" class="w-28" />
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
  }

  function RemoveUserPicture() {
    userPicture = null;
    fileMessage = '';
    const pictureInput = form.querySelector('input[name="picture"]') as HTMLInputElement;
    if (pictureInput) {
      pictureInput.value = '';
    }
  }

  async function createUser(user: UserInDHT) {
    try {
      await usersStore.createUser(user);
      await usersStore.refreshCurrentUser();

      modalStore.trigger(
        alertModal({
          id: 'welcome-and-next-steps',
          message: welcomeAndNextStepsMessage(user.name),
          confirmLabel: 'Ok !'
        })
      );

      goto('/user');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create user profile';
      console.error('User creation error:', err);
    }
  }

  async function mockUser() {
    isLoading = true;
    error = null;
    try {
      let user: UserInDHT = (await createMockedUsers())[0];
      await createUser(user);
    } catch (err) {
      error = 'Failed to create mocked user';
      console.error('Mocked user creation error:', err);
    } finally {
      isLoading = false;
    }
  }

  async function submitForm(event: SubmitEvent) {
    event.preventDefault();
    isLoading = true;
    error = null;

    const data = new FormData(event.target as HTMLFormElement);
    const pictureBuffer = await (data.get('picture') as File).arrayBuffer();
    const picture = new Uint8Array(pictureBuffer);

    const user: UserInDHT = {
      name: data.get('name') as string,
      nickname: data.get('nickname') as string,
      bio: data.get('bio') as string,
      picture: picture.byteLength > 0 ? picture : undefined,
      user_type: data.get('user_type') as UserType,
      skills: data.getAll('skills') as string[],
      email: data.get('email') as string,
      phone: data.get('phone') as string,
      time_zone: data.get('timezone') as string,
      location: data.get('location') as string
    };

    try {
      await createUser(user);
    } catch (err) {
      error = 'Failed to submit user profile';
      console.error('User submission error:', err);
    } finally {
      isLoading = false;
    }
  }

  onMount(async () => {
    if (currentUser) {
      goto('/user');
    }
  });
</script>

<section class="flex w-4/5 flex-col gap-10 md:w-3/4 lg:w-1/2">
  <h2 class="h2">Create User Profile</h2>

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
      Nickname* :
      <input type="text" class="input" name="nickname" required />
    </label>

    <label class="label text-lg">
      Bio :
      <textarea class="textarea" name="bio"></textarea>
    </label>

    <p class="label text-lg">User picture :</p>
    <FileDropzone name="picture" bind:files onchange={onPictureFileChange} accept="image/*" />
    <div class="flex items-center justify-between">
      <p class="italic">{fileMessage}</p>
      {#if files && userPicture}
        <div>
          <Avatar src={URL.createObjectURL(userPicture)} />
          <button class="cursor-pointer underline" onclick={RemoveUserPicture}> Remove </button>
        </div>
      {/if}
    </div>

    <div class="flex flex-col gap-2 lg:flex-row lg:gap-6">
      <p class="label text-lg">Type* :</p>

      <div class="flex gap-4">
        <label class="label flex items-center gap-2">
          <input type="radio" name="user_type" value="advocate" checked required />
          Advocate
        </label>
        <label class="label flex items-center gap-2">
          <input type="radio" name="user_type" value="creator" required />
          Creator
        </label>
      </div>
    </div>

    <div class="flex flex-col gap-2 lg:flex-row lg:gap-6">
      <p class="label w-16 text-lg">Skills :</p>
      <InputChip
        id="skills"
        name="skills"
        placeholder="Write a skill and press enter"
        chips="variant-filled-secondary"
      />
    </div>

    <label class="label text-lg">
      Email* :
      <input type="email" class="input" name="email" required />
    </label>

    <label class="label text-lg">
      Phone number :
      <input type="text" class="input" name="phone" />
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
          <option class="" value={tz.name}>{tz.formatted}</option>
        {/each}
      </select>
    </label>

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
          Creating Profile...
        {:else}
          Create Profile
        {/if}
      </button>

      <button
        type="button"
        class="btn variant-filled-tertiary w-fit self-center"
        onclick={mockUser}
        disabled={isLoading}
      >
        {#if isLoading}
          Creating...
        {:else}
          Create Mocked User
        {/if}
      </button>
    </div>
  </form>
</section>
