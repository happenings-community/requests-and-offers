<script lang="ts">
  import { goto } from '$app/navigation';
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { MESSAGING_STRINGS as S } from '$lib/strings/messaging.strings';
  import { showInterestAndOpen } from '$lib/utils/messaging-actions';
  import type { ListingType } from '$lib/types/holochain';

  type Props = {
    listing: ActionHash;
    listingType: ListingType;
    /** The listing author's `User`. The conversation opens with them. */
    author: ActionHash | undefined;
  };
  const { listing, listingType, author }: Props = $props();

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const mine = $derived(
    !!me && !!author && encodeHashToBase64(author) === encodeHashToBase64(me)
  );

  let already = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const conversation = $derived(author ? `/messages/${encodeHashToBase64(author)}` : '/messages');

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

  /** The order is the rule, and it is tested in `utils/messaging-actions.ts`. */
  async function show() {
    if (busy || mine || !author) return;
    busy = true;
    error = null;
    const outcome = await showInterestAndOpen({
      createInterest: () => runEffect(exchangesStore.createInterest(listing, listingType)),
      open: () => goto(conversation)
    });
    if (outcome.ok) already = true;
    else error = outcome.reason;
    busy = false;
  }
</script>

{#if !mine && author}
  <div class="flex flex-wrap items-center gap-2">
    {#if already}
      <span class="variant-soft-success badge">{S.listing.interestShown}</span>
      <a class="btn btn-sm variant-ghost" href={conversation}>{S.listing.goToChat}</a>
    {:else}
      <button
        type="button"
        class="btn btn-sm variant-filled-primary"
        disabled={busy}
        onclick={show}
        data-testid="show-interest"
      >
        {S.listing.showInterest}
      </button>
    {/if}
  </div>
  {#if error}
    <p class="text-error-700 dark:text-error-300 text-sm" role="alert">{error}</p>
  {/if}
{/if}
