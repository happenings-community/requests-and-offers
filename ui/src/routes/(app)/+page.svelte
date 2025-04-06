<script lang="ts">
  import usersStore from '@stores/users.store.svelte';
  import NavButton from '@lib/components/shared/NavButton.svelte';
  import administrationStore from '@stores/administration.store.svelte';

  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator } = $derived(administrationStore);

  let error: string | null = $state(null);
</script>

<section class="flex flex-col items-center">
  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
      <button class="btn btn-sm variant-soft" onclick={() => (error = null)}>Dismiss</button>
    </div>
  {/if}

  {#if agentIsAdministrator}
    <div class="absolute left-10 top-40 flex flex-col items-center gap-2">
      <a class="btn bg-red-600 text-white hover:text-black" href="/admin"> Admin Zone </a>
      <span>
        <kbd class="kbd bg-red-300">Alt</kbd> + <kbd class="kbd bg-red-300">A</kbd>
      </span>
    </div>
  {/if}

  {#if currentUser && !agentIsAdministrator}
    <div class="absolute left-10 top-40 flex flex-col items-center gap-2">
      <p>
        Register as administrator:
        <kbd class="kbd">Ctrl</kbd> + <kbd class="kbd">Shift</kbd> + <kbd class="kbd">A</kbd>
      </p>
    </div>
  {/if}

  {#if !currentUser}
    <div class="flex flex-col items-center gap-4">
      <p class="text-center text-xl">It looks like you don't have a user profile yet!</p>
      <NavButton href="user/create">Create Profile</NavButton>
    </div>
  {:else}
    <div class="flex flex-col items-center gap-4">
      <h2 class="h2 mb-4">Welcome {currentUser.name}!</h2>
      <a href="user" class="btn variant-filled-primary text-white">View Profile</a>
    </div>
  {/if}
</section>
