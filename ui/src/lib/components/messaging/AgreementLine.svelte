<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import type { UIExchange } from '$lib/types/ui';

  type Props = { exchange: UIExchange; name: string };
  const { exchange, name }: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-3 py-1" data-testid="agreement-line">
  <span class="bg-success-500 h-px flex-1"></span>
  <span class="text-success-700 dark:text-success-300 text-sm font-semibold">
    🤝 {fill(S.agreement.line, { name })}
  </span>
  <a class="btn btn-sm variant-ghost" href="/exchanges/{encodeHashToBase64(exchange.agreement_hash)}"
    >{S.agreement.open}</a
  >
  <span class="bg-success-500 h-px flex-1"></span>
</div>
