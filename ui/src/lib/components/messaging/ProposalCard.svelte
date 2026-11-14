<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import { paths } from '$lib/paths';
  import { termLabel, wroteIt } from '$lib/utils/exchange-ui';
  import { proposalOutcome } from '$lib/utils/messaging-threads';
  import type { UIExchange } from '$lib/types/ui';

  type Props = {
    exchange: UIExchange;
    name: string;
    me: ActionHash | undefined;
    onRespond: (agreement: ActionHash, accepted: boolean, note: string) => Promise<void>;
    /** The proposer's one move while the other person has not answered. */
    onWithdraw: (agreement: ActionHash) => Promise<void>;
  };
  const { exchange, name, me, onRespond, onWithdraw }: Props = $props();

  const fromMe = $derived(wroteIt(exchange, me));
  const initial = $derived(name.trim().charAt(0).toUpperCase() || '?');
  const answered = $derived(exchange.response !== undefined);
  const accepted = $derived(exchange.response?.accepted === true);
  /**
   * Withdrawn, declined, or still open.
   *
   * A withdrawal and a decline are different acts, so the card says which rather than
   * leaving the member to guess from a greyed-out button.
   */
  const outcome = $derived(proposalOutcome(exchange));

  const status = $derived(
    outcome === 'withdrawn'
      ? S.proposal.status.withdrawn
      : answered
        ? accepted
          ? S.proposal.status.accepted
          : S.proposal.status.declined
        : fromMe
          ? fill(S.proposal.status.waitingForThem, { name })
          : S.proposal.status.waitingForYou
  );

  const when = $derived(
    exchange.created_at
      ? new Date(exchange.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      : ''
  );

  /** Open only while a decline is being written. Inline, not a modal, as the mock has it. */
  let declining = $state(false);
  let reason = $state('');
  let busy = $state(false);

  /**
   * **A decline cannot be sent without a reason.** Disabled rather than silently ignored,
   * and the hint says why: the other person needs to know what to change. Trimmed, so
   * whitespace is not a way past it.
   */
  const reasonGiven = $derived(reason.trim().length > 0);

  /** One id per card: two proposals in a conversation are two forms. */
  const declineReasonId = $derived(`decline-reason-${encodeHashToBase64(exchange.agreement_hash)}`);

  /**
   * Withdrawing is the proposer's side of the same card (Sam, 9 November). Before this,
   * a proposer who had sent from the conversation had no way back from it short of My
   * Exchanges: the card showed "Waiting for them" and nothing to press.
   */
  async function withdraw() {
    if (busy) return;
    busy = true;
    try {
      await onWithdraw(exchange.agreement_hash);
    } finally {
      busy = false;
    }
  }

  async function answer(isAccept: boolean) {
    if (busy) return;
    if (!isAccept && !reasonGiven) return;
    busy = true;
    try {
      await onRespond(exchange.agreement_hash, isAccept, isAccept ? '' : reason.trim());
      declining = false;
      reason = '';
    } finally {
      busy = false;
    }
  }
</script>

<article class="card w-full p-4" data-testid="proposal-card">
  <header class="flex flex-wrap items-center gap-2">
    <span
      aria-hidden="true"
      class="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800"
      >{fromMe ? '\u{1F464}' : initial}</span
    >
    <span class="font-semibold"
      >{fromMe ? S.proposal.fromYou : fill(S.proposal.fromThem, { name })}</span
    >
    <span
      class="badge {outcome === 'withdrawn'
        ? 'variant-soft-surface'
        : answered
          ? accepted
            ? 'variant-filled-success'
            : 'variant-soft-error'
          : 'variant-soft-primary'}">{status}</span
    >
    {#if when}<span class="ml-auto text-sm text-surface-500"
        >{fill(S.proposal.sent, { date: when })}</span
      >{/if}
  </header>

  <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 pt-3 text-sm">
    <dt class="text-surface-500">{S.proposal.field.what}</dt>
    <dd>{termLabel(exchange.agreement.primary)}</dd>
    <dt class="text-surface-500">{S.proposal.field.inReturn}</dt>
    <dd>{termLabel(exchange.agreement.reciprocal)}</dd>
    {#if exchange.agreement.delivery_timeframe}
      <dt class="text-surface-500">{S.proposal.field.when}</dt>
      <dd>{exchange.agreement.delivery_timeframe}</dd>
    {/if}
    {#if exchange.agreement.terms}
      <dt class="text-surface-500">{S.proposal.field.note}</dt>
      <dd>{exchange.agreement.terms}</dd>
    {/if}
  </dl>

  {#if answered && !accepted && exchange.response?.note}
    <p class="pt-3 text-sm text-surface-600 dark:text-surface-300">
      <span class="font-semibold"
        >{fromMe
          ? fill(S.proposal.declinedReason.theirs, { name })
          : S.proposal.declinedReason.yours}</span
      >
      {exchange.response.note}
    </p>
    <p class="pt-1 text-sm text-surface-500">{S.proposal.hint}</p>
  {/if}

  {#if !answered && fromMe && outcome !== 'withdrawn'}
    <div class="flex flex-wrap gap-2 pt-3">
      <button
        type="button"
        class="variant-ghost btn btn-sm"
        disabled={busy}
        onclick={withdraw}
        data-testid="proposal-withdraw">{S.proposal.withdraw}</button
      >
    </div>
  {/if}

  {#if !answered && !fromMe && outcome !== 'withdrawn'}
    {#if declining}
      <div class="flex flex-col gap-2 pt-3">
        <label class="text-sm font-semibold" for={declineReasonId}
          >{S.proposal.declineForm.label}</label
        >
        <textarea
          id={declineReasonId}
          class="textarea"
          rows="3"
          bind:value={reason}
          placeholder={fill(S.proposal.declineForm.placeholder, { name })}
        ></textarea>
        {#if !reasonGiven}
          <p class="text-sm text-surface-500">{fill(S.proposal.declineForm.required, { name })}</p>
        {/if}
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="variant-filled-error btn btn-sm"
            disabled={!reasonGiven || busy}
            onclick={() => answer(false)}
          >
            {S.proposal.declineForm.confirm}
          </button>
          <button
            type="button"
            class="variant-ghost btn btn-sm"
            onclick={() => (declining = false)}
          >
            {S.proposal.declineForm.cancel}
          </button>
        </div>
      </div>
    {:else}
      <!--
        The receiver's three moves, as on the exchange page (Sam, 9 November). Counter is
        a link to the counter page, which lands on the new proposal's page when sent.
      -->
      <div class="flex flex-wrap gap-2 pt-3">
        <button
          type="button"
          class="variant-filled-success btn btn-sm"
          disabled={busy}
          onclick={() => answer(true)}>{S.proposal.accept}</button
        >
        <a
          class="variant-filled-secondary btn btn-sm"
          href={paths.exchangeCounter(exchange.agreement_hash)}
          data-testid="proposal-counter">{S.proposal.counter}</a
        >
        <button type="button" class="variant-ghost btn btn-sm" onclick={() => (declining = true)}
          >{S.proposal.decline}</button
        >
      </div>
    {/if}
  {/if}
</article>
