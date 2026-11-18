<script>
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { getUserPictureUrl, isUserApproved } from '$lib/utils';
  import { MY_MESSAGES, myActivityItems, myProfileItems } from '$lib/navigation/my-menu';
  import messagingPresence from '$lib/services/messagingPresence.svelte';
  import { useNavCounts } from '$lib/navigation/nav-counts.svelte';
  import { paths } from '$lib/paths';
  import { adminMenuItems, adminWaiting } from '$lib/navigation/admin-menu';
  import { needsSelfAcceptance, SELF_ACCEPTANCE_LABEL } from '$lib/utils/progenitor-hint';

  const drawerStore = getDrawerStore();
  const { currentUser } = $derived(usersStore);
  const activity = $derived(
    myActivityItems(isUserApproved(currentUser), !messagingPresence.isAbsent)
  );
  const { agentIsAdministrator } = $derived(administrationStore);
  // The same items as the nav bar's Admin menu (#359), counts included.
  const adminItems = $derived(
    adminMenuItems(adminWaiting(administrationStore.allUsers, administrationStore.allOrganizations))
  );
  const showSetupHint = $derived(
    needsSelfAcceptance(agentIsAdministrator, currentUser?.status?.status_type)
  );

  // My Messages: the same entry as the nav bar's envelope, asked for the same way:
  // whether this network has messaging comes from the one presence module, and the counts
  // from the one place the nav bar reads them, so the drawer knows nothing of messaging
  // itself. On a narrow screen this is the only menu, and without the entry the only way
  // to Messages was a Go to chat link or the address bar. My Exchanges carries the
  // exchanges waiting on the member where there is no messaging, as on the bar.
  const counts = useNavCounts();

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

    <!-- My Activity: the bar's My Exchanges, My Listings and envelope, as a list; accepted members only -->
    {#if activity.length}
      <div class="space-y-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-secondary-300">
          My Activity
        </h3>
        <div class="space-y-2">
          {#each activity as item (item.href)}
            {@const isMessages = item.href === MY_MESSAGES.href}
            {@const badge = isMessages
              ? counts.unreadCount
              : item.href === paths.exchanges()
                ? counts.exchangesBadge
                : 0}
            <a
              href={item.href}
              onclick={closeDrawer}
              class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
              data-testid={isMessages ? 'drawer-messages' : undefined}
            >
              <span class="text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {#if badge}
                <!-- Said in words: a bare number told a screen reader nothing. -->
                <span class="variant-filled-secondary badge ml-auto"
                  ><span aria-hidden="true">{badge}</span><span class="sr-only"
                    >{isMessages ? counts.totalLabel : `${badge} waiting on you`}</span
                  ></span
                >
              {/if}
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
        <!-- Resources held only this, so it joined Community, as in the nav bar. -->
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
        <div class="space-y-2">
          {#each adminItems as item (item.href)}
            <a
              href={item.href}
              onclick={closeDrawer}
              class="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-primary-400"
            >
              <span class="text-lg" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {#if item.badge}
                <!-- Said in words: a bare number told a screen reader nothing. -->
                <span
                  class="badge ml-auto bg-white px-1.5 py-0 text-xs font-semibold text-primary-700"
                  ><span aria-hidden="true">{item.badge}</span><span class="sr-only"
                    >{item.badge} waiting to be accepted</span
                  ></span
                >
              {/if}
            </a>
          {/each}
        </div>
        {#if showSetupHint}
          <p class="flex items-center gap-2 px-3 text-sm">
            <span class="h-3 w-3 rounded-full bg-error-500" aria-hidden="true"></span>
            {SELF_ACCEPTANCE_LABEL}
          </p>
        {/if}
      </div>
    {/if}
  </div>
</div>
