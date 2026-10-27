<script>
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { getUserPictureUrl } from '$lib/utils';
  import { myActivityItems, myProfileItems } from '$lib/navigation/my-menu';

  const drawerStore = getDrawerStore();
  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator } = $derived(administrationStore);

  function closeDrawer() {
    drawerStore.close();
  }
</script>

<div class="flex h-full flex-col bg-primary-500 text-white">
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-primary-400 p-4">
    <a href="/" onclick={closeDrawer} class="flex items-center gap-3">
      <img src="/hAppeningsCIClogo.png" alt="hAppenings Community Logo" class="h-10 w-10" />
      <span class="text-lg font-bold">Requests & Offers</span>
    </a>
    <button
      onclick={closeDrawer}
      aria-label="Close Drawer"
      class="p-2 text-white hover:text-secondary-300"
    >
      <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        ></path>
      </svg>
    </button>
  </div>

  <!-- Navigation Content -->
  <div class="flex-1 space-y-6 overflow-y-auto p-4">
    <!-- The member's own section first, as in the nav bar's top right -->
    <div class="space-y-3">
      {#if currentUser}
        <div class="flex items-center gap-3">
          <img
            src={getUserPictureUrl(currentUser)}
            alt=""
            class="h-10 w-10 rounded-full bg-surface-200 object-cover"
          />
          <span class="truncate font-semibold">{currentUser.name}</span>
        </div>
      {:else}
        <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">Profile</h3>
      {/if}
      <div class="space-y-2">
        {#each myProfileItems(!!currentUser) as item (item.href)}
          <a
            href={item.href}
            onclick={closeDrawer}
            class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
          >
            <span class="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        {/each}
      </div>
    </div>

    <!-- Primary Actions -->
    <div class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">Main Actions</h3>
      <a
        href="/requests"
        onclick={closeDrawer}
        class="flex items-center gap-3 rounded-lg bg-secondary-600 p-3 transition-colors hover:bg-secondary-700"
      >
        <span class="text-xl">📝</span>
        <span class="font-medium">Requests</span>
      </a>
      <a
        href="/offers"
        onclick={closeDrawer}
        class="flex items-center gap-3 rounded-lg bg-warning-600 p-3 transition-colors hover:bg-warning-700"
      >
        <span class="text-xl">💡</span>
        <span class="font-medium">Offers</span>
      </a>
    </div>

    <!-- My Activity, as in the nav bar -->
    {#if currentUser}
      <div class="space-y-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">
          My Activity
        </h3>
        <div class="space-y-2">
          {#each myActivityItems() as item (item.href)}
            <a
              href={item.href}
              onclick={closeDrawer}
              class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
            >
              <span class="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Community -->
    <div class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">Community</h3>
      <div class="space-y-2">
        <a
          href="/users"
          onclick={closeDrawer}
          class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
        >
          <span class="text-lg">👥</span>
          <span>All Users</span>
        </a>
        <a
          href="/organizations"
          onclick={closeDrawer}
          class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
        >
          <span class="text-lg">🏢</span>
          <span>Organizations</span>
        </a>
      </div>
    </div>

    <!-- Resources -->
    <div class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">Resources</h3>
      <div class="space-y-2">
        <a
          href="/service-types"
          onclick={closeDrawer}
          class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
        >
          <span class="text-lg">🏷️</span>
          <span>Service Types</span>
        </a>
      </div>
    </div>

    <!-- Admin Section -->
    {#if agentIsAdministrator}
      <div class="space-y-3 border-t border-primary-400 pt-4">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">
          Administration
        </h3>
        <a
          href="/admin"
          onclick={closeDrawer}
          class="flex items-center gap-3 rounded-lg border border-secondary-400 p-3 transition-colors hover:bg-secondary-600"
        >
          <span class="text-lg">⚙️</span>
          <span>Admin Panel</span>
        </a>
      </div>
    {/if}
  </div>
</div>
