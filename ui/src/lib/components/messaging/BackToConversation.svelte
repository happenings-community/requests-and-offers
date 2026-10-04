<script lang="ts">
  import { page } from '$app/stores';
  import { decodeHashFromBase64, type ActionHash } from '@holochain/client';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';

  /**
   * The way back to a conversation a member left to publish a listing.
   *
   * Renders nothing unless the page was reached with `?from=<User base64>`, so the
   * ordinary create flow is untouched. A link rather than an automatic jump: having just
   * published something, a member may well want to look at it first.
   */
  const from = $derived($page.url.searchParams.get('from'));
  let name = $state('a member');

  const counterparty = $derived.by<ActionHash | null>(() => {
    if (!from) return null;
    try {
      return decodeHashFromBase64(from) as ActionHash;
    } catch {
      // A malformed hash in a URL is not worth an error; the link simply does not show.
      return null;
    }
  });

  $effect(() => {
    const hash = counterparty;
    if (!hash) return;
    (async () => {
      const user = await runEffect(usersStore.getUserByActionHash(hash));
      name = user?.name ?? 'a member';
    })();
  });
</script>

{#if counterparty}
  <a class="btn variant-filled-primary" href="/messages/{from}" data-testid="back-to-conversation">
    ← {fill(S.listing.backToConversation, { name })}
  </a>
{/if}
