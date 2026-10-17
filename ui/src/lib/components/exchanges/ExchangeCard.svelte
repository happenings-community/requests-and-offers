<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import {
    actionLabel,
    exchangeStatusVariant,
    formatWhen,
    roleOf,
    statusLabel,
    termLabel,
    turnOf,
    wroteIt
  } from '$lib/utils/exchange-ui';
  import type { UIExchange } from '$lib/types/ui';

  /**
   * One exchange as the design system's exchange card: status and turn chips,
   * the listing, what each side gives, and the next action. The whole card
   * links to the exchange. `framed` false drops the card frame, for a card
   * that sits inside another (a negotiation with earlier proposals).
   */
  let {
    exchange: e,
    me,
    other,
    title,
    when,
    chip,
    framed = true
  }: {
    exchange: UIExchange;
    me: ActionHash | undefined;
    other: string | undefined;
    title: string | undefined;
    when: number;
    /** An extra chip after the status, such as "Counter-proposal 2". */
    chip?: string;
    framed?: boolean;
  } = $props();

  const role = $derived(roleOf(e, me));
  const turn = $derived(turnOf(e, me));
  const give = $derived(role === 'provider' ? e.agreement.primary : e.agreement.reciprocal);
  const get = $derived(role === 'provider' ? e.agreement.reciprocal : e.agreement.primary);
</script>

<a
  class="{framed
    ? 'card'
    : 'rounded-container-token'} block space-y-3 p-4 transition-colors hover:bg-surface-100 dark:hover:bg-surface-700"
  href={`/exchanges/${encodeHashToBase64(e.agreement_hash)}`}
  data-testid="exchange-card"
>
  <div class="flex flex-wrap items-center gap-2 text-sm">
    <span class="badge {exchangeStatusVariant(e.status)}">{statusLabel(e)}</span>
    {#if chip}<span class="variant-soft-tertiary badge">{chip}</span>{/if}
    {#if turn === 'you'}<span class="variant-filled-secondary badge">Your turn</span>
    {:else if turn === 'them'}<span class="variant-soft-surface badge"
        >Waiting on {other ?? 'them'}</span
      >{/if}
    {#if e.agreement.medium}<span class="variant-soft-surface badge">{e.agreement.medium}</span
      >{/if}
    <span class="text-surface-500">{role === 'provider' ? 'You provide' : 'You receive'}</span>
    {#if e.status === 'Proposed' || e.status === 'Declined'}
      <span class="text-surface-500">Proposed by {wroteIt(e, me) ? 'you' : (other ?? '...')}</span>
    {/if}
    <span class="ml-auto text-xs text-surface-500">{formatWhen(when)}</span>
  </div>
  <h3 class="h4">{title ?? '...'}</h3>
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
    <span class="variant-filled-primary btn btn-sm ml-auto">{actionLabel(e, role)} &rarr;</span>
  </div>
</a>
