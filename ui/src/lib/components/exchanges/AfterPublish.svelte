<script lang="ts">
  import { page } from '$app/stores';
  import type { ActionHash } from '@holochain/client';
  import { EXCHANGE_STRINGS as S } from '$lib/strings/exchanges.strings';
  import { readOrigin, routeAfterPublish } from '$lib/paths';
  import { getShareListing } from '$lib/extensions/share-listing';

  /**
   * What a member is offered once a listing is published.
   *
   * **Two endings, because there are two ways in.** Published from inside a proposal, the
   * listing is a step in that proposal, so the way on is back to it with the new listing as
   * the reciprocal side. That ending is this page's own, and is always here.
   *
   * Published after leaving a conversation, the way on belongs to that conversation:
   * sending the listing to the person, or going back to them. So whatever provides
   * conversations supplies it, and a network built without them shows nothing here, which
   * is right — there is nobody to send it to and nowhere to go back to.
   */
  type Props = {
    /** The listing just published, which is what sharing sends. */
    listing: ActionHash | null;
  };
  const { listing }: Props = $props();

  const after = $derived(routeAfterPublish(readOrigin($page.url), listing));

  const plugged = getShareListing();
  const Share = $derived(plugged());
</script>

{#if after.kind === 'continueProposal'}
  <a class="variant-filled-primary btn" href={after.href} data-testid="continue-proposal">
    {S.listing.continueProposal}
  </a>
{:else if after.kind === 'shareWith' && Share}
  <Share {listing} counterparty={after.counterparty} conversation={after.conversation} />
{/if}
