<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import ExchangeChainCard from './ExchangeChainCard.svelte';
  import type { PersonGroup } from '$lib/utils/exchange-chains';
  import { formatWhen } from '$lib/utils/exchange-ui';
  import type { UIExchange } from '$lib/types/ui';

  /**
   * Every negotiation with one person (#333), collapsed to their name, how many
   * negotiations, and when anything last moved.
   */
  let {
    group,
    me,
    name,
    titleOf,
    lastActivity
  }: {
    group: PersonGroup;
    me: ActionHash | undefined;
    name: string;
    titleOf: (e: UIExchange) => string | undefined;
    lastActivity: (e: UIExchange) => number;
  } = $props();
</script>

<details class="card variant-soft-surface p-4" data-testid="exchange-person">
  <summary class="flex cursor-pointer list-none flex-wrap items-center gap-2">
    <span
      class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500 text-sm text-white"
      >{name[0] ?? '?'}</span
    >
    <span class="font-semibold">{name}</span>
    <span class="text-sm text-surface-500">
      {group.chains.length}
      {group.chains.length === 1 ? 'negotiation' : 'negotiations'} &middot; {formatWhen(
        group.lastActivity
      )}
    </span>
    {#if group.waitingOnMe}
      <span class="variant-filled-secondary badge">Waiting on you</span>
    {/if}
  </summary>
  <div class="mt-3 space-y-3">
    {#each group.chains as chain (chain.key)}
      <ExchangeChainCard
        {chain}
        {me}
        otherName={name}
        title={titleOf(chain.latest) ?? 'A listing'}
        lastMoved={lastActivity(chain.latest)}
      />
    {/each}
  </div>
</details>
