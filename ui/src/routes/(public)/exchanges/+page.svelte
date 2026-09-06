<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
  import {
    actionLabel,
    awaitingMe,
    counterpartyOf,
    exchangeStatusVariant,
    formatWhen,
    roleOf,
    statusLabel,
    tabOf,
    termLabel,
    turnOf,
    wroteIt,
    type ExchangeTab
  } from '$lib/utils/exchange-ui';
  import type { UIExchange } from '$lib/types/ui';

  const TABS: { key: ExchangeTab; label: string; icon: string; blurb: string; ring: string }[] = [
    { key: 'proposals', label: 'Proposals', icon: '\u{1F4E8}', blurb: 'Sent to you or by you, waiting on an answer.', ring: 'ring-secondary-500' },
    { key: 'active', label: 'Active', icon: '\u{1F504}', blurb: 'Agreements under way, until both parts are done.', ring: 'ring-primary-500' },
    { key: 'completed', label: 'Completed', icon: '\u{1F389}', blurb: 'Both parts done; reviews to leave or already given.', ring: 'ring-success-500' }
  ];

  let tab = $state<ExchangeTab>('active');
  let names = $state<Record<string, string>>({});
  let titles = $state<Record<string, string>>({});
  let ready = $state(false);
  let loadError = $state<string | null>(null);

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const b64 = encodeHashToBase64;
  const count = (t: ExchangeTab) => exchangesStore.exchanges.filter((e) => tabOf(e) === t).length;
  const mine = (t: ExchangeTab) =>
    exchangesStore.exchanges.filter((e) => tabOf(e) === t && awaitingMe(e, me)).length;
  let side = $state<'all' | 'provider' | 'receiver'>('all');
  let from = $state<'all' | 'Offer' | 'Request'>('all');
  let order = $state<'latest' | 'oldest'>('latest');
  let turn = $state<'all' | 'you' | 'them'>('all');
  const shown = $derived(
    exchangesStore.exchanges
      .filter((e) => tabOf(e) === tab)
      .filter((e) => side === 'all' || roleOf(e, me) === side)
      .filter((e) => from === 'all' || e.agreement.listing_type === from)
      .filter((e) => turn === 'all' || turnOf(e, me) === turn)
      .sort((a, b) => (order === 'latest' ? 1 : -1) * (lastActivity(b) - lastActivity(a)))
  );

  function lastActivity(e: UIExchange): number {
    return Math.max(
      e.created_at,
      e.response?.created_at ?? 0,
      e.provider_done?.created_at ?? 0,
      e.receiver_done?.created_at ?? 0,
      e.provider_review?.created_at ?? 0,
      e.receiver_review?.created_at ?? 0,
      e.cancellation?.created_at ?? 0
    );
  }

  async function resolveLabels(list: UIExchange[]) {
    for (const e of list) {
      const other = b64(counterpartyOf(e, me));
      if (!(other in names)) {
        const user = await runEffect(usersStore.getUserByActionHash(counterpartyOf(e, me)));
        names[other] = user?.name ?? 'A member';
      }
      const listing = b64(e.agreement.listing);
      if (!(listing in titles)) {
        const item =
          e.agreement.listing_type === 'Offer'
            ? await runEffect(offersStore.getOffer(e.agreement.listing))
            : await runEffect(requestsStore.getRequest(e.agreement.listing));
        titles[listing] = item?.title ?? 'A listing';
      }
    }
  }

  $effect(() => {
    (async () => {
      try {
        await runEffect(useConnectionGuard());
        const list = await runEffect(exchangesStore.loadMyExchanges());
        const first = (['proposals', 'active', 'completed'] as ExchangeTab[]).find((t) =>
          list.some((e) => tabOf(e) === t && awaitingMe(e, me))
        );
        if (first) tab = first;
        ready = true;
        await resolveLabels(list);
      } catch (e) {
        loadError = e instanceof Error ? e.message : String(e);
      }
    })();
  });
</script>

<svelte:head>
  <title>My Exchanges</title>
</svelte:head>

<section class="container mx-auto space-y-6 p-4">
  <header class="space-y-1">
    <h1 class="h1">My Exchanges</h1>
    <p class="text-surface-500">Deals you're proposing, working through, and have completed</p>
  </header>

  <div class="grid gap-4 md:grid-cols-3" role="tablist" aria-label="Exchange groups">
    {#each TABS as t (t.key)}
      <button
        class="card space-y-2 p-4 text-left transition-colors hover:bg-surface-100 dark:hover:bg-surface-700 {tab === t.key ? `ring-2 ${t.ring}` : ''}"
        role="tab"
        aria-selected={tab === t.key}
        onclick={() => (tab = t.key)}
      >
        <div class="flex items-start justify-between">
          <span class="text-2xl">{t.icon}</span>
          <span class="text-3xl font-bold">{count(t.key)}</span>
        </div>
        <h2 class="h4">{t.label}</h2>
        <p class="text-sm text-surface-500">{t.blurb}</p>
        {#if mine(t.key) > 0}
          <span class="badge variant-filled-secondary">{mine(t.key)} your turn</span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="flex flex-wrap items-center gap-4 text-sm">
    <label class="flex items-center gap-2"><span class="text-surface-500">Side</span>
      <select class="select select-sm w-auto" bind:value={side}>
        <option value="all">All</option><option value="provider">I give</option><option value="receiver">I receive</option>
      </select></label>
    <label class="flex items-center gap-2"><span class="text-surface-500">From</span>
      <select class="select select-sm w-auto" bind:value={from}>
        <option value="all">All</option><option value="Offer">An offer</option><option value="Request">A request</option>
      </select></label>
    <label class="flex items-center gap-2"><span class="text-surface-500">Turn</span>
      <select class="select select-sm w-auto" bind:value={turn}>
        <option value="all">All</option><option value="you">Mine</option><option value="them">Theirs</option>
      </select></label>
    <label class="flex items-center gap-2"><span class="text-surface-500">Order</span>
      <select class="select select-sm w-auto" bind:value={order}>
        <option value="latest">Latest first</option><option value="oldest">Oldest first</option>
      </select></label>
  </div>

  {#if loadError}
    <div class="alert variant-filled-error">{loadError}</div>
  {:else if !ready}
    <p class="text-surface-500">Loading your exchanges...</p>
  {:else if shown.length === 0}
    <div class="card space-y-3 p-6 text-center">
      <p class="text-surface-500">{side === 'all' && from === 'all' && turn === 'all' ? `No ${tab} exchanges yet.` : `Nothing ${tab} matches those filters.`}</p>
      <a class="variant-filled-primary btn" href="/requests">Browse listings to start one</a>
    </div>
  {:else}
    <ul class="space-y-3">
      {#each shown as e (b64(e.agreement_hash))}
        {@const role = roleOf(e, me)}
        {@const other = names[b64(counterpartyOf(e, me))]}
        {@const give = role === 'provider' ? e.agreement.primary : e.agreement.reciprocal}
        {@const get = role === 'provider' ? e.agreement.reciprocal : e.agreement.primary}
        <li>
          <a
            class="card block space-y-3 p-4 transition-colors hover:bg-surface-100 dark:hover:bg-surface-700"
            href={`/exchanges/${b64(e.agreement_hash)}`}
          >
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="badge {exchangeStatusVariant(e.status)}">{statusLabel(e)}</span>
              {#if turnOf(e, me) === 'you'}<span class="badge variant-filled-secondary">Your turn</span>
              {:else if turnOf(e, me) === 'them'}<span class="badge variant-soft-surface">Waiting on {other ?? 'them'}</span>{/if}
              {#if e.agreement.medium}<span class="badge variant-soft-surface">{e.agreement.medium}</span>{/if}
              <span class="text-surface-500">{role === 'provider' ? 'You provide' : 'You receive'}</span>
              {#if e.status === 'Proposed' || e.status === 'Declined'}
                <span class="text-surface-500">Proposed by {wroteIt(e, me) ? 'you' : (other ?? '...')}</span>
              {/if}
              <span class="ml-auto text-xs text-surface-500">{formatWhen(lastActivity(e))}</span>
            </div>
            <h3 class="h4">{titles[b64(e.agreement.listing)] ?? '...'}</h3>
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span>You give {termLabel(give)}</span>
              <span class="text-surface-500">&#8646;</span>
              <span>{other ?? 'They'} {other ? 'gives' : 'give'} {termLabel(get)}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs text-white">
                {(other ?? '?')[0]}
              </span>
              <span>{other ?? '...'}</span>
              <span class="variant-filled-primary btn btn-sm ml-auto">{actionLabel(e, role)} &rarr;</span>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
