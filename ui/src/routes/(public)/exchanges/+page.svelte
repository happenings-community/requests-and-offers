<script lang="ts">
  import { useExchangesManagement } from '$lib/composables/domain/exchanges/useExchangesManagement.svelte';
  import { type ExchangeTab } from '$lib/utils/exchange-ui';
  import { groupChains, type GroupKey } from '$lib/utils/exchange-chains';
  import ExchangeChainCard from '$lib/components/exchanges/ExchangeChainCard.svelte';
  import ExchangeGroup from '$lib/components/exchanges/ExchangeGroup.svelte';

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
      ? (exchanges.nameOf(g.sample.latest) ?? 'A member')
      : groupBy === 'listing'
        ? (exchanges.titleOf(g.sample.latest) ?? 'A listing')
        : g.key;

  const tabWord = $derived(exchanges.tab === 'all' ? '' : exchanges.tab);

  $effect(() => {
    exchanges.initialize();
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

  <div class="grid gap-4 md:grid-cols-4" role="tablist" aria-label="Exchange groups">
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
      <a class="variant-filled-primary btn" href="/requests">Browse listings to start one</a>
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
          title={exchanges.titleOf(chain.latest) ?? 'A listing'}
          lastMoved={exchanges.lastActivity(chain.latest)}
        />
      {/each}
    </div>
  {/if}
</section>
