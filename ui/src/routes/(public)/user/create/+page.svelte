<script lang="ts">
  import usersStore from '$lib/stores/users.store.svelte';
  import { goto } from '$app/navigation';
  import type { UserInDHT } from '$lib/types/holochain';
  import UserForm from '$lib/components/users/UserForm.svelte';
  import { runEffect } from '$lib/utils/effect';

  const { currentUser } = $derived(usersStore);

  async function createUser(input: UserInDHT) {
    try {
      await runEffect(usersStore.createUser(input));
      await runEffect(usersStore.refreshCurrentUser());
    } catch (err) {
      return Promise.reject(err);
    }
  }

  $effect(() => {
    if (currentUser) {
      goto('/user');
    }
  });
</script>

<section class="flex w-4/5 flex-col gap-10 md:w-3/4 lg:w-1/2">
  <h2 class="h2">Create User Profile</h2>

  <UserForm mode="create" onSubmit={createUser} />
</section>
