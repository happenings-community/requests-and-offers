<script lang="ts">
  import Bars from '$lib/components/shared/svg/bars.svelte';
  import {
    getDrawerStore,
    popup,
    type DrawerSettings,
    type PopupSettings
  } from '@skeletonlabs/skeleton';
  import NavDropdown from '$lib/components/shared/NavDropdown.svelte';
  import { getUserPictureUrl } from '$lib/utils';
  import { myActivityItems, myProfileItems } from '$lib/navigation/my-menu';
  import { adminMenuItems, adminWaiting } from '$lib/navigation/admin-menu';
  import NetworkStatusPopup from '$lib/components/network/NetworkStatusPopup.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import { turnOf } from '$lib/utils/exchange-ui';
  import { runEffect } from '$lib/utils/effect';
  import { ADMIN_SHORTCUT_ARIA } from '$lib/utils/admin-shortcut';
  import { onMount, untrack } from 'svelte';
  import { needsSelfAcceptance, SELF_ACCEPTANCE_LABEL } from '$lib/utils/progenitor-hint';
  import { storeEventBus } from '$lib/stores/storeEvents';
  import {
    getConnectionStatusContext,
    type ConnectionStatus
  } from '$lib/context/connection-status.context.svelte';

  // Props for connection status
  type Props = {
    connectionStatus?: ConnectionStatus;
    lastPingTime?: Date | null;
    pingError?: string | null;
    networkSeed?: string | null;
    networkInfo?: { dnaHash: string; roleName: string } | null;
  };

  const { connectionStatus, lastPingTime, pingError, networkSeed, networkInfo }: Props = $props();

  const popupStatus: PopupSettings = {
    // Represents the type of event that opens/closed the popup
    event: 'click',
    // Matches the data-popup value on your popup element
    target: 'popupStatus',
    // Defines which side of your trigger the popup will appear
    placement: 'bottom'
  };

  // Get connection status from context as fallback
  const connectionContext = getConnectionStatusContext();

  // Use props first, then context, then default
  const finalConnectionStatus = $derived(
    connectionStatus ?? connectionContext?.connectionStatus() ?? 'checking'
  );

  const currentUser = $derived(usersStore.currentUser);
  const myPicture = $derived(currentUser ? getUserPictureUrl(currentUser) : undefined);
  const agentIsAdministrator = $derived(administrationStore.agentIsAdministrator);
  const showSetupHint = $derived(
    needsSelfAcceptance(agentIsAdministrator, currentUser?.status?.status_type)
  );
  const drawerStore = getDrawerStore();
  const drawerSettings: DrawerSettings = {
    id: 'menu-drawer',
    width: 'w-1/2 sm:w-1/3',
    bgDrawer: 'bg-primary-500'
  };

  function openDrawer() {
    drawerStore.open(drawerSettings);
  }

  // Navigation menu configurations
  // My Activity, with the count of exchanges waiting on the member.
  function activityItems() {
    return myActivityItems().map((item) =>
      item.href === '/exchanges' ? { ...item, badge: pendingCount } : item
    );
  }

  // Exchanges waiting on this member: derived from the store's read model
  // and turnOf, no notification system involved. Cleared by acting, not by
  // dismissing. Refreshed on a poll so another agent's move shows without a
  // reload; #51 replaces the poll with a signal later.
  const pendingCount = $derived(
    exchangesStore.exchanges.filter(
      (e) => turnOf(e, usersStore.currentUser?.original_action_hash) === 'you'
    ).length
  );

  onMount(() => {
    const refresh = () => {
      if (usersStore.currentUser) runEffect(exchangesStore.refreshMyExchanges()).catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 15000);

    // Accepting yourself on the members page updates the admin list but not your own profile
    // in the users store, so the setup hint would stay until a reload. While it shows,
    // re-read your profile whenever a member's status changes.
    const stopListening = storeEventBus.on('user:status:updated', () => {
      if (showSetupHint) runEffect(usersStore.refreshCurrentUser()).catch(() => {});
    });

    return () => {
      clearInterval(interval);
      stopListening();
    };
  });

  // The Admin menu (#359), with who is waiting to be accepted. Read from the
  // store's lists, which the admin pages fill too; refreshed while the member
  // is an administrator, once a minute, so a new application shows without a
  // visit to the dashboard. The refresh is the background kind: no loading
  // flag, and its answer is dropped if the administrator wrote a status while
  // it was on its way, so a tick never undoes a suspend on screen (#340).
  const adminItems = $derived(
    adminMenuItems(adminWaiting(administrationStore.allUsers, administrationStore.allOrganizations))
  );

  $effect(() => {
    if (!agentIsAdministrator) return;
    const refresh = () => {
      runEffect(administrationStore.refreshLists()).catch(() => {});
    };
    // The fetches write the lists this component reads; untrack keeps that
    // write from re-running the effect that started it.
    untrack(refresh);
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  });

  const communityItems = [
    {
      href: '/users',
      label: 'All Users',
      icon: '👥',
      description: 'Browse community members'
    },
    {
      href: '/organizations',
      label: 'Organizations',
      icon: '🏢',
      description: 'Explore organizations and teams'
    }
  ];

  const resourceItems = [
    {
      href: '/service-types',
      label: 'Service Types',
      icon: '🏷️',
      description: 'Browse available skill categories'
    }
  ];

  // Connection status helpers
  function getConnectionIcon(status: typeof finalConnectionStatus): string {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'checking':
        return '🟡';
      case 'disconnected':
        return '🟠';
      case 'alone':
        return '🟡';
      case 'offline':
        return '🔴';
      case 'error':
        return '🔴';
      default:
        return '🟡';
    }
  }

  function getConnectionText(status: typeof finalConnectionStatus): string {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'checking':
        return 'Checking...';
      case 'disconnected':
        return 'Disconnected';
      case 'alone':
        return 'Online, no peers';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  }
</script>

<nav class="flex h-20 w-full items-center justify-between bg-primary-500 px-4 shadow-lg">
  <!-- Logo Section -->
  <div class="flex items-center">
    <a href="/" class="flex items-center gap-3 transition-opacity hover:opacity-80">
      <img src="/hAppeningsCIClogo.png" alt="hAppenings Community Logo" class="h-12 w-12" />
      <span class="hidden whitespace-nowrap text-lg font-bold text-white sm:block"
        >Requests & Offers</span
      >
    </a>
  </div>

  <!-- Desktop Navigation -->
  <div class="hidden items-center gap-4 lg:flex xl:gap-8">
    <!-- Primary Actions -->
    <div class="flex items-center gap-3 xl:gap-6">
      <a
        href="/requests"
        class="variant-filled-secondary btn px-6 py-2 font-semibold shadow-md transition-colors hover:variant-filled-tertiary hover:shadow-lg"
        aria-label="Browse requests - discover opportunities to help"
      >
        📝 Requests
      </a>
      <a
        href="/offers"
        class="variant-filled-warning btn px-6 py-2 font-semibold shadow-md transition-colors hover:variant-filled-error hover:shadow-lg"
        aria-label="Browse offers - see how others can help you"
      >
        💡 Offers
      </a>
    </div>

    <!-- Secondary Navigation -->
    <div class="flex items-center gap-2 text-white xl:gap-4">
      {#if currentUser}
        <NavDropdown title="My Activity" items={activityItems()} />
      {/if}

      <NavDropdown title="Community" items={communityItems} />

      <NavDropdown title="Resources" items={resourceItems} alignRight={true} />
    </div>

    <!-- Connection Status Indicator: a button, so it reads as one -->
    <button
      type="button"
      class="flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-secondary-300"
      aria-label={`Connection status: ${getConnectionText(finalConnectionStatus)}. Show network details`}
      title="Network details"
      use:popup={popupStatus}
    >
      <span class="text-sm" aria-hidden="true">
        {getConnectionIcon(finalConnectionStatus)}
      </span>
    </button>

    <!-- Admin Access -->
    {#if agentIsAdministrator}
      <!-- #411's Admin menu, with #361's hint for a progenitor who has not yet accepted
           their own membership: the dot and pulse sit on the menu button. -->
      <div class="relative text-white">
        <NavDropdown
          title="Admin"
          items={adminItems}
          keyshortcuts={ADMIN_SHORTCUT_ARIA}
          badgeLabel="waiting to be accepted"
          alignRight={true}
        />
        {#if showSetupHint}
          <!-- Red stays on the dot: elsewhere in the app red means danger. -->
          <span
            class="pointer-events-none absolute inset-0 rounded-token ring-2 ring-white motion-safe:animate-pulse"
            aria-hidden="true"
          ></span>
          <span
            class="pointer-events-none absolute -right-1 -top-1 h-3 w-3 rounded-full bg-error-500 ring-2 ring-primary-500"
            aria-hidden="true"
          ></span>
          <span class="sr-only">{SELF_ACCEPTANCE_LABEL}</span>
        {/if}
      </div>
    {/if}

    <!-- The member's own menu: their picture and name, top right -->
    {#if currentUser}
      <div class="text-white">
        <NavDropdown
          title={currentUser.name}
          avatar={myPicture}
          items={myProfileItems(true)}
          alignRight={true}
        />
      </div>
    {:else}
      <a
        href="/user/create"
        class="variant-ringed-secondary btn border-2 px-4 py-2 text-sm text-white transition-colors hover:variant-filled-secondary"
        >Create Profile</a
      >
    {/if}
  </div>

  <!-- Mobile Menu Button -->
  <button
    class="variant-filled-secondary btn shadow-md transition-shadow hover:shadow-lg lg:hidden"
    onclick={openDrawer}
    aria-label="Open navigation menu"
  >
    <Bars svgClass="fill-white h-6 w-6" />
  </button>
</nav>

<!-- Popup Status -->
<NetworkStatusPopup {connectionStatus} {lastPingTime} {pingError} {networkSeed} {networkInfo} />
