<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import { reasonOf } from '$lib/utils/error-shape';
  // View listing and Withdraw interest are the exchange's actions; the card is a view of
  // the same record (R80), so it reads their wording from where it lives.
  import { EXCHANGE_STRINGS as E } from '$lib/strings/exchanges.strings';
  import ShowInterestButton from '$lib/components/exchanges/ShowInterestButton.svelte';
  import type { ListingType } from '$lib/types/holochain';
  import { COMMON_STRINGS as C } from '$lib/strings/common.strings';

  type Props = {
    listing: ActionHash;
    /** True when this agent shared it. */
    mine: boolean;
    name: string;
  };
  const { listing, mine, name }: Props = $props();

  let title = $state(C.something);
  let kind = $state<ListingType | null>(null);
  let author = $state<ActionHash | undefined>(undefined);
  /** The read failed, with its reason; or the listing is gone. Neither is "A listing". */
  let fault = $state<string | null>(null);
  let gone = $state(false);

  /**
   * The card is drawn from the listing itself, never from the message.
   *
   * The body carries only the hash, so the title, type and author all come from the
   * published record. A shared card therefore cannot say something the listing does not.
   */
  async function read(): Promise<void> {
    fault = null;
    gone = false;
    try {
      // **The type comes from the record, before anything is read as a listing.** This
      // used to try `getOffer` and fall back to `getRequest`, and a read by hash does not
      // check the entry type, so a request answered the first call: every shared card
      // said Offer, and Show interest from one stored the Interest as an offer for a
      // request, which the propose page then read with no terms and offer labels.
      const type = await runEffect(offersStore.getListingType(listing));
      if (!type) {
        gone = true;
        return;
      }
      kind = type;
      const found =
        type === 'Offer'
          ? await runEffect(offersStore.getOffer(listing))
          : await runEffect(requestsStore.getRequest(listing));
      if (!found) {
        gone = true;
        return;
      }
      title = found.title;
      author = found.creator;
    } catch (e) {
      // The placeholder is not an answer: say the read failed, and offer it again.
      fault = reasonOf(e);
    }
  }

  $effect(() => {
    void read();
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
  {#if fault}
    <div class="flex flex-wrap items-center gap-2 pt-1" role="alert">
      <span class="text-sm text-error-700 dark:text-error-300"
        >{fill(S.conversation.cardReadFailed, { reason: fault })}</span
      >
      <button type="button" class="variant-ghost btn btn-sm" onclick={read}>{C.tryAgain}</button>
    </div>
  {:else if gone}
    <p class="pt-1 text-sm text-surface-500">{S.conversation.cardGone}</p>
  {:else}
    <div class="flex flex-wrap items-center gap-2 pt-1">
      {#if kind}
        <span
          class="badge {kind === 'Offer' ? 'variant-filled-warning' : 'variant-filled-secondary'}"
        >
          {kind === 'Offer' ? C.listingType.offer : C.listingType.request}
        </span>
      {/if}
      <span class="font-semibold">{title}</span>
    </div>
  {/if}
  <div class="flex flex-wrap gap-2 pt-3">
    {#if kind}
      <a
        class="variant-ghost btn btn-sm"
        href="/{kind === 'Offer' ? 'offers' : 'requests'}/{encodeHashToBase64(listing)}"
        >{E.interest.view}</a
      >
      <!-- Show interest hides itself for the author, so the sharer sees only View. -->
      <ShowInterestButton {listing} listingType={kind} {author} />
    {/if}
  </div>
</article>
