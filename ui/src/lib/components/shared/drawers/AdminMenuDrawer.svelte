<script>
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import MenuLink from '../MenuLink.svelte';

  const drawerStore = getDrawerStore();
</script>

<div class="h-10 space-y-5 p-2 md:p-5">
  <div class="flex items-center justify-center gap-4">
    <a href="/" onclick={() => drawerStore.close()}>
      <img src="/hAppeningsLogoWsun2.webp" alt="" class="w-28" />
    </a>
    <a
      href="/admin"
      class="h3 hover:text-secondary-500 hover:border-b-secondary-500 text-center text-white transition-colors duration-200 ease-in-out"
      onclick={() => drawerStore.close()}
    >
      Admin Panel
    </a>
  </div>

  <div class="flex flex-col gap-3">
    <MenuLink href="/admin/administrators" className="variant-filled-secondary">
      Administrators
    </MenuLink>
    <MenuLink href="/admin/users" className="variant-filled-secondary">Users</MenuLink>
  </div>

  <div class="flex flex-col gap-3">
    <MenuLink href="/admin/organizations" className="variant-filled-secondary">
      Organizations
    </MenuLink>
    <MenuLink href="/admin/projects" className="variant-filled-secondary">Projects</MenuLink>
  </div>

  <div class="flex flex-col gap-3">
    <MenuLink href="/admin/requests" className="variant-filled-secondary">Requests</MenuLink>
    <MenuLink href="/admin/offers" className="variant-filled-secondary">Offers</MenuLink>
  </div>

  <div class=" flex flex-col gap-3">
    <MenuLink
      href="/"
      className="variant-ringed-secondary text-white hover:variant-filled-secondary"
    >
      User front-end
    </MenuLink>
  </div>
</div>
