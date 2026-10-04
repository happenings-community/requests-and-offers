<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import { termLabel, wroteIt } from '$lib/utils/exchange-ui';
  import type { UIExchange } from '$lib/types/ui';

  type Props = {
    exchange: UIExchange;
    name: string;
    me: ActionHash | undefined;
    onRespond: (agreement: ActionHash, accepted: boolean, note: string) => Promise<void>;
  };
  const { exchange, name, me, onRespond }: Props = $props();

  const fromMe = $derived(wroteIt(exchange, me));
  const initial = $derived(name.trim().charAt(0).toUpperCase() || '?');
  const answered = $derived(exchange.response !== undefined);
  const accepted = $derived(exchange.response?.accepted === true);

  const status = $derived(
    answered
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
      class="bg-primary-100 text-primary-800 flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold"
      >{fromMe ? '\u{1F464}' : initial}</span
    >
    <span class="font-semibold"
      >{fromMe ? S.proposal.fromYou : fill(S.proposal.fromThem, { name })}</span
    >
    <span class="badge {answered ? (accepted ? 'variant-filled-success' : 'variant-soft-error') : 'variant-soft-primary'}"
      >{status}</span
    >
    {#if when}<span class="text-surface-500 ml-auto text-sm">{fill(S.proposal.sent, { date: when })}</span>{/if}
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
    <p class="text-surface-600 dark:text-surface-300 pt-3 text-sm">
      <span class="font-semibold"
        >{fromMe ? fill(S.proposal.declinedReason.theirs, { name }) : S.proposal.declinedReason.yours}</span
      >
      {exchange.response.note}
    </p>
    <p class="text-surface-500 pt-1 text-sm">{S.proposal.hint}</p>
  {/if}

  {#if !answered && !fromMe}
    {#if declining}
      <div class="flex flex-col gap-2 pt-3">
        <label class="text-sm font-semibold" for="decline-reason">{S.proposal.declineForm.label}</label>
        <textarea
          id="decline-reason"
          class="textarea"
          rows="3"
          bind:value={reason}
          placeholder={fill(S.proposal.declineForm.placeholder, { name })}
        ></textarea>
        {#if !reasonGiven}
          <p class="text-surface-500 text-sm">{fill(S.proposal.declineForm.required, { name })}</p>
        {/if}
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-sm variant-filled-error"
            disabled={!reasonGiven || busy}
            onclick={() => answer(false)}
          >
            {S.proposal.declineForm.confirm}
          </button>
          <button type="button" class="btn btn-sm variant-ghost" onclick={() => (declining = false)}>
            {S.proposal.declineForm.cancel}
          </button>
        </div>
      </div>
    {:else}
      <div class="flex flex-wrap gap-2 pt-3">
        <button
          type="button"
          class="btn btn-sm variant-filled-success"
          disabled={busy}
          onclick={() => answer(true)}>{S.proposal.accept}</button
        >
        <button type="button" class="btn btn-sm variant-ghost" onclick={() => (declining = true)}
          >{S.proposal.decline}</button
        >
      </div>
    {/if}
  {/if}
</article>
