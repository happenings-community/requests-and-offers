<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import {
    roundChanges,
    roundOutcome,
    termsInBrief,
    type ExchangeChain,
    type RoundChange,
    type RoundOutcome
  } from '$lib/utils/exchange-chains';
  import { formatWhen, statusLabel, turnOf, wroteIt } from '$lib/utils/exchange-ui';
  import type { UIExchange } from '$lib/types/ui';

  /**
   * One negotiation (#333): collapsed to its latest round, opening to every
   * round, newest first, with what each changed and how it ended.
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

  const latest = $derived(chain.latest);
  const turn = $derived(turnOf(latest, me));
  const state = $derived(
    turn === 'you'
      ? 'Waiting on you'
      : turn === 'them'
        ? `Waiting on ${otherName}`
        : statusLabel(latest)
  );
  const newestFirst = $derived([...chain.rounds].reverse());

  const href = (e: UIExchange) => `/exchanges/${encodeHashToBase64(e.agreement_hash)}`;
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

<details class="card p-4" data-testid="exchange-chain">
  <summary class="cursor-pointer list-none space-y-1">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-semibold">{title}</span>
      {#if chain.rounds.length > 1}
        <span class="variant-soft-tertiary badge">Counter-proposal</span>
      {/if}
      <span class="badge {turn === 'you' ? 'variant-filled-secondary' : 'variant-soft-surface'}"
        >{state}</span
      >
    </div>
    <p class="text-sm">{termsInBrief(latest)}</p>
    <p class="text-xs text-surface-500">
      Round {chain.rounds.length} &middot; {formatWhen(lastMoved)}
    </p>
  </summary>

  <ol class="mt-3 space-y-3 border-t border-surface-300 pt-3 dark:border-surface-600">
    {#each newestFirst as round, i (encodeHashToBase64(round.agreement_hash))}
      {@const position = chain.rounds.length - i}
      {@const previous = chain.rounds[position - 2]}
      {@const next = chain.rounds[position]}
      {@const changes = roundChanges(previous, round)}
      <li class="space-y-1 text-sm">
        <p>
          <span class="font-semibold">Round {position}</span>
          <span class="text-surface-500">
            &middot; proposed by {by(round)} &middot; {formatWhen(round.created_at)}</span
          >
        </p>
        {#if changes.length > 0}
          <ul class="text-surface-600 dark:text-surface-300">
            {#each changes as c (c.field)}
              <li>{FIELD[c.field]}: {c.from} &rarr; <span class="font-semibold">{c.to}</span></li>
            {/each}
          </ul>
        {:else}
          <p>{termsInBrief(round)}</p>
        {/if}
        <p class="flex flex-wrap items-center gap-2">
          <span class="variant-soft-surface badge"
            >{outcomeText(round, roundOutcome(round, !!next), next)}</span
          >
          <a class="anchor text-xs" href={href(round)}>Open this round</a>
        </p>
      </li>
    {/each}
    {#if chain.missingEarlier}
      <li class="text-sm text-surface-500" data-testid="missing-earlier">
        Earlier rounds haven't arrived yet. They'll appear once they sync.
      </li>
    {/if}
  </ol>
</details>
