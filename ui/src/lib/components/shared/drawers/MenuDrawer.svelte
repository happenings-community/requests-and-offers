<script>
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';

  const drawerStore = getDrawerStore();
  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator } = $derived(administrationStore);

  function closeDrawer() {
    drawerStore.close();
  }
</script>

<div class="bg-primary-500 flex h-full flex-col text-white">
  <!-- Header -->
  <div class="border-primary-400 flex items-center justify-between border-b p-4">
    <a href="/" onclick={closeDrawer} class="flex items-center gap-3">
      <img src="/hAppeningsCIClogo.png" alt="hAppenings Community Logo" class="h-10 w-10" />
      <span class="text-lg font-bold">Requests & Offers</span>
    </a>
    <button
      onclick={closeDrawer}
      aria-label="Close Drawer"
      class="hover:text-secondary-300 p-2 text-white"
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
    <!-- Primary Actions -->
    <div class="space-y-3">
      <h3 class="text-secondary-300 text-sm font-semibold uppercase tracking-wide">Main Actions</h3>
      <a
        href="/requests"
        onclick={closeDrawer}
        class="bg-secondary-600 hover:bg-secondary-700 flex items-center gap-3 rounded-lg p-3 transition-colors"
      >
        <span class="text-xl">📝</span>
        <span class="font-medium">Requests</span>
      </a>
      <a
        href="/offers"
        onclick={closeDrawer}
        class="bg-warning-600 hover:bg-warning-700 flex items-center gap-3 rounded-lg p-3 transition-colors"
      >
        <span class="text-xl">💡</span>
        <span class="font-medium">Offers</span>
      </a>
    </div>

    <!-- My Activity -->
    <div class="space-y-3">
      <h3 class="text-secondary-300 text-sm font-semibold uppercase tracking-wide">My Activity</h3>
      <div class="space-y-2">
        {#if currentUser}
          <a
            href="/user"
            onclick={closeDrawer}
            class="hover:bg-primary-400 flex items-center gap-3 rounded-lg p-3 transition-colors"
          >
            <span class="text-lg">👤</span>
            <span>My Profile</span>
          </a>
        {:else}
          <a
            href="/user/create"
            onclick={closeDrawer}
            class="hover:bg-primary-400 flex items-center gap-3 rounded-lg p-3 transition-colors"
          >
            <span class="text-lg">👤</span>
            <span>Create Profile</span>
          </a>
        {/if}
        <a
          href="/requests?filter=my"
          onclick={closeDrawer}
          class="hover:bg-primary-400 flex items-center gap-3 rounded-lg p-3 transition-colors"
        >
          <span class="text-lg">📋</span>
          <span>My Requests</span>
        </a>
        <a
          href="/offers?filter=my"
          onclick={closeDrawer}
          class="hover:bg-primary-400 flex items-center gap-3 rounded-lg p-3 transition-colors"
        >
          <span class="text-lg">🎯</span>
          <span>My Offers</span>
        </a>
      </div>
    </div>

    <!-- Community -->
    <div class="space-y-3">
      <h3 class="text-secondary-300 text-sm font-semibold uppercase tracking-wide">Community</h3>
      <div class="space-y-2">
        <a
          href="/users"
          onclick={closeDrawer}
          class="hover:bg-primary-400 flex items-center gap-3 rounded-lg p-3 transition-colors"
        >
          <span class="text-lg">👥</span>
          <span>All Users</span>
        </a>
        <a
          href="/organizations"
          onclick={closeDrawer}
          class="hover:bg-primary-400 flex items-center gap-3 rounded-lg p-3 transition-colors"
        >
          <span class="text-lg">🏢</span>
          <span>Organizations</span>
        </a>
        <a
          href="/projects"
          onclick={closeDrawer}
          class="hover:bg-primary-400 flex items-center gap-3 rounded-lg p-3 transition-colors"
        >
          <span class="text-lg">🚀</span>
          <span>Projects</span>
        </a>
      </div>
    </div>

    <!-- Resources -->
    <div class="space-y-3">
      <h3 class="text-secondary-300 text-sm font-semibold uppercase tracking-wide">Resources</h3>
      <div class="space-y-2">
        <a
          href="/service-types"
          onclick={closeDrawer}
          class="hover:bg-primary-400 flex items-center gap-3 rounded-lg p-3 transition-colors"
        >
          <span class="text-lg">🏷️</span>
          <span>Service Types</span>
        </a>
        <a
          href="/mediums-of-exchange"
          onclick={closeDrawer}
          class="hover:bg-primary-400 flex items-center gap-3 rounded-lg p-3 transition-colors"
        >
          <span class="text-lg">💱</span>
          <span>Payment Methods</span>
        </a>
      </div>
    </div>

    <!-- Admin Section -->
    {#if agentIsAdministrator}
      <div class="border-primary-400 space-y-3 border-t pt-4">
        <h3 class="text-secondary-300 text-sm font-semibold uppercase tracking-wide">
          Administration
        </h3>
        <a
          href="/admin"
          onclick={closeDrawer}
          class="border-secondary-400 hover:bg-secondary-600 flex items-center gap-3 rounded-lg border p-3 transition-colors"
        >
          <span class="text-lg">⚙️</span>
          <span>Admin Panel</span>
        </a>
      </div>
    {/if}
  </div>
</div>
