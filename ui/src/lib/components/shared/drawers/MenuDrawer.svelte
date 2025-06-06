<script>
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import MenuLink from '$lib/components/shared/MenuLink.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';

  const drawerStore = getDrawerStore();
  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator } = $derived(administrationStore);
</script>

<div class="h-10 space-y-5 p-2 md:p-5">
  <div class="flex justify-center">
    <a href="/" onclick={() => drawerStore.close()}>
      <img src="/hAppeningsCIClogo.png" alt="" class="w-28" />
    </a>
  </div>

  <div class="flex flex-col gap-3">
    {#if currentUser}
      <MenuLink href="/user">My profile</MenuLink>
    {:else}
      <MenuLink href="/user/create">Create Profile</MenuLink>
    {/if}
    <MenuLink href="/users">All Users</MenuLink>
  </div>
  <div class="flex flex-col gap-3">
    <MenuLink href="/organizations">Organizations</MenuLink>
    <MenuLink href="/projects">Projects</MenuLink>
  </div>
  <div class="flex flex-col gap-3">
    <MenuLink href="/requests">Requests</MenuLink>
    <MenuLink href="/offers">Offers</MenuLink>
  </div>
  {#if agentIsAdministrator}
    <div class="flex flex-col gap-3 lg:hidden">
      <MenuLink
        href="/admin"
        className="variant-ringed-secondary text-white hover:variant-filled-secondary"
      >
        Admin panel
      </MenuLink>
    </div>
  {/if}
</div>
