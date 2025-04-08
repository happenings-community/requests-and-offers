<script lang="ts">
  import Bars from '@components/shared/svg/bars.svelte';
  import { getDrawerStore, type DrawerSettings } from '@skeletonlabs/skeleton';
  import MenuLink from '@components/shared/MenuLink.svelte';
  import usersStore from '@stores/users.store.svelte';

  const { currentUser } = $derived(usersStore);
  const drawerStore = getDrawerStore();
  const drawerSettings: DrawerSettings = {
    id: 'menu-drawer',
    width: 'w-1/2 sm:w-1/3',
    bgDrawer: 'bg-primary-500'
  };

  function openDrawer() {
    drawerStore.open(drawerSettings);
  }
</script>

<nav class="bg-primary-500 flex h-32 w-full items-center justify-between p-4">
  <div class="flex w-full items-center justify-between">
    <a href="/" class="">
      <img src="/hAppeningsLogoWsun2.webp" alt="hAppenings Community Logo" class="w-28" />
    </a>

    <a class="h1 text-white" href="/">hCRON</a>

    <div class="flex justify-end gap-4">
      <button class="btn variant-filled-secondary lg:hidden" onclick={openDrawer}>
        <Bars svgClass="fill-white h-6 w-6" />
      </button>
    </div>
  </div>

  <div class="hidden flex-col justify-end gap-4 sm:flex-row lg:flex">
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
  </div>
</nav>
