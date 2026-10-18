<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import {
    getModalStore,
    getToastStore,
    type ModalComponent,
    type ModalSettings
  } from '@skeletonlabs/skeleton';
  import { Effect as E } from 'effect';
  import usersStore from '$lib/stores/users.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import BackButton from '$lib/components/shared/BackButton.svelte';
  import ListingCard from '$lib/components/shared/listings/ListingCard.svelte';
  import MarkdownRenderer from '$lib/components/shared/MarkdownRenderer.svelte';
  import StatusHistoryModal from '$lib/components/shared/status/StatusHistoryModal.svelte';
  import ProgenitorBadge from '$lib/components/users/ProgenitorBadge.svelte';
  import UserName from '$lib/components/users/UserName.svelte';
  import type { Revision, UIOffer, UIOrganization, UIRequest, UIUser } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import { getOrganizationLogoUrl } from '$lib/utils';
  import {
    detailsLine,
    exchangesWith,
    exchangesWithLabel,
    statusChip,
    type ProfileView
  } from '$lib/utils/profile';

  /**
   * A member's profile (#350), as the design system lays it out: picture,
   * name, chips and details; the bio; then their listings and organisations.
   * On your own profile the counts lead to My Listings and My Exchanges
   * instead of repeating them.
   */
  let { user, isCurrentUser = false }: { user: UIUser; isCurrentUser?: boolean } = $props();

  const { isProgenitor } = $derived(administrationStore);
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  let picture = $state('/default_avatar.webp');
  let requests = $state<UIRequest[]>([]);
  let offers = $state<UIOffer[]>([]);
  let organisations = $state<{ org: UIOrganization; coordinator: boolean }[]>([]);
  let loading = $state(true);
  let failed = $state(false);
  let view = $state<ProfileView>('requests');

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const status = $derived(statusChip(user.status));
  const details = $derived(detailsLine(user));
  const withYou = $derived(exchangesWith(exchangesStore.exchanges, me, user.original_action_hash));
  const canCreate = $derived(isCurrentUser && user.status?.status_type === 'accepted');

  $effect(() => {
    if (!user.picture) return;
    const url = URL.createObjectURL(new Blob([new Uint8Array(user.picture)]));
    picture = url;
    return () => URL.revokeObjectURL(url);
  });

  async function loadOrganisations(hash: Uint8Array) {
    const orgs = await E.runPromise(organizationsStore.getUserOrganizations(hash));
    return Promise.all(
      orgs
        .filter((org) => org.original_action_hash)
        .map(async (org) => ({
          org,
          coordinator: await E.runPromise(
            organizationsStore.isOrganizationCoordinator(org.original_action_hash!, hash)
          ).catch(() => false)
        }))
    );
  }

  async function load() {
    const hash = user.original_action_hash;
    loading = true;
    failed = false;
    try {
      [requests, offers, organisations] = await Promise.all([
        runEffect(requestsStore.getUserActiveRequests(hash)),
        runEffect(offersStore.getUserActiveOffers(hash)),
        loadOrganisations(hash),
        runEffect(exchangesStore.loadMyExchanges()).catch(() => [])
      ]);
    } catch (err) {
      console.error('Failed to load profile:', err);
      failed = true;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    user.original_action_hash;
    load();
  });

  const statusHistoryModalComponent: ModalComponent = { ref: StatusHistoryModal };
  const statusHistoryModal = (statusHistory: Revision[]): ModalSettings => ({
    type: 'component',
    component: statusHistoryModalComponent,
    meta: { statusHistory: [...statusHistory] }
  });

  async function openStatusHistory() {
    try {
      const statusLink = await runEffect(usersStore.getUserStatusLink(user.original_action_hash));
      if (!statusLink) return;
      const statusHistory = await runEffect(administrationStore.getEntityStatusHistory(user));
      modalStore.trigger(statusHistoryModal(statusHistory));
      modalStore.update((modals) => modals.reverse());
    } catch (err) {
      console.error('Failed to fetch status history:', err);
      toastStore.trigger({
        message: "Couldn't load the status history. Try again.",
        background: 'variant-filled-error',
        autohide: true,
        timeout: 5000
      });
    }
  }

  const count = (n: number) => (loading ? '…' : n);

  const VIEWS: { key: ProfileView; label: string; icon: string; ring: string }[] = [
    { key: 'requests', label: 'Requests', icon: '\u{1F4DD}', ring: 'ring-secondary-500' },
    { key: 'offers', label: 'Offers', icon: '\u{1F4A1}', ring: 'ring-warning-500' },
    { key: 'organisations', label: 'Organisations', icon: '\u{1F3E2}', ring: 'ring-tertiary-500' }
  ];
  const viewCount = (key: ProfileView) =>
    key === 'requests' ? requests.length : key === 'offers' ? offers.length : organisations.length;

  const firstName = $derived(user.nickname || user.name);
  const emptyText = $derived<Record<ProfileView, string>>({
    requests: `${firstName} has no active requests.`,
    offers: `${firstName} has no active offers.`,
    organisations: `${firstName} isn't in any organisations.`
  });
</script>

<section class="container mx-auto space-y-6 p-4">
  <div class="flex items-center justify-between gap-2">
    <BackButton fallback="/users" />
    {#if isCurrentUser}
      <a href="/user/edit" class="variant-filled-primary btn">Edit profile</a>
    {/if}
  </div>

  <!-- Who they are -->
  <div class="card space-y-4 p-4 md:p-6" data-testid="profile-header">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      <img
        src={picture}
        alt=""
        class="h-24 w-24 shrink-0 rounded-full object-cover"
        data-testid="profile-picture"
      />
      <div class="min-w-0 flex-1 space-y-2">
        <div>
          <h1 class="h2"><UserName {user} /></h1>
          {#if user.nickname}
            <p class="text-surface-600 dark:text-surface-300">{user.nickname}</p>
          {/if}
        </div>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          {#if status}
            <span class="badge {status.variant}" data-testid="status-chip">{status.label}</span>
          {/if}
          {#if isCurrentUser}
            <span class="variant-soft-primary badge">You</span>
          {/if}
          {#if isCurrentUser && isProgenitor}
            <ProgenitorBadge />
          {/if}
          {#if !isCurrentUser && withYou.length > 0}
            <a
              href="/exchanges"
              class="variant-filled-primary badge ml-auto"
              data-testid="exchanges-with-you">{exchangesWithLabel(withYou.length)}</a
            >
          {/if}
        </div>
        {#if details.length}
          <p class="text-sm text-surface-600 dark:text-surface-300">{details.join(' · ')}</p>
        {/if}
        {#if user.email || user.phone}
          <p class="text-sm text-surface-600 dark:text-surface-300">
            {[user.email, user.phone].filter(Boolean).join(' · ')}
          </p>
        {/if}
        {#if status?.label === 'Suspended' && user.status?.reason}
          <p class="text-sm"><strong>Reason:</strong> {user.status.reason}</p>
        {/if}
        {#if status?.until}
          <p class="text-sm"><strong>Suspended until:</strong> {status.until}</p>
        {/if}
        <button
          type="button"
          class="anchor text-sm"
          onclick={openStatusHistory}
          data-testid="status-history-link">Status history ›</button
        >
      </div>
    </div>

    {#if user.bio}
      <div class="space-y-1 border-t border-surface-300 pt-4 dark:border-surface-600">
        <h2 class="h4">About</h2>
        <MarkdownRenderer content={user.bio} />
      </div>
    {/if}
  </div>

  {#if failed}
    <div class="card space-y-3 p-6 text-center">
      <p>Couldn't load {isCurrentUser ? 'your' : 'their'} listings and organisations.</p>
      <button class="variant-filled-primary btn" onclick={load}>Try again</button>
    </div>
  {:else if isCurrentUser}
    <!-- Your own profile: the counts lead to the pages where you manage them -->
    <div class="grid gap-4 sm:grid-cols-3" data-testid="profile-doorways">
      <a href="/my-listings?view=requests" class="card card-hover space-y-1 p-4">
        <div class="flex items-start justify-between">
          <span class="text-2xl">📝</span>
          <span class="text-3xl font-bold">{count(requests.length)}</span>
        </div>
        <h2 class="h4">Active requests</h2>
        <p class="text-sm text-surface-600 dark:text-surface-300">In My Listings</p>
      </a>
      <a href="/my-listings?view=offers" class="card card-hover space-y-1 p-4">
        <div class="flex items-start justify-between">
          <span class="text-2xl">💡</span>
          <span class="text-3xl font-bold">{count(offers.length)}</span>
        </div>
        <h2 class="h4">Active offers</h2>
        <p class="text-sm text-surface-600 dark:text-surface-300">In My Listings</p>
      </a>
      <a href="/exchanges" class="card card-hover space-y-1 p-4">
        <div class="flex items-start justify-between">
          <span class="text-2xl">🤝</span>
          <span class="text-3xl font-bold">{count(exchangesStore.exchanges.length)}</span>
        </div>
        <h2 class="h4">Exchanges</h2>
        <p class="text-sm text-surface-600 dark:text-surface-300">In My Exchanges</p>
      </a>
    </div>

    <div class="space-y-3">
      <h2 class="h3">Your organisations</h2>
      {#if loading}
        <p class="text-surface-600 dark:text-surface-300">Loading your organisations...</p>
      {:else if organisations.length === 0}
        <div class="card space-y-3 p-6 text-center">
          <p class="text-surface-600 dark:text-surface-300">You aren't in any organisations yet.</p>
          <a href="/organizations" class="variant-filled-tertiary btn">Browse organisations</a>
        </div>
      {:else}
        {@render orgList()}
      {/if}
    </div>
    {#if canCreate}
      <div class="flex flex-wrap gap-2">
        <a href="/requests/create" class="variant-filled-secondary btn">Create a request</a>
        <a href="/offers/create" class="variant-filled-warning btn">Create an offer</a>
      </div>
    {/if}
  {:else}
    <!-- Someone else's profile: the counts choose what is shown -->
    <div class="grid gap-4 sm:grid-cols-3" role="tablist" aria-label="Profile views">
      {#each VIEWS as v (v.key)}
        <button
          class="card space-y-1 p-4 text-left transition-colors hover:bg-surface-100 dark:hover:bg-surface-700 {view ===
          v.key
            ? `ring-2 ${v.ring}`
            : ''}"
          role="tab"
          aria-selected={view === v.key}
          onclick={() => (view = v.key)}
        >
          <div class="flex items-start justify-between">
            <span class="text-2xl">{v.icon}</span>
            <span class="text-3xl font-bold">{count(viewCount(v.key))}</span>
          </div>
          <h2 class="h4">{v.label}</h2>
        </button>
      {/each}
    </div>

    {#if loading}
      <p class="text-surface-600 dark:text-surface-300">Loading...</p>
    {:else if viewCount(view) === 0}
      <div class="card p-6 text-center">
        <p class="text-surface-600 dark:text-surface-300">{emptyText[view]}</p>
      </div>
    {:else if view === 'organisations'}
      {@render orgList()}
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each view === 'requests' ? requests : offers as listing (listing.original_action_hash.toString())}
          <ListingCard kind={view === 'requests' ? 'Request' : 'Offer'} {listing} />
        {/each}
      </div>
    {/if}
  {/if}
</section>

{#snippet orgList()}
  <ul class="grid grid-cols-1 gap-4 md:grid-cols-2">
    {#each organisations as { org, coordinator } (org.original_action_hash!.toString())}
      <li class="card flex items-center gap-3 p-4">
        <img
          src={getOrganizationLogoUrl(org)}
          alt=""
          class="h-12 w-12 shrink-0 rounded-full object-cover"
        />
        <div class="min-w-0 flex-1">
          <a
            class="h4 hover:underline"
            href="/organizations/{encodeHashToBase64(org.original_action_hash!)}">{org.name}</a
          >
        </div>
        <span class="badge {coordinator ? 'variant-soft-tertiary' : 'variant-soft-surface'}"
          >{coordinator ? 'Coordinator' : 'Member'}</span
        >
      </li>
    {/each}
  </ul>
{/snippet}
