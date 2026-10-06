<script lang="ts">
  import MenuLink from '$lib/components/shared/MenuLink.svelte';
  import NavGroup from '$lib/components/shared/NavGroup.svelte';
  import { paths } from '$lib/paths';
</script>

<div
  class="flex h-full w-60 flex-shrink-0 flex-col gap-2 border-r-2 border-surface-700 bg-surface-900 p-4 pt-9"
>
  <a
    href={paths.admin()}
    class="h3 mb-4 border-b-2 border-b-white pb-2 text-center text-white transition-colors duration-200 ease-in-out hover:border-b-secondary-500 hover:text-secondary-500"
  >
    Admin Panel
  </a>

  <div class="flex flex-col gap-4">
    <NavGroup title="Content">
      <MenuLink href={paths.adminRequests()}>Requests</MenuLink>
      <MenuLink href={paths.adminOffers()}>Offers</MenuLink>
      <MenuLink href={paths.adminServiceTypes()}>Service Types</MenuLink>
      <MenuLink href={paths.adminMediumsOfExchange()}>Mediums of Exchange</MenuLink>
    </NavGroup>

    <NavGroup title="Users & Groups">
      <MenuLink href={paths.adminUsers()}>Users</MenuLink>
      <MenuLink href={paths.adminOrganizations()}>Organizations</MenuLink>
    </NavGroup>

    <NavGroup title="Administration">
      <MenuLink href={paths.adminAdministrators()}>Administrators</MenuLink>
    </NavGroup>

    <hr class="!border-surface-600" />

    <NavGroup title="Developer">
      <MenuLink href={paths.adminHreaTest()}>hREA Test</MenuLink>
      <MenuLink href={paths.adminUsersStatusHistory()}>Users Status History</MenuLink>
    </NavGroup>
  </div>

  <div class="mt-auto flex flex-col gap-3">
    <MenuLink
      href="/"
      className="variant-ringed-secondary text-center text-white hover:variant-filled-secondary"
    >
      Exit Admin
    </MenuLink>
  </div>
</div>
