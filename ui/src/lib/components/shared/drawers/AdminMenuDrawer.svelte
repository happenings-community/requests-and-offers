<script>
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import MenuLink from '$lib/components/shared/MenuLink.svelte';

  const drawerStore = getDrawerStore();
</script>

<div class="h-10 space-y-5 p-2 md:p-5">
  <div class="flex items-center justify-center gap-4">
    <a href="/" onclick={() => drawerStore.close()}>
      <img src="/hAppeningsCIClogo.png" alt="" class="w-28" />
    </a>
    <a
      href="/admin"
      class="h3 text-center text-white transition-colors duration-200 ease-in-out hover:border-b-secondary-500 hover:text-secondary-500"
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
  </div>

  <div class="flex flex-col gap-3">
    <MenuLink href="/admin/service-types" className="variant-filled-secondary">
      Service Types
    </MenuLink>
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
