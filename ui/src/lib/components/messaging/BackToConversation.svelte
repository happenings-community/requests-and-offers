<script lang="ts">
  import { page } from '$app/stores';
  import { paths, readFrom } from '$lib/paths';
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
  let name = $state('a member');

  /**
   * The conversation this page was reached from.
   *
   * `readFrom` owns the key and the decoding, so a malformed hash comes back as `null`
   * and the link simply does not show, which is what it did here before.
   */
  const counterparty = $derived(readFrom($page.url));

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
  <a
    class="variant-filled-primary btn"
    href={paths.conversation(counterparty)}
    data-testid="back-to-conversation"
  >
    ← {fill(S.listing.backToConversation, { name })}
  </a>
{/if}
