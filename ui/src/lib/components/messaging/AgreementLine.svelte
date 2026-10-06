<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import type { UIExchange } from '$lib/types/ui';

  import { agreementCancelled } from '$lib/utils/messaging-threads';

  type Props = { exchange: UIExchange; name: string };
  const { exchange, name }: Props = $props();

  /**
   * An agreement cancelled afterwards keeps its line.
   *
   * It did happen, and saying so is the honest record; what changed is that it stopped,
   * which the mark says. Hiding the line would make the conversation read as though the
   * two of them had never agreed at all.
   */
  const cancelled = $derived(agreementCancelled(exchange));
</script>

<div class="flex flex-wrap items-center gap-3 py-1" data-testid="agreement-line">
  <span class="{cancelled ? 'bg-surface-400' : 'bg-success-500'} h-px flex-1"></span>
  <span
    class="text-sm font-semibold {cancelled
      ? 'text-surface-500'
      : 'text-success-700 dark:text-success-300'}"
  >
    🤝 {fill(S.agreement.line, { name })}
  </span>
  {#if cancelled}
    <span class="badge variant-soft-surface" data-testid="agreement-cancelled"
      >{S.agreement.cancelled}</span
    >
  {/if}
  <a class="btn btn-sm variant-ghost" href="/exchanges/{encodeHashToBase64(exchange.agreement_hash)}"
    >{S.agreement.open}</a
  >
  <span class="{cancelled ? 'bg-surface-400' : 'bg-success-500'} h-px flex-1"></span>
</div>
