<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { reasonOf } from '$lib/utils/error-shape';
  import { EXCHANGE_STRINGS as S, fill } from '$lib/strings/exchanges.strings';
  import { COMMON_STRINGS as C } from '$lib/strings/common.strings';
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

  /**
   * Whether this member has already shown interest in this listing: not read yet, could
   * not be read, no, or yes.
   *
   * **Four states, not a boolean.** With `false` until the read came back, the button
   * was enabled while the answer was unknown and stayed enabled when the read failed,
   * and one press in that window wrote a second Interest on the same listing: two
   * opening cards, two in the count, and Withdraw removing one. The zome does not
   * refuse a duplicate, so the button must not offer one.
   */
  let known = $state<'unknown' | 'failed' | 'no' | 'yes'>('unknown');
  let readError = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  /** Read from the record rather than a local flag, so a reload or a second device agrees. */
  async function readMine(): Promise<void> {
    known = 'unknown';
    readError = null;
    try {
      const mine = await runEffect(exchangesStore.getMyInterests());
      known = (mine ?? []).some(
        (i) => encodeHashToBase64(i.listing) === encodeHashToBase64(listing)
      )
        ? 'yes'
        : 'no';
    } catch (e) {
      known = 'failed';
      readError = reasonOf(e);
    }
  }

  $effect(() => {
    void readMine();
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
    if (busy || mine || !author || known !== 'no') return;
    busy = true;
    error = null;
    try {
      await runEffect(exchangesStore.createInterest(listing, listingType));
      known = 'yes';
    } catch (e) {
      error = reasonOf(e);
    } finally {
      busy = false;
    }
  }
</script>

{#if !mine && author}
  <div class="flex flex-wrap items-center gap-2">
    {#if known === 'yes'}
      <!--
        The badge is the whole of it. This button is only ever shown on a listing card
        inside a conversation, so a link to that conversation would point at the page the
        member is already reading.
      -->
      <span class="variant-soft-success badge">{S.listing.interestShown}</span>
    {:else if known === 'failed'}
      <span class="text-sm text-error-700 dark:text-error-300" role="alert"
        >{fill(S.listing.interestReadFailed, { reason: readError ?? '' })}</span
      >
      <button type="button" class="variant-ghost btn btn-sm" onclick={readMine}>{C.tryAgain}</button
      >
    {:else}
      <!-- Disabled until the record has answered: an unread "no" is not a no. -->
      <button
        type="button"
        class="variant-filled-primary btn btn-sm"
        disabled={busy || known !== 'no'}
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
