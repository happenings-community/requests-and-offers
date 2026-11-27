<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { paths } from '$lib/paths';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import type { UIExchange } from '$lib/types/ui';
  import type { Milestone } from '$lib/utils/messaging-threads';
  import { roleOf } from '$lib/utils/exchange-ui';

  type Props = {
    exchange: UIExchange;
    milestone: Milestone;
    /** The other person in this conversation. */
    name: string;
    /** The member reading, to say "You" for their own part. */
    me: ActionHash | undefined;
    /** The conversation this line is read in, carried so the exchange page offers the way back. */
    counterparty: ActionHash;
  };
  const { exchange, milestone, name, me, counterparty }: Props = $props();

  /**
   * One line for each thing that happened to the agreement after it was reached, in the
   * same shape as the agreement's own line, so the conversation reads as one story.
   */
  const text = $derived.by(() => {
    const mine = roleOf(exchange, me);
    switch (milestone) {
      case 'providerDone':
        return mine === 'provider' ? S.milestone.youDone : fill(S.milestone.theyDone, { name });
      case 'receiverDone':
        return mine === 'receiver' ? S.milestone.youDone : fill(S.milestone.theyDone, { name });
      case 'bothDone':
        return S.milestone.bothDone;
      case 'cancelled':
        return S.milestone.cancelled;
    }
  });
  const icon = $derived(milestone === 'cancelled' ? '✖️' : milestone === 'bothDone' ? '🎉' : '✅');
  const quiet = $derived(milestone === 'cancelled');
</script>

<div
  class="flex flex-wrap items-center gap-3 py-1"
  data-testid="milestone-line"
  data-milestone={milestone}
>
  <span class="{quiet ? 'bg-surface-400' : 'bg-success-500'} h-px flex-1"></span>
  <span
    class="text-sm font-semibold {quiet
      ? 'text-surface-600 dark:text-surface-300'
      : 'text-success-900 dark:text-success-300'}"
  >
    <span aria-hidden="true">{icon}</span>
    {text}
  </span>
  <a
    class="variant-ghost btn btn-sm"
    href={paths.exchangeDetail(exchange.agreement_hash, { from: counterparty })}
    >{S.milestone.open}</a
  >
  <span class="{quiet ? 'bg-surface-400' : 'bg-success-500'} h-px flex-1"></span>
</div>
