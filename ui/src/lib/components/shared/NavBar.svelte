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
  import NavIcon from '$lib/components/shared/svg/NavIcon.svelte';
  import { page } from '$app/state';
  import { getUserPictureUrl, isUserApproved } from '$lib/utils';
  import { myProfileItems } from '$lib/navigation/my-menu';
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

  /** The page this link leads to is the one open, or one beneath it. */
  const isCurrent = (href: string) =>
    page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);

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

  // **My Exchanges and My Listings are links on the bar, and Messages an envelope**
  // (Sam, 16 November): they are among the most visited screens, and a dropdown named
  // for the member hid them. The menu under the member's picture is their profile.
  //
  // **No number on My Exchanges where there is messaging** (Sam, 4 October). A proposal
  // arriving is one thing to deal with, and there it is already counted as an unopened
  // conversation on the envelope; a second badge over the same event made it look like
  // two. An exchange waiting on this member says "Your turn" on its own row instead.
  // **Without messaging nothing else counts it**, so My Exchanges keeps the number: the
  // exchanges waiting on this member.
  // **The member's own screens are for accepted members** (#349 review, Sam 17 November):
  // My Exchanges, My Listings and Messages all sit behind the Members only wall, so a
  // pending or suspended member gets no links that end there.
  const accepted = $derived(isUserApproved(currentUser));
  const exchangesBadge = $derived(messagingPresence.isAbsent ? pendingCount : 0);

  // **The envelope is only here when this network has messaging** (R121, brief H4). Read
  // from the DNA through H2's module, which is the one question shared chrome may ask.
  // Not read yet counts as present, so it is there from the first frame and disappears
  // only if the DNA says this network has no messaging. It has no word on screen, so its
  // name, and the count in words, are in its label and its tooltip.
  const messagesLabel = $derived(
    unreadCount ? `Messages, ${unreadCountLabel(unreadCount)}` : 'Messages'
  );

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
    },
    // Resources held only this, so it joined Community.
    {
      href: paths.serviceTypes(),
      label: 'Service Types',
      icon: '🏷️',
      description: 'Browse available skill categories'
    }
  ];

  // Connection status helpers
  function getConnectionColour(status: typeof finalConnectionStatus): string {
    switch (status) {
      case 'connected':
        return 'bg-green-400';
      case 'checking':
      case 'alone':
        return 'bg-yellow-300';
      case 'disconnected':
        return 'bg-orange-400';
      case 'offline':
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-yellow-300';
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
      <!-- The title: beside the hamburger on a narrow screen, and on the desktop bar only
           where there is room for it beside the member's own screens. -->
      <span
        class="hidden whitespace-nowrap text-lg font-bold text-white sm:block lg:hidden 2xl:block"
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

    <!-- Secondary Navigation: the member's own screens, then Community -->
    <div class="flex items-center gap-1 text-white xl:gap-3">
      {#if accepted}
        <a
          href={paths.exchanges()}
          class="inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-2 transition-colors hover:text-secondary-300 focus:outline-none focus:ring-2 focus:ring-secondary-300 aria-[current=page]:bg-white/15"
          aria-current={isCurrent(paths.exchanges()) ? 'page' : undefined}
          title="My Exchanges"
          data-testid="nav-exchanges"
        >
          <NavIcon name="exchanges" />
          <!-- The word only where the bar has room for it; a screen reader always has it. -->
          <span class="sr-only xl:not-sr-only">My Exchanges</span>
          {#if exchangesBadge}
            <span class="badge bg-white px-1.5 py-0 text-xs font-semibold text-primary-700"
              ><span aria-hidden="true">{exchangesBadge > 9 ? '9+' : exchangesBadge}</span><span
                class="sr-only">{exchangesBadge} waiting on you</span
              ></span
            >
          {/if}
        </a>
        <a
          href={paths.myListings()}
          class="inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-2 transition-colors hover:text-secondary-300 focus:outline-none focus:ring-2 focus:ring-secondary-300 aria-[current=page]:bg-white/15"
          aria-current={isCurrent(paths.myListings()) ? 'page' : undefined}
          title="My Listings"
        >
          <NavIcon name="listings" />
          <span class="sr-only xl:not-sr-only">My Listings</span>
        </a>
      {/if}

      <NavDropdown title="Community" icon="community" items={communityItems} alignRight={true} />
    </div>

    <!-- Messages: an envelope, beside the status and the member's picture -->
    {#if accepted && !messagingPresence.isAbsent}
      <a
        href={paths.messages()}
        class="relative inline-flex h-10 w-10 items-center justify-center rounded text-white transition-colors hover:text-secondary-300 focus:outline-none focus:ring-2 focus:ring-secondary-300 aria-[current=page]:bg-white/15"
        aria-label={messagesLabel}
        title={messagesLabel}
        aria-current={isCurrent(paths.messages()) ? 'page' : undefined}
        data-testid="nav-messages"
      >
        <NavIcon name="mail" class="h-6 w-6" />
        {#if unreadCount}
          <span
            class="badge absolute -right-1 -top-0.5 bg-white px-1.5 py-0 text-xs font-semibold text-primary-700 ring-2 ring-primary-500"
            aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span
          >
        {/if}
      </a>
    {/if}

    <!-- Connection Status Indicator: a button, so it reads as one -->
    <button
      type="button"
      class="flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-secondary-300"
      aria-label={`Connection status: ${getConnectionText(finalConnectionStatus)}. Show network details`}
      title="Network details"
      use:popup={popupStatus}
    >
      <!-- A drawn dot, not an emoji: emoji do not render in every desktop build. -->
      <span
        class="block h-3 w-3 rounded-full {getConnectionColour(finalConnectionStatus)}"
        aria-hidden="true"
        data-status={finalConnectionStatus}
      ></span>
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
<NetworkStatusPopup {connectionStatus} {lastPingTime} {pingError} {networkSeed} {networkInfo} />
