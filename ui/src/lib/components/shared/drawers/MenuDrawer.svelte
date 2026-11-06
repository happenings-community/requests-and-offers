<script>
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import messagingPresence from '$lib/services/messagingPresence.svelte';
  import { getUnreadCount } from '$lib/extensions/unread-count';
  import { paths } from '$lib/paths';

  const drawerStore = getDrawerStore();
  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator } = $derived(administrationStore);

  // The same entry the nav bar's Profile menu has, asked for the same way: whether this
  // network has messaging comes from the one presence module, and the count from the
  // extension point, so the drawer knows nothing of messaging itself. On a narrow screen
  // this is the only menu, and without the entry the only way to Messages was a Go to
  // chat link or the address bar.
  const unread = getUnreadCount();
  const unreadCount = $derived(unread());

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
    <!-- Primary Actions -->
    <div class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">Main Actions</h3>
      <a
        href={paths.requests()}
        onclick={closeDrawer}
        class="flex items-center gap-3 rounded-lg bg-secondary-600 p-3 transition-colors hover:bg-secondary-700"
      >
        <span class="text-xl">📝</span>
        <span class="font-medium">Requests</span>
      </a>
      <a
        href={paths.offers()}
        onclick={closeDrawer}
        class="flex items-center gap-3 rounded-lg bg-warning-600 p-3 transition-colors hover:bg-warning-700"
      >
        <span class="text-xl">💡</span>
        <span class="font-medium">Offers</span>
      </a>
    </div>

    <!-- Profile -->
    <div class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">Profile</h3>
      <div class="space-y-2">
        {#if currentUser}
          <a
            href={paths.myProfile()}
            onclick={closeDrawer}
            class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
          >
            <span class="text-lg">👤</span>
            <span>My Profile</span>
          </a>
        {:else}
          <a
            href={paths.myProfileCreate()}
            onclick={closeDrawer}
            class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
          >
            <span class="text-lg">👤</span>
            <span>Create Profile</span>
          </a>
        {/if}
        <a
          href={paths.requests({ filter: 'my' })}
          onclick={closeDrawer}
          class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
        >
          <span class="text-lg">📋</span>
          <span>My Requests</span>
        </a>
        <a
          href={paths.offers({ filter: 'my' })}
          onclick={closeDrawer}
          class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
        >
          <span class="text-lg">🎯</span>
          <span>My Offers</span>
        </a>
        <a
          href={paths.myListings()}
          onclick={closeDrawer}
          class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
        >
          <span class="text-lg">📋</span>
          <span>My Listings</span>
        </a>
        <a
          href={paths.exchanges()}
          onclick={closeDrawer}
          class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
        >
          <span class="text-xl">🤝</span>
          <span>My Exchanges</span>
        </a>
        {#if !messagingPresence.isAbsent}
          <a
            href={paths.messages()}
            onclick={closeDrawer}
            class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
            data-testid="drawer-messages"
          >
            <span class="text-xl">✉️</span>
            <span>My Messages</span>
            {#if unreadCount}
              <span class="variant-filled-secondary badge ml-auto">{unreadCount}</span>
            {/if}
          </a>
        {/if}
      </div>
    </div>

    <!-- Community -->
    <div class="space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">Community</h3>
      <div class="space-y-2">
        <a
          href={paths.users()}
          onclick={closeDrawer}
          class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
        >
          <span class="text-lg">👥</span>
          <span>All Users</span>
        </a>
        <a
          href={paths.organizations()}
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
          href={paths.serviceTypes()}
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
          href={paths.admin()}
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
