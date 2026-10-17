<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import ExchangeCard from './ExchangeCard.svelte';
  import {
    roundChanges,
    roundOutcome,
    termsInBrief,
    type ExchangeChain,
    type RoundChange,
    type RoundOutcome
  } from '$lib/utils/exchange-chains';
  import { formatWhen, wroteIt } from '$lib/utils/exchange-ui';
  import type { UIExchange } from '$lib/types/ui';

  /**
   * One negotiation (#333): the exchange card for its latest proposal, with
   * the earlier proposals, newest first, opening below it in the same card.
   */
  let {
    chain,
    me,
    otherName,
    title,
    lastMoved
  }: {
    chain: ExchangeChain;
    me: ActionHash | undefined;
    otherName: string;
    title: string;
    lastMoved: number;
  } = $props();

  let open = $state(false);

  const latest = $derived(chain.latest);
  const count = $derived(chain.rounds.length);
  /** The first proposal has no chip; the first counter is "Counter-proposal". */
  const chip = $derived(
    count < 2 ? undefined : count === 2 ? 'Counter-proposal' : `Counter-proposal ${count - 1}`
  );
  /** Earlier proposals, newest first, each with the one it answers and the one answering it. */
  const earlier = $derived(
    chain.rounds
      .slice(0, -1)
      .map((round, i) => ({
        round,
        previous: chain.rounds[i - 1],
        next: chain.rounds[i + 1]
      }))
      .reverse()
  );
  const answersWithdrawn = (previous: UIExchange | undefined) =>
    !!previous && roundOutcome(previous, true) === 'withdrawn';

  const by = (e: UIExchange) => (wroteIt(e, me) ? 'you' : otherName);

  const FIELD: Record<RoundChange['field'], string> = {
    primary: 'Service',
    reciprocal: 'In return',
    timeframe: 'When'
  };

  function outcomeText(round: UIExchange, outcome: RoundOutcome, next: UIExchange | undefined) {
    switch (outcome) {
      case 'countered':
        return `Countered by ${next ? by(next) : otherName}`;
      case 'declined':
        return round.response?.note ? `Declined: ${round.response.note}` : 'Declined';
      case 'accepted':
        return 'Accepted';
      case 'withdrawn':
        return 'Withdrawn';
      case 'cancelled':
        return 'Cancelled';
      case 'completed':
        return 'Completed';
      case 'open':
        return 'Open';
    }
  }
</script>

<div class="card" data-testid="exchange-chain">
  <ExchangeCard
    exchange={latest}
    {me}
    other={otherName}
    {title}
    when={lastMoved}
    {chip}
    framed={false}
  />

  {#if earlier.length > 0 || chain.missingEarlier}
    <div class="space-y-3 border-t border-surface-300 px-4 py-3 text-sm dark:border-surface-600">
      {#if answersWithdrawn(chain.rounds[count - 2])}
        <p class="text-surface-500">Answers a proposal that was withdrawn.</p>
      {/if}
      {#if earlier.length === 0}
        <p class="text-surface-500" data-testid="missing-earlier">
          Earlier proposals haven't arrived yet. They'll appear once they sync.
        </p>
      {:else}
        <button
          type="button"
          class="anchor text-sm"
          aria-expanded={open}
          onclick={() => (open = !open)}
          data-testid="earlier-proposals"
        >
          {open ? 'Hide earlier proposals' : `Earlier proposals (${earlier.length})`}
        </button>

        {#if open}
          <ol class="space-y-3">
            {#each earlier as { round, previous, next } (encodeHashToBase64(round.agreement_hash))}
              {@const changes = roundChanges(previous, round)}
              <li class="space-y-1">
                <p>
                  <span class="font-semibold">Proposed by {by(round)}</span>
                  <span class="text-surface-500"> &middot; {formatWhen(round.created_at)}</span>
                </p>
                {#if answersWithdrawn(previous)}
                  <p class="text-surface-500">Answers a proposal that was withdrawn.</p>
                {/if}
                {#if changes.length > 0}
                  <ul class="text-surface-600 dark:text-surface-300">
                    {#each changes as c (c.field)}
                      <li>
                        {FIELD[c.field]}: {c.from} &rarr; <span class="font-semibold">{c.to}</span>
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p>{termsInBrief(round)}</p>
                {/if}
                <p class="flex flex-wrap items-center gap-2">
                  <span class="variant-soft-surface badge"
                    >{outcomeText(round, roundOutcome(round, !!next), next)}</span
                  >
                  <a
                    class="anchor text-xs"
                    href={`/exchanges/${encodeHashToBase64(round.agreement_hash)}`}>Open</a
                  >
                </p>
              </li>
            {/each}
            {#if chain.missingEarlier}
              <li class="text-surface-500" data-testid="missing-earlier">
                Earlier proposals haven't arrived yet. They'll appear once they sync.
              </li>
            {/if}
          </ol>
        {/if}
      {/if}
    </div>
  {/if}
</div>
