<script lang="ts">
  import MenuLink from '$lib/components/shared/MenuLink.svelte';
</script>

<div
  class="bg-surface-900 flex h-full w-52 flex-shrink-0 flex-col gap-5 border-2 border-b-0 border-slate-900 p-4 pt-9"
>
  <a
    href="/admin"
    class="h3 hover:border-b-secondary-500 hover:text-secondary-500 mb-4 border-b-2 border-b-white text-center text-white transition-colors duration-200 ease-in-out"
  >
    Admin Panel
  </a>

  <div class="flex flex-col gap-3">
    <MenuLink
      href="/admin/administrators"
      className="variant-filled-secondary sm:variant-filled-primary"
    >
      Administrators
    </MenuLink>
    <MenuLink href="/admin/users" className="variant-filled-secondary sm:variant-filled-primary">
      Users
    </MenuLink>
  </div>

  <div class="flex flex-col gap-3">
    <MenuLink
      href="/admin/organizations"
      className="variant-filled-secondary sm:variant-filled-primary"
    >
      Organizations
    </MenuLink>
    <MenuLink href="/admin/projects" className="variant-filled-secondary sm:variant-filled-primary">
      Projects
    </MenuLink>
  </div>

  <div class="flex flex-col gap-3">
    <MenuLink href="/admin/requests" className="variant-filled-secondary sm:variant-filled-primary">
      Requests
    </MenuLink>
    <MenuLink href="/admin/offers" className="variant-filled-secondary sm:variant-filled-primary">
      Offers
    </MenuLink>
    <MenuLink href="/admin/service-types" className="variant-filled-secondary sm:variant-filled-primary">
      Service Types
    </MenuLink>
  </div>

  <div class=" hidden flex-col gap-3 sm:flex">
    <MenuLink
      href="/"
      className="variant-ringed-secondary text-white hover:variant-filled-secondary"
    >
      User front-end
    </MenuLink>
  </div>
</div>
