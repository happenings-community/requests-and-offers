<script lang="ts">
  import Bars from '$lib/components/shared/svg/bars.svelte';
  import messagingPresence from '$lib/services/messagingPresence.svelte';
  import { getUnreadCount } from '$lib/extensions/unread-count';
  import {
    getDrawerStore,
    popup,
    type DrawerSettings,
    type PopupSettings
  } from '@skeletonlabs/skeleton';
  import NavDropdown from '$lib/components/shared/NavDropdown.svelte';
  import NetworkStatusPopup from '$lib/components/network/NetworkStatusPopup.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { onMount } from 'svelte';
  import {
    getConnectionStatusContext,
    type ConnectionStatus
  } from '$lib/context/connection-status.context.svelte';
  import { paths } from '$lib/paths';

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
  const agentIsAdministrator = $derived(administrationStore.agentIsAdministrator);
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
  function profileItems() {
    const user = currentUser; // dereference the signal
    return [
      {
        href: user ? paths.myProfile() : paths.myProfileCreate(),
        label: user ? 'My Profile' : 'Create Profile',
        icon: '👤',
        description: user ? 'View and edit your profile' : 'Join the community'
      },
      {
        href: paths.requests({ filter: 'my' }),
        label: 'My Requests',
        icon: '📋',
        description: 'Manage your requests for help'
      },
      {
        href: paths.offers({ filter: 'my' }),
        label: 'My Offers',
        icon: '🎯',
        description: 'Manage your offers to help others'
      },
      {
        href: paths.myListings(),
        label: 'My Listings',
        icon: '📋',
        description: 'Manage your requests and offers'
      },
      {
        href: paths.exchanges(),
        label: 'My Exchanges',
        // **No number here** (Sam, 4 October). A proposal arriving is one thing to deal
        // with, and it is already counted as an unopened conversation; a second badge
        // over the same event made it look like two. An exchange waiting on this member
        // says "Your turn" on its own row instead, which clears when they act rather
        // than when they look.
        badge: undefined,
        icon: '🤝',
        description: 'Agreements you are part of'
      },
      /**
       * **My Messages is only here when this network has messaging** (R121, brief H4).
       *
       * Read from the DNA through H2's module, which is the one question shared chrome may
       * ask. Not read yet counts as present, so the item is there from the first frame and
       * disappears only if the DNA says this network has no messaging.
       */
      ...(messagingPresence.isAbsent
        ? []
        : [
            {
              href: paths.messages(),
              label: 'My Messages',
              badge: unreadCount,
              icon: '✉️',
              description: 'Your conversations with other members'
            }
          ])
    ];
  }

  /**
   * The badge, from whatever messaging plugged in (brief H4, rule 2).
   *
   * **Shared chrome may ask whether messaging is here; it may not reach it.** Counting
   * unopened conversations means reading the messaging store and keeping a poll alive, so
   * messaging supplies the number and the root layout plugs it in. `undefined` means
   * nothing is plugged in, which is both a network without messaging and the moment before
   * the first poll returns: no badge either way, since a confident 0 would be a claim
   * nobody has checked.
   *
   * It still counts conversations rather than items, and the same number My Messages shows,
   * read from one place so the two cannot disagree.
   */
  const unread = getUnreadCount();
  const unreadCount = $derived(unread());

  onMount(() => {
    const refresh = () => {
      if (!usersStore.currentUser) return;
      runEffect(exchangesStore.refreshMyExchanges()).catch(() => {});
      // Messaging's half of this poll moved to the root layout with the badge (H4): the
      // nav bar has no messaging timing of its own. #51 replaces both with a signal.
    };
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  });

  const communityItems = [
    {
      href: paths.users(),
      label: 'All Users',
      icon: '👥',
      description: 'Browse community members'
    },
    {
      href: paths.organizations(),
      label: 'Organizations',
      icon: '🏢',
      description: 'Explore organizations and teams'
    }
  ];

  const resourceItems = [
    {
      href: paths.serviceTypes(),
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
      <span class="hidden text-lg font-bold text-white sm:block">Requests & Offers</span>
    </a>
  </div>

  <!-- Desktop Navigation -->
  <div class="hidden items-center gap-8 lg:flex">
    <!-- Primary Actions -->
    <div class="flex items-center gap-6">
      <a
        href={paths.requests()}
        class="variant-filled-secondary btn px-6 py-2 font-semibold shadow-md transition-colors hover:variant-filled-tertiary hover:shadow-lg"
        aria-label="Browse requests - discover opportunities to help"
      >
        📝 Requests
      </a>
      <a
        href={paths.offers()}
        class="variant-filled-warning btn px-6 py-2 font-semibold shadow-md transition-colors hover:variant-filled-error hover:shadow-lg"
        aria-label="Browse offers - see how others can help you"
      >
        💡 Offers
      </a>
    </div>

    <!-- Secondary Navigation -->
    <div class="flex items-center gap-4 text-white">
      <NavDropdown title="Profile" items={profileItems()} />

      <NavDropdown title="Community" items={communityItems} />

      <NavDropdown title="Resources" items={resourceItems} alignRight={true} />
    </div>

    <!-- Connection Status Indicator -->
    <div
      class="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm transition-colors"
      use:popup={popupStatus}
    >
      <span
        class="text-sm"
        role="img"
        aria-label={`Connection status: ${getConnectionText(finalConnectionStatus)}`}
      >
        {getConnectionIcon(finalConnectionStatus)}
      </span>
    </div>

    <!-- Admin Access -->
    {#if agentIsAdministrator}
      <a
        href={paths.admin()}
        class="variant-ringed-secondary btn border-2 px-4 py-2 text-sm text-white transition-colors hover:variant-filled-secondary"
        aria-label="Access administration panel"
      >
        ⚙️ Admin
      </a>
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
