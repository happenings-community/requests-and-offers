<script lang="ts">
  import { goto } from '$app/navigation';
  import messagingStore from '$lib/stores/messaging.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import BackToConversation from './BackToConversation.svelte';
  import type { ShareListingProps } from '$lib/extensions/share-listing';
  import { COMMON_STRINGS as C } from '$lib/strings/common.strings';

  /**
   * What a conversation offers a member who has just published a listing: send it to the
   * person they were talking to, and a way back to them.
   *
   * **Nothing is sent by itself.** Publishing a listing and telling somebody about it are
   * two decisions, and someone who has just posted something may well want to look at it
   * before anyone else does.
   *
   * Both halves only make sense where there is a conversation to go back to, which is why
   * they live here rather than on the publish page: a network built without conversations
   * shows neither, and the page that renders this needs to know nothing about either.
   */
  const { listing, counterparty, conversation }: ShareListingProps = $props();

  let name = $state(C.someoneInSentence);
  let sharing = $state(false);
  let shareError = $state<string | null>(null);

  $effect(() => {
    const hash = counterparty;
    (async () => {
      const user = await runEffect(usersStore.getUserByActionHash(hash));
      if (user?.name) name = user.name;
    })();
  });

  async function share() {
    if (!listing) return;
    sharing = true;
    shareError = null;
    try {
      // A card-only message: the zome refuses a body carrying both text and a listing.
      await runEffect(messagingStore.send(counterparty, '', listing));
      await goto(conversation);
    } catch {
      // The listing is published either way, so the message says so rather than implying
      // the whole thing failed.
      shareError = S.listing.shareFailed;
    } finally {
      sharing = false;
    }
  }
</script>

<div class="flex flex-wrap items-center gap-3">
  <button
    type="button"
    class="variant-filled-primary btn"
    onclick={share}
    disabled={sharing || !listing}
    data-testid="share-with"
  >
    {fill(S.listing.shareWith, { name })}
  </button>
  <BackToConversation />
</div>
{#if shareError}
  <p class="text-sm text-error-500">{shareError}</p>
{/if}
