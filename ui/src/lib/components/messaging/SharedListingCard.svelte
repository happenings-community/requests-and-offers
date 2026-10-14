<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import ShowInterestButton from '$lib/components/messaging/ShowInterestButton.svelte';
  import type { ListingType } from '$lib/types/holochain';

  type Props = {
    listing: ActionHash;
    /** True when this agent shared it. */
    mine: boolean;
    name: string;
  };
  const { listing, mine, name }: Props = $props();

  let title = $state('A listing');
  let kind = $state<ListingType | null>(null);
  let author = $state<ActionHash | undefined>(undefined);

  /**
   * The card is drawn from the listing itself, never from the message.
   *
   * The body carries only the hash, so the title, type and author all come from the
   * published record. A shared card therefore cannot say something the listing does not.
   */
  $effect(() => {
    (async () => {
      // **The type comes from the record, before anything is read as a listing.** This
      // used to try `getOffer` and fall back to `getRequest`, and a read by hash does not
      // check the entry type, so a request answered the first call: every shared card
      // said Offer, and Show interest from one stored the Interest as an offer for a
      // request, which the propose page then read with no terms and offer labels.
      const type = await runEffect(offersStore.getListingType(listing));
      if (!type) return;
      kind = type;
      const found =
        type === 'Offer'
          ? await runEffect(offersStore.getOffer(listing))
          : await runEffect(requestsStore.getRequest(listing));
      if (found) {
        title = found.title;
        author = found.creator;
      }
    })();
  });

  const tint = $derived(
    kind === 'Offer'
      ? 'bg-warning-100 border-warning-400 dark:bg-warning-900/30'
      : 'bg-secondary-100 border-secondary-400 dark:bg-secondary-900/30'
  );
</script>

<article class="card border-2 p-4 {kind ? tint : ''}" data-testid="shared-listing-card">
  <p class="text-sm text-surface-600 dark:text-surface-300">
    {mine ? S.conversation.sharedByYou : fill(S.conversation.sharedByThem, { name })}
  </p>
  <div class="flex flex-wrap items-center gap-2 pt-1">
    {#if kind}
      <span
        class="badge {kind === 'Offer' ? 'variant-filled-warning' : 'variant-filled-secondary'}"
      >
        {kind === 'Offer' ? '💡 Offer' : '📝 Request'}
      </span>
    {/if}
    <span class="font-semibold">{title}</span>
  </div>
  <div class="flex flex-wrap gap-2 pt-3">
    {#if kind}
      <a
        class="variant-ghost btn btn-sm"
        href="/{kind === 'Offer' ? 'offers' : 'requests'}/{encodeHashToBase64(listing)}"
        >{S.card.interest.view}</a
      >
      <!-- Show interest hides itself for the author, so the sharer sees only View. -->
      <ShowInterestButton {listing} listingType={kind} {author} />
    {/if}
  </div>
</article>
