<script lang="ts">
  import { pageTitle } from '$lib/utils/page-title';
  import usersStore from '$lib/stores/users.store.svelte';
  import { goto } from '$app/navigation';
  import type { UserInDHT } from '$lib/types/holochain';
  import UserForm from '$lib/components/users/UserForm.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { Effect as E, pipe } from 'effect';
  import { paths } from '$lib/paths';

  const { currentUser } = $derived(usersStore);

  async function createUser(input: UserInDHT, options?: { claimFirstAdministrator?: boolean }) {
    try {
      await runEffect(
        pipe(
          usersStore.createUser(input, options),
          E.flatMap(() => usersStore.refreshCurrentUser())
        )
      );
    } catch (err) {
      return Promise.reject(err);
    }
  }

  $effect(() => {
    if (currentUser) {
      goto(paths.myProfile());
    }
  });
</script>

<svelte:head>
  <title>{pageTitle('Create your profile')}</title>
</svelte:head>

<section class="flex w-4/5 flex-col gap-10 md:w-3/4 lg:w-1/2">
  <h2 class="h2">Create User Profile</h2>

  <UserForm mode="create" onSubmit={createUser} />
</section>
