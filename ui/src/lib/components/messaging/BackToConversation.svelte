<script lang="ts">
  import { page } from '$app/stores';
  import type { ActionHash } from '@holochain/client';
  import { paths, readFrom } from '$lib/paths';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import { COMMON_STRINGS as C } from '$lib/strings/common.strings';

  /**
   * The way back to a conversation a member left.
   *
   * **The only place this sentence is written.** Every page that can be reached from a
   * conversation shows the same way back, so it is said once, here, with the name of the
   * person it belongs to. A page that has no other business with conversations asks for
   * this rather than writing it out.
   *
   * A link rather than an automatic jump: having just published something, or just acted
   * on an exchange, a member may well want to look at it first.
   */
  type Props = {
    /**
     * Who to go back to. A page that already knows, from whatever marker it reads, passes
     * it. Left out, this reads `?from=<User base64>` from the address, which is how a
     * publish page carries it, and renders nothing when there is none: a malformed or
     * missing hash means the member did not arrive from a conversation.
     */
    counterparty?: ActionHash;
    /** The look the asking page wants, since a page's own Back may be small and quiet. */
    classes?: string;
  };
  const { counterparty: given, classes = 'variant-filled-primary btn' }: Props = $props();

  let name = $state(C.someoneInSentence);

  const counterparty = $derived(given ?? readFrom($page.url));

  $effect(() => {
    const hash = counterparty;
    if (!hash) return;
    (async () => {
      const user = await runEffect(usersStore.getUserByActionHash(hash));
      name = user?.name ?? C.someoneInSentence;
    })();
  });
</script>

{#if counterparty}
  <a class={classes} href={paths.conversation(counterparty)} data-testid="back-to-conversation">
    ← {fill(S.listing.backToConversation, { name })}
  </a>
{/if}
