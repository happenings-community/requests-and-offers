<script lang="ts">
  import Bars from '$lib/components/shared/svg/bars.svelte';
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
  function myActivityItems() {
    const user = currentUser; // dereference the signal
    return [
      {
        href: user ? '/user' : '/user/create',
        label: user ? 'My Profile' : 'Create Profile',
        icon: '👤',
        description: user ? 'View and edit your profile' : 'Join the community'
      },
      {
        href: '/requests?filter=my',
        label: 'My Requests',
        icon: '📋',
        description: 'Manage your requests for help'
      },
      {
        href: '/offers?filter=my',
        label: 'My Offers',
        icon: '🎯',
        description: 'Manage your offers to help others'
      },
      {
        href: '/my-listings',
        label: 'My Listings',
        icon: '📋',
        description: 'Manage your requests and offers'
      }
    ];
  }

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
    },
    {
      href: '/projects',
      label: 'Projects',
      icon: '🚀',
      description: 'Discover active projects'
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
    <div class="flex items-center gap-4 text-white">
      <NavDropdown title="My Activity" items={myActivityItems()} />

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
        href="/admin"
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
