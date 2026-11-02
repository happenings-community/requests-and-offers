<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import ExchangeChainCard from './ExchangeChainCard.svelte';
  import type { ChainGroup } from '$lib/utils/exchange-chains';
  import { formatWhen } from '$lib/utils/exchange-ui';
  import type { UIExchange } from '$lib/types/ui';

  /**
   * One group of negotiations (#333): by person, listing, service type or
   * medium. Collapsed to its label, how many negotiations, and when anything
   * last moved. `nameOf` names the other person on each card, which differs
   * from card to card unless the grouping is by person.
   */
  let {
    group,
    me,
    label,
    initial = false,
    nameOf,
    pictureOf,
    titleOf,
    lastActivity
  }: {
    group: ChainGroup;
    me: ActionHash | undefined;
    label: string;
    /** Show the person's picture before the label: when grouped by person. */
    initial?: boolean;
    nameOf: (e: UIExchange) => string | undefined;
    pictureOf: (e: UIExchange) => string;
    titleOf: (e: UIExchange) => string | undefined;
    lastActivity: (e: UIExchange) => number;
  } = $props();

  let open = $state(false);
</script>

<details class="card variant-soft-surface p-4" data-testid="exchange-group" bind:open>
  <summary class="flex cursor-pointer list-none flex-wrap items-center gap-2">
    {#if initial}
      <img
        src={pictureOf(group.sample.latest)}
        alt=""
        class="h-7 w-7 rounded-full bg-surface-200 object-cover"
      />
    {/if}
    <span class="font-semibold">{label}</span>
    <span class="text-sm text-surface-500">
      {group.chains.length}
      {group.chains.length === 1 ? 'exchange' : 'exchanges'} &middot; {formatWhen(
        group.lastActivity
      )}
    </span>
    {#if group.waitingOnMe && !open}
      <span class="variant-filled-secondary badge">Your turn</span>
    {/if}
  </summary>
  <div class="mt-3 space-y-3">
    {#each group.chains as chain (chain.key)}
      <ExchangeChainCard
        {chain}
        {me}
        otherName={nameOf(chain.latest) ?? 'them'}
        otherPicture={pictureOf(chain.latest)}
        title={titleOf(chain.latest) ?? 'A listing'}
        lastMoved={lastActivity(chain.latest)}
      />
    {/each}
  </div>
</details>
