<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
  import {
    EXCHANGE_STATUS_LABEL,
    counterpartyOf,
    exchangeStatusVariant,
    formatWhen,
    roleOf,
    tabOf,
    termLabel,
    type ExchangeTab
  } from '$lib/utils/exchange-ui';
  import type { UIExchange } from '$lib/types/ui';

  const TABS: { key: ExchangeTab; label: string }[] = [
    { key: 'proposals', label: 'Proposals' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' }
  ];

  let tab = $state<ExchangeTab>('active');
  let names = $state<Record<string, string>>({});
  let titles = $state<Record<string, string>>({});
  let ready = $state(false);
  let loadError = $state<string | null>(null);

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const shown = $derived(
    exchangesStore.exchanges
      .filter((e) => tabOf(e.status) === tab)
      .sort((a, b) => b.created_at - a.created_at)
  );
  const counts = $derived({
    proposals: exchangesStore.exchanges.filter((e) => tabOf(e.status) === 'proposals').length,
    active: exchangesStore.exchanges.filter((e) => tabOf(e.status) === 'active').length,
    completed: exchangesStore.exchanges.filter((e) => tabOf(e.status) === 'completed').length
  });

  async function resolveLabels(list: UIExchange[]) {
    for (const e of list) {
      const other = encodeHashToBase64(counterpartyOf(e, me));
      if (!(other in names)) {
        const user = await runEffect(usersStore.getUserByActionHash(counterpartyOf(e, me)));
        names[other] = user?.name ?? 'A member';
      }
      const listing = encodeHashToBase64(e.agreement.listing);
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
        ready = true;
        await resolveLabels(list);
      } catch (e) {
        loadError = e instanceof Error ? e.message : String(e);
      }
    })();
  });
</script>

<svelte:head>
  <title>My exchanges</title>
</svelte:head>

<section class="container mx-auto space-y-6 p-4">
  <header class="space-y-1">
    <h1 class="h1">My exchanges</h1>
    <p class="text-surface-500">Agreements you are part of, and where each one has got to.</p>
  </header>

  <nav class="flex gap-2" aria-label="Exchange groups">
    {#each TABS as t (t.key)}
      <button
        class="btn btn-sm {tab === t.key ? 'variant-filled-primary' : 'variant-ghost-surface'}"
        onclick={() => (tab = t.key)}
        aria-pressed={tab === t.key}
      >
        {t.label}
        <span class="badge variant-soft ml-1">{counts[t.key]}</span>
      </button>
    {/each}
  </nav>

  {#if loadError}
    <div class="alert variant-filled-error">{loadError}</div>
  {:else if !ready}
    <p class="text-surface-500">Loading your exchanges...</p>
  {:else if shown.length === 0}
    <div class="card p-6 text-center text-surface-500">
      {#if tab === 'proposals'}
        Nothing proposed at the moment. Register interest in a listing to start one.
      {:else if tab === 'active'}
        No exchanges under way.
      {:else}
        Nothing completed yet.
      {/if}
    </div>
  {:else}
    <ul class="space-y-3">
      {#each shown as e (encodeHashToBase64(e.agreement_hash))}
        {@const role = roleOf(e, me)}
        <li>
          <a
            class="card block space-y-2 p-4 transition-colors hover:bg-surface-100 dark:hover:bg-surface-700"
            href={`/exchanges/${encodeHashToBase64(e.agreement_hash)}`}
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="h4">{titles[encodeHashToBase64(e.agreement.listing)] ?? '...'}</h3>
              <span class="badge {exchangeStatusVariant(e.status)}">
                {EXCHANGE_STATUS_LABEL[e.status]}
              </span>
            </div>
            <p class="text-sm">
              {role === 'provider' ? 'You provide' : 'You receive'}
              {termLabel(e.agreement.primary).toLowerCase()}
              with {names[encodeHashToBase64(counterpartyOf(e, me))] ?? '...'}
            </p>
            <p class="text-xs text-surface-500">{formatWhen(e.created_at)}</p>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
