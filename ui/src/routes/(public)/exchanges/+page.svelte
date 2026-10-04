<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import { useExchangesManagement } from '$lib/composables/domain/exchanges/useExchangesManagement.svelte';
  import messagingStore from '$lib/stores/messaging.store.svelte';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import InterestedIn from '$lib/components/messaging/InterestedIn.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { threadKeyOf } from '$lib/utils/messaging-threads';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import type { UIExchange } from '$lib/types/ui';
  import {
    actionLabel,
    counterpartyOf,
    exchangeStatusVariant,
    formatWhen,
    roleOf,
    statusLabel,
    termLabel,
    turnOf,
    wroteIt,
    type ExchangeTab
  } from '$lib/utils/exchange-ui';

  const TABS: { key: ExchangeTab; label: string; icon: string; blurb: string; ring: string }[] = [
    {
      key: 'proposals',
      label: 'Proposals',
      icon: '\u{1F4E8}',
      blurb: 'Sent to you or by you, waiting on an answer.',
      ring: 'ring-secondary-500'
    },
    {
      key: 'active',
      label: 'Active',
      icon: '\u{1F504}',
      blurb: 'Agreements under way, until both parts are done.',
      ring: 'ring-primary-500'
    },
    {
      key: 'completed',
      label: 'Completed',
      icon: '\u{1F389}',
      blurb: 'Both parts done; reviews to leave or already given.',
      ring: 'ring-success-500'
    }
  ];

  const exchanges = useExchangesManagement();

  let view = $state<'exchanges' | 'interested'>('exchanges');
  let interestCount = $state(0);

  $effect(() => {
    (async () => {
      const mine = await runEffect(exchangesStore.getMyInterests());
      interestCount = mine?.length ?? 0;
    })();
  });

  /**
   * The unread count beside Go to chat comes from the messaging store, because it is the
   * same count the Messages list shows. Reading it from anywhere else would let the two
   * disagree about the same conversation.
   */
  const chatHref = (e: UIExchange) => {
    const other = counterpartyOf(e, me);
    return other ? `/messages/${encodeHashToBase64(other)}` : '/messages';
  };

  const unreadWith = (e: UIExchange) => {
    const other = counterpartyOf(e, me);
    if (!other) return 0;
    return messagingStore.threads.find((t) => t.key === threadKeyOf(other))?.unread ?? 0;
  };
  const b64 = encodeHashToBase64;
  const me = $derived(exchanges.me);

  $effect(() => {
    exchanges.initialize();
    // Loaded here too, for the unread counts. Cheap: the store keeps what it read.
    void runEffect(messagingStore.loadConversations());
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

  <!--
    The outer switch, above the three exchange groups. Interested in is a different kind
    of thing from an exchange, not a fourth group of them: a listing you are watching has
    no agreement and no turn. Keeping it at this level is what stops it being filtered by
    controls that mean nothing for it.
  -->
  <div class="flex flex-wrap gap-2" role="tablist" aria-label="View">
    <button
      type="button"
      class="btn btn-sm {view === 'exchanges' ? 'variant-filled-primary' : 'variant-ghost'}"
      role="tab"
      aria-selected={view === 'exchanges'}
      onclick={() => (view = 'exchanges')}
    >
      {fill(S.exchanges.tab.exchanges, {
        count: exchanges.countIn('proposals') + exchanges.countIn('active') + exchanges.countIn('completed')
      })}
    </button>
    <button
      type="button"
      class="btn btn-sm {view === 'interested' ? 'variant-filled-primary' : 'variant-ghost'}"
      role="tab"
      aria-selected={view === 'interested'}
      onclick={() => (view = 'interested')}
      data-testid="interested-tab"
    >
      {fill(S.exchanges.tab.interested, { count: interestCount })}
    </button>
  </div>

  {#if view === 'interested'}
    <InterestedIn />
  {:else}
  <div class="grid gap-4 md:grid-cols-3" role="tablist" aria-label="Exchange groups">
    {#each TABS as t (t.key)}
      <button
        class="card space-y-2 p-4 text-left transition-colors hover:bg-surface-100 dark:hover:bg-surface-700 {exchanges.tab ===
        t.key
          ? `ring-2 ${t.ring}`
          : ''}"
        role="tab"
        aria-selected={exchanges.tab === t.key}
        onclick={() => (exchanges.tab = t.key)}
      >
        <div class="flex items-start justify-between">
          <span class="text-2xl">{t.icon}</span>
          <span class="text-3xl font-bold">{exchanges.countIn(t.key)}</span>
        </div>
        <h2 class="h4">{t.label}</h2>
        <p class="text-sm text-surface-500">{t.blurb}</p>
        {#if exchanges.myTurnIn(t.key) > 0}
          <span class="variant-filled-secondary badge">{exchanges.myTurnIn(t.key)} your turn</span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="flex flex-wrap items-center gap-4 text-sm">
    <label class="flex items-center gap-2"
      ><span class="text-surface-500">Side</span>
      <select class="select-sm select w-auto" bind:value={exchanges.side}>
        <option value="all">All</option><option value="provider">I give</option><option
          value="receiver">I receive</option
        >
      </select></label
    >
    <label class="flex items-center gap-2"
      ><span class="text-surface-500">From</span>
      <select class="select-sm select w-auto" bind:value={exchanges.origin}>
        <option value="all">All</option><option value="Offer">An offer</option><option
          value="Request">A request</option
        >
      </select></label
    >
    <label class="flex items-center gap-2"
      ><span class="text-surface-500">Turn</span>
      <select class="select-sm select w-auto" bind:value={exchanges.turn}>
        <option value="all">All</option><option value="you">Mine</option><option value="them"
          >Theirs</option
        >
      </select></label
    >
    <label class="flex items-center gap-2"
      ><span class="text-surface-500">Order</span>
      <select class="select-sm select w-auto" bind:value={exchanges.order}>
        <option value="latest">Latest first</option><option value="oldest">Oldest first</option>
      </select></label
    >
  </div>

  {#if exchanges.error}
    <div class="alert variant-filled-error">{exchanges.error}</div>
  {:else if !exchanges.ready}
    <p class="text-surface-500">Loading your exchanges...</p>
  {:else if exchanges.shown.length === 0}
    <div class="card space-y-3 p-6 text-center">
      <p class="text-surface-500">
        {exchanges.filtered
          ? `Nothing ${exchanges.tab} matches those filters.`
          : `No ${exchanges.tab} exchanges yet.`}
      </p>
      <a class="variant-filled-primary btn" href="/requests">Browse listings to start one</a>
    </div>
  {:else}
    <ul class="space-y-3">
      {#each exchanges.shown as e (b64(e.agreement_hash))}
        {@const role = roleOf(e, me)}
        {@const other = exchanges.nameOf(e)}
        {@const give = role === 'provider' ? e.agreement.primary : e.agreement.reciprocal}
        {@const get = role === 'provider' ? e.agreement.reciprocal : e.agreement.primary}
        <li>
          <a
            class="card block space-y-3 p-4 transition-colors hover:bg-surface-100 dark:hover:bg-surface-700"
            href={`/exchanges/${b64(e.agreement_hash)}`}
          >
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="badge {exchangeStatusVariant(e.status)}">{statusLabel(e)}</span>
              {#if turnOf(e, me) === 'you'}<span class="variant-filled-secondary badge"
                  >Your turn</span
                >
              {:else if turnOf(e, me) === 'them'}<span class="variant-soft-surface badge"
                  >Waiting on {other ?? 'them'}</span
                >{/if}
              {#if e.agreement.medium}<span class="variant-soft-surface badge"
                  >{e.agreement.medium}</span
                >{/if}
              <span class="text-surface-500"
                >{role === 'provider' ? 'You provide' : 'You receive'}</span
              >
              {#if e.status === 'Proposed' || e.status === 'Declined'}
                <span class="text-surface-500"
                  >Proposed by {wroteIt(e, me) ? 'you' : (other ?? '...')}</span
                >
              {/if}
              <span class="ml-auto text-xs text-surface-500"
                >{formatWhen(exchanges.lastActivity(e))}</span
              >
            </div>
            <h3 class="h4">{exchanges.titleOf(e) ?? '...'}</h3>
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span>You give {termLabel(give)}</span>
              <span class="text-surface-500">&#8646;</span>
              <span>{other ?? 'They'} {other ? 'gives' : 'give'} {termLabel(get)}</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <span
                class="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-xs text-white"
              >
                {(other ?? '?')[0]}
              </span>
              <span>{other ?? '...'}</span>
              <span class="variant-filled-primary btn btn-sm ml-auto"
                >{actionLabel(e, role)} &rarr;</span
              >
            </div>
          </a>
          <!--
            Outside the card's anchor, not inside it: a link within a link is invalid and
            the browser picks one for you. Go to chat is a second destination, so it gets
            its own.
          -->
          <div class="flex flex-wrap items-center gap-2 px-4 pb-3">
            <a class="btn btn-sm variant-ghost" href={chatHref(e)}>{S.exchanges.goToChat}</a>
            {#if unreadWith(e) > 0}
              <span class="variant-filled-primary badge">{fill(S.hub.unread, { count: unreadWith(e) })}</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  {/if}
</section>
