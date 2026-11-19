<script lang="ts">
  import Bars from '$lib/components/shared/svg/bars.svelte';
  import messagingPresence from '$lib/services/messagingPresence.svelte';
  import { getUnreadCount, unreadCountLabel } from '$lib/extensions/unread-count';
  import {
    getDrawerStore,
    popup,
    type DrawerSettings,
    type PopupSettings
  } from '@skeletonlabs/skeleton';
  import NavDropdown from '$lib/components/shared/NavDropdown.svelte';
  import { getUserPictureUrl } from '$lib/utils';
  import { MY_MESSAGES, myActivityItems, myProfileItems } from '$lib/navigation/my-menu';
  import { isUserApproved } from '$lib/utils';
  import NetworkStatusPopup from '$lib/components/network/NetworkStatusPopup.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import { turnOf } from '$lib/utils/exchange-ui';
  import { runEffect } from '$lib/utils/effect';
  import { ADMIN_SHORTCUT_ARIA } from '$lib/utils/admin-shortcut';
  import { needsSelfAcceptance, SELF_ACCEPTANCE_LABEL } from '$lib/utils/progenitor-hint';
  import { storeEventBus } from '$lib/stores/storeEvents';
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

  /**
   * **Each nav bar's network details have a name of their own.** The popup finds its panel
   * once, by name, anywhere in the page, and the app has two nav bars (the admin pages
   * draw their own). With one shared name, a bar drawn while the other was still on the
   * page could bind to that bar's panel, which then went away, and the dot opened
   * nothing until the bar was drawn again.
   */
  const barId = $props.id();
  const statusPopupTarget = `popupStatus-${barId}`;
  const popupStatus: PopupSettings = {
    // Represents the type of event that opens/closed the popup
    event: 'click',
    // Matches the data-popup value on this bar's own popup element
    target: statusPopupTarget,
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
  // My Activity. **No number on My Exchanges where there is messaging** (Sam, 4 October).
  // A proposal arriving is one thing to deal with, and there it is already counted as an
  // unopened conversation; a second badge over the same event made it look like two. An
  // exchange waiting on this member says "Your turn" on its own row instead. **Without
  // messaging nothing else counts it**, so it keeps the number: the exchanges waiting on
  // this member.
  //
  // **My Messages is only here when this network has messaging** (R121, brief H4), with
  // the unread count, and only for an accepted member like the rest of My Activity, since
  // Messages is behind the Members only wall. Presence is read from the DNA through H2's
  // module, which is the one question shared chrome may ask. Not read yet counts as
  // present, so the item is there from the first frame and disappears only if the DNA says
  // this network has no messaging. Messages is an activity, not part of who you are, so it
  // is here rather than under your picture (Sam, 16 November).
  function activityItems() {
    return myActivityItems(isUserApproved(currentUser), !messagingPresence.isAbsent).map((item) => {
      if (item.href === paths.exchanges()) {
        return {
          ...item,
          badge: messagingPresence.isAbsent ? pendingCount : undefined,
          badgeLabel: (n: number) => `${n} waiting on you`
        };
      }
      if (item.href === MY_MESSAGES.href) {
        return { ...item, badge: unreadCount, badgeLabel: unreadCountLabel };
      }
      return item;
    });
  }

  /**
   * Exchanges waiting on this member, for a network without messaging: derived from the
   * store's read model and `turnOf`, cleared by acting, not by looking.
   */
  const pendingCount = $derived(
    exchangesStore.exchanges.filter(
      (e) => turnOf(e, usersStore.currentUser?.original_action_hash) === 'you'
    ).length
  );

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
    <div class="flex items-center gap-2 text-white xl:gap-4">
      {#if activityItems().length}
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
      <a
        href={paths.admin()}
        class="variant-ringed-secondary btn relative border-2 px-4 py-2 text-sm text-white transition-colors hover:variant-filled-secondary"
        aria-label={showSetupHint
          ? `Access administration panel. ${SELF_ACCEPTANCE_LABEL}`
          : 'Access administration panel'}
        aria-keyshortcuts={ADMIN_SHORTCUT_ARIA}
      >
        ⚙️ Admin
        {#if showSetupHint}
          <!-- Red stays on the dot: elsewhere in the app red means danger. -->
          <span
            class="pointer-events-none absolute inset-0 ring-2 ring-white rounded-token motion-safe:animate-pulse"
            aria-hidden="true"
          ></span>
          <span
            class="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-error-500 ring-2 ring-primary-500"
            aria-hidden="true"
          ></span>
        {/if}
      </a>
    {/if}

    <!-- The member's own menu: their picture and name, top right -->
    {#if currentUser}
      <!-- A test id rather than the name, which differs from member to member -->
      <div class="text-white" data-testid="member-menu">
        <NavDropdown
          title={currentUser.name}
          avatar={myPicture}
          items={myProfileItems(true)}
          alignRight={true}
        />
      </div>
    {:else}
      <a
        href={paths.myProfileCreate()}
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
<NetworkStatusPopup
  target={statusPopupTarget}
  {connectionStatus}
  {lastPingTime}
  {pingError}
  {networkSeed}
  {networkInfo}
/>
