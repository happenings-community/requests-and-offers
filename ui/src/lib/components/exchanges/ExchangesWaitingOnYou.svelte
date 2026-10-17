<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import { termsInBrief, type ExchangeChain } from '$lib/utils/exchange-chains';
  import type { UIExchange } from '$lib/types/ui';

  /**
   * The negotiations that need this member's move, above the groups, so nothing
   * waiting on them is buried inside a collapsed person (#333).
   */
  let {
    chains,
    nameOf,
    titleOf
  }: {
    chains: ExchangeChain[];
    nameOf: (e: UIExchange) => string | undefined;
    titleOf: (e: UIExchange) => string | undefined;
  } = $props();
</script>

{#if chains.length > 0}
  <section class="card variant-ghost-secondary space-y-2 p-4" data-testid="waiting-on-you">
    <h2 class="h4">Waiting on you</h2>
    <ul class="space-y-2">
      {#each chains as chain (chain.key)}
        <li>
          <a
            class="flex flex-wrap items-center gap-2 text-sm hover:underline"
            href={`/exchanges/${encodeHashToBase64(chain.latest.agreement_hash)}`}
          >
            <span class="font-semibold">{nameOf(chain.latest) ?? 'A member'}</span>
            <span>&middot; {titleOf(chain.latest) ?? 'A listing'}</span>
            {#if chain.rounds.length > 1}
              <span class="variant-soft-tertiary badge">Round {chain.rounds.length}</span>
            {/if}
            <span class="text-surface-500">{termsInBrief(chain.latest)}</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}
