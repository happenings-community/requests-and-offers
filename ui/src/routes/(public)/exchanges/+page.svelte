<script lang="ts">
  import { useExchangesManagement } from '$lib/composables/domain/exchanges/useExchangesManagement.svelte';
  import { type ExchangeTab } from '$lib/utils/exchange-ui';
  import { groupChains, type GroupKey } from '$lib/utils/exchange-chains';
  import ExchangeChainCard from '$lib/components/exchanges/ExchangeChainCard.svelte';
  import ExchangeGroup from '$lib/components/exchanges/ExchangeGroup.svelte';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import InterestedIn from '$lib/components/exchanges/InterestedIn.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { EXCHANGE_STRINGS as S, fill } from '$lib/strings/exchanges.strings';
  import { paths } from '$lib/paths';
  import { COMMON_STRINGS as C } from '$lib/strings/common.strings';

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
    },
    {
      key: 'all',
      label: 'All',
      icon: '\u{1F4D2}',
      blurb: 'Every exchange, including declined, withdrawn and cancelled.',
      ring: 'ring-surface-500'
    }
  ];

  const exchanges = useExchangesManagement();
  const me = $derived(exchanges.me);

  let view = $state<'exchanges' | 'interested'>('exchanges');

  /**
   * The two views as tabs a keyboard can work: arrows, Home and End move between them, and
   * only the selected one is in the tab order, as WAI-ARIA's tabs pattern asks.
   */
  const VIEWS = ['exchanges', 'interested'] as const;
  function onTabKey(event: KeyboardEvent) {
    const at = VIEWS.indexOf(view);
    const next =
      event.key === 'ArrowRight'
        ? VIEWS[(at + 1) % VIEWS.length]
        : event.key === 'ArrowLeft'
          ? VIEWS[(at - 1 + VIEWS.length) % VIEWS.length]
          : event.key === 'Home'
            ? VIEWS[0]
            : event.key === 'End'
              ? VIEWS[VIEWS.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    view = next;
    document.getElementById(`view-tab-${next}`)?.focus();
  }
  /** How many listings I am interested in; `null` until read, and again if the read fails. */
  let interestCount = $state<number | null>(null);

  /** A confident 0 is a claim; an unread or failed count shows the tab without one. */
  async function countInterests(): Promise<void> {
    try {
      const mine = await runEffect(exchangesStore.getMyInterests());
      interestCount = mine?.length ?? 0;
    } catch {
      interestCount = null;
    }
  }

  $effect(() => {
    void countInterests();
  });

  /**
   * Negotiations (#333), grouped as the member chooses. The cards and filters
   * choose which negotiations show, by their latest proposal; the grouping
   * then arranges them. None lists them in order, ungrouped.
   */
  let groupBy = $state<GroupKey | 'none'>('person');
  const visible = $derived(exchanges.shownChains);
  const groups = $derived.by(() => {
    if (groupBy === 'none') return [];
    const list = groupChains(visible, groupBy, me, exchanges.lastActivity);
    return exchanges.order === 'oldest' ? list.reverse() : list;
  });
  const groupLabel = (g: (typeof groups)[number]) =>
    groupBy === 'person'
      ? (exchanges.nameOf(g.sample.latest) ?? C.someone)
      : groupBy === 'listing'
        ? (exchanges.titleOf(g.sample.latest) ?? C.something)
        : g.key;

  const tabWord = $derived(exchanges.tab === 'all' ? '' : exchanges.tab);

  $effect(() => {
    exchanges.initialize();
    // Nothing of messaging is loaded here any more (H4): the count rides inside whatever
    // the layout plugged in, which also owns the poll that keeps it fresh.
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
    The outer switch, above the exchange groups. Interested in is a different kind of
    thing from an exchange, not another group of them: a listing you are watching has no
    agreement and no turn. Keeping it at this level is what stops it being filtered by
    controls that mean nothing for it.
  -->
  <div
    class="flex flex-wrap gap-2"
    role="tablist"
    aria-label="View"
    tabindex="-1"
    onkeydown={onTabKey}
  >
    <button
      type="button"
      id="view-tab-exchanges"
      class="btn btn-sm {view === 'exchanges' ? 'variant-filled-primary' : 'variant-ghost'}"
      role="tab"
      aria-selected={view === 'exchanges'}
      aria-controls="view-panel"
      tabindex={view === 'exchanges' ? 0 : -1}
      onclick={() => (view = 'exchanges')}
    >
      {fill(S.exchanges.tab.exchanges, { count: exchanges.countIn('all') })}
    </button>
    <button
      type="button"
      id="view-tab-interested"
      class="btn btn-sm {view === 'interested' ? 'variant-filled-primary' : 'variant-ghost'}"
      role="tab"
      aria-selected={view === 'interested'}
      aria-controls="view-panel"
      tabindex={view === 'interested' ? 0 : -1}
      onclick={() => (view = 'interested')}
      data-testid="interested-tab"
    >
      {interestCount === null
        ? S.exchanges.tab.interestedUncounted
        : fill(S.exchanges.tab.interested, { count: interestCount })}
    </button>
  </div>

  <div id="view-panel" role="tabpanel" aria-labelledby="view-tab-{view}" class="space-y-6">
    {#if view === 'interested'}
      <!-- A withdrawal inside the tab changes the count above it. -->
      <InterestedIn onchange={countInterests} />
    {:else}
      <!--
      Filters over the one list below, so toggle buttons rather than tabs: there is no panel
      of their own for each to control.
      -->
      <div class="grid gap-4 md:grid-cols-4" role="group" aria-label="Exchange groups">
        {#each TABS as t (t.key)}
          <button
            class="card space-y-2 p-4 text-left transition-colors hover:bg-surface-100 dark:hover:bg-surface-700 {exchanges.tab ===
            t.key
              ? `ring-2 ${t.ring}`
              : ''}"
            type="button"
            aria-pressed={exchanges.tab === t.key}
            onclick={() => (exchanges.tab = t.key)}
          >
            <div class="flex items-start justify-between">
              <span class="text-2xl">{t.icon}</span>
              <span class="text-3xl font-bold">{exchanges.countIn(t.key)}</span>
            </div>
            <h2 class="h4">{t.label}</h2>
            <p class="text-sm text-surface-500">{t.blurb}</p>
            <!--
            No attention number here (Sam, 4 October). The same events are already counted
            once as unopened conversations, and a second number over them made one proposal
            look like two things to deal with. The rows say "Your turn" instead.
          -->
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
        <label class="flex items-center gap-2"
          ><span class="text-surface-500">Group by</span>
          <select class="select-sm select w-auto" bind:value={groupBy} data-testid="group-by">
            <option value="person">Person</option>
            <option value="listing">Listing</option>
            <option value="service">Service type</option>
            <option value="medium">Medium of exchange</option>
            <option value="none">None</option>
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
              ? `Nothing ${tabWord} matches those filters.`
              : `No ${tabWord} exchanges yet.`}
          </p>
          <a class="variant-filled-primary btn" href={paths.requests()}
            >Browse listings to start one</a
          >
        </div>
      {:else if groupBy !== 'none'}
        <div class="space-y-3">
          {#each groups as group (group.key)}
            <ExchangeGroup
              {group}
              {me}
              label={groupLabel(group)}
              initial={groupBy === 'person'}
              nameOf={exchanges.nameOf}
              pictureOf={exchanges.pictureOf}
              titleOf={exchanges.titleOf}
              lastActivity={exchanges.lastActivity}
            />
          {/each}
        </div>
      {:else}
        <div class="space-y-3">
          {#each visible as chain (chain.key)}
            <ExchangeChainCard
              {chain}
              {me}
              otherName={exchanges.nameOf(chain.latest) ?? 'them'}
              otherPicture={exchanges.pictureOf(chain.latest)}
              title={exchanges.titleOf(chain.latest) ?? C.something}
              lastMoved={exchanges.lastActivity(chain.latest)}
            />
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</section>
