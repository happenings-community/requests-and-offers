<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { ActionHash } from '@holochain/client';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import { readOrigin, routeAfterPublish } from '$lib/paths';
  import messagingStore from '$lib/stores/messaging.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import BackToConversation from './BackToConversation.svelte';

  /**
   * What a member is offered once a listing is published.
   *
   * **Nothing is shared automatically.** Publishing a listing and telling somebody about
   * it are two decisions, and a member who has just posted something may well want to
   * look at it before anyone else does.
   */
  type Props = {
    /** The listing just published, which is what sharing sends. */
    listing: ActionHash | null;
  };
  const { listing }: Props = $props();

  const after = $derived(routeAfterPublish(readOrigin($page.url)));

  let name = $state('a member');
  let sharing = $state(false);
  let shareError = $state<string | null>(null);

  $effect(() => {
    if (after.kind !== 'shareWith') return;
    const hash = after.counterparty;
    (async () => {
      const user = await runEffect(usersStore.getUserByActionHash(hash));
      if (user?.name) name = user.name;
    })();
  });

  async function share() {
    if (after.kind !== 'shareWith' || !listing) return;
    sharing = true;
    shareError = null;
    try {
      // A card-only message: the zome refuses a body carrying both text and a listing.
      await runEffect(messagingStore.send(after.counterparty, '', listing));
      await goto(after.conversation);
    } catch {
      // The listing is published either way, so the message says so rather than implying
      // the whole thing failed.
      shareError = S.listing.shareFailed;
    } finally {
      sharing = false;
    }
  }
</script>

{#if after.kind === 'continueProposal'}
  <a class="btn variant-filled-primary" href={after.href} data-testid="continue-proposal">
    {S.listing.continueProposal}
  </a>
{:else if after.kind === 'shareWith'}
  <div class="flex flex-wrap items-center gap-3">
    <button
      type="button"
      class="btn variant-filled-primary"
      onclick={share}
      disabled={sharing || !listing}
      data-testid="share-with"
    >
      {fill(S.listing.shareWith, { name })}
    </button>
    <BackToConversation />
  </div>
  {#if shareError}
    <p class="text-error-500 text-sm">{shareError}</p>
  {/if}
{/if}
