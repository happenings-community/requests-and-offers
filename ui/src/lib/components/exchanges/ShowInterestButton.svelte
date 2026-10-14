<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { reasonOf } from '$lib/utils/error-shape';
  import { EXCHANGE_STRINGS as S } from '$lib/strings/exchanges.strings';
  import ReachPerson from './ReachPerson.svelte';
  import type { ListingType } from '$lib/types/holochain';

  type Props = {
    listing: ActionHash;
    listingType: ListingType;
    /** The listing author's `User`. The conversation opens with them. */
    author: ActionHash | undefined;
  };
  const { listing, listingType, author }: Props = $props();

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const mine = $derived(!!me && !!author && encodeHashToBase64(author) === encodeHashToBase64(me));

  let already = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  /**
   * Whether this member has already shown interest in this listing.
   *
   * Read once on mount rather than assumed from a local flag, so the button tells the
   * truth after a reload or on a second device.
   */
  $effect(() => {
    (async () => {
      const mine = await runEffect(exchangesStore.getMyInterests());
      already = (mine ?? []).some(
        (i) => encodeHashToBase64(i.listing) === encodeHashToBase64(listing)
      );
    })();
  });

  /**
   * Showing interest records it, and the member stays where they are.
   *
   * There is nothing yet to go to: no exchange exists until somebody proposes, and what
   * they are reading is the listing. Being carried into a conversation took them away from
   * it mid-thought, and on a network built without messaging there would be nowhere to
   * carry them. What changes on the page is the thing they just did: the button becomes
   * the state, with the way to reach the other person beside it.
   */
  async function show() {
    if (busy || mine || !author) return;
    busy = true;
    error = null;
    try {
      await runEffect(exchangesStore.createInterest(listing, listingType));
      already = true;
    } catch (e) {
      error = reasonOf(e);
    } finally {
      busy = false;
    }
  }
</script>

{#if !mine && author}
  <div class="flex flex-wrap items-center gap-2">
    {#if already}
      <span class="variant-soft-success badge">{S.listing.interestShown}</span>
      <ReachPerson person={author} listingType={listingType === 'Offer' ? 'offer' : 'request'} />
    {:else}
      <button
        type="button"
        class="variant-filled-primary btn btn-sm"
        disabled={busy}
        onclick={show}
        data-testid="show-interest"
      >
        {S.listing.showInterest}
      </button>
    {/if}
  </div>
  {#if error}
    <p class="text-sm text-error-700 dark:text-error-300" role="alert">{error}</p>
  {/if}
{/if}
