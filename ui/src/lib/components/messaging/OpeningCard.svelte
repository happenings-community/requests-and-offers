<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import type { UIInterest } from '$lib/types/ui';

  type Props = {
    interest: UIInterest;
    name: string;
    /** True when I am the one who showed interest, false when they did. */
    mine: boolean;
    onWithdraw: (interest: ActionHash) => void;
  };
  const { interest, name, mine, onWithdraw }: Props = $props();

  const isOffer = $derived(interest.listing_type === 'Offer');

  /**
   * **Orange is Offers, gold is Requests, never swapped**, and orange is never used for
   * anything that is not an Offer. `warning` is the orange ramp and `secondary` the gold
   * one, with the 100 fill and 400 border the brief gives.
   */
  const tint = $derived(
    isOffer
      ? 'bg-warning-100 border-warning-400 dark:bg-warning-900/30'
      : 'bg-secondary-100 border-secondary-400 dark:bg-secondary-900/30'
  );

  const heading = $derived(
    mine
      ? fill(isOffer ? S.card.interest.youInOffer : S.card.interest.youInRequest, { name })
      : fill(isOffer ? S.card.interest.theyInYourOffer : S.card.interest.theyInYourRequest, { name })
  );

  const listingHref = $derived(
    `/${isOffer ? 'offers' : 'requests'}/${encodeHashToBase64(interest.listing)}`
  );
</script>

<article class="card border-2 p-4 {tint}" data-testid="opening-card">
  <div class="flex flex-wrap items-center gap-2">
    <span class="badge {isOffer ? 'variant-filled-warning' : 'variant-filled-secondary'}">
      {isOffer ? '\u{1F4A1} Offer' : '\u{1F4DD} Request'}
    </span>
    <span class="font-semibold">{heading}</span>
  </div>
  <div class="flex flex-wrap gap-2 pt-3">
    <a class="btn btn-sm variant-ghost" href={listingHref}>{S.card.interest.view}</a>
    {#if mine}
      <button
        type="button"
        class="btn btn-sm variant-ghost"
        onclick={() => onWithdraw(interest.interest_hash)}
      >
        {S.card.interest.withdraw}
      </button>
    {/if}
  </div>
</article>
