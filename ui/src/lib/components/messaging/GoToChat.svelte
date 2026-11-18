<script lang="ts">
  import { goto } from '$app/navigation';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import { paths } from '$lib/paths';
  import messagingStore from '$lib/stores/messaging.store.svelte';
  import { threadKeyOf } from '$lib/utils/messaging-threads';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import { firstContactNeeded, openFirstContact } from '$lib/utils/messaging-first-contact';
  import type { ReachPersonProps } from '$lib/extensions/reach-person';

  /**
   * **What messaging supplies to the exchange pages** (brief H4).
   *
   * One way of reaching the other person, when this network has messaging: the
   * conversation, with however many of its messages are unopened. It takes
   * `ReachPersonProps` and nothing more, so the pages that render it need to know nothing
   * about messaging to pass its props.
   *
   * It is plugged in by the root layout and reached only through
   * `extensions/reach-person.ts`. **Nothing on the formal route imports this file**, which
   * is the whole point: the import walk from an exchange page stops at the neutral module.
   * The seam test goes red on purpose when a page reaches past it to here.
   *
   * The wording and the count stayed in the messaging strings through H3 for exactly this
   * step: Go to chat and the count are one thing to say, said here, once.
   *
   * **The count sits on the button's corner**, as a number on an app icon does, and only
   * where `count` asks for it: on My Exchanges, where the member is scanning people. On a
   * listing or an exchange page it stays off, so the one place that counts unopened
   * conversations is My Messages (Sam, 6 November).
   */
  const { person, block = false, count = false }: ReachPersonProps = $props();

  const unread = $derived(
    messagingStore.threads.find((t) => t.key === threadKeyOf(person))?.unread ?? 0
  );

  const href = $derived(paths.conversation(person));
  const modalStore = getModalStore();

  /**
   * A member's first message is told what it does and does not put out, once, and this is
   * one of the two places that can be. It names nobody: the hash is all this has, and
   * reading the person for a sentence shown once is a call not worth making.
   */
  function press(event: MouseEvent) {
    if (!firstContactNeeded()) return;
    event.preventDefault();
    openFirstContact(modalStore, { kind: 'chat', label: S.exchanges.goToChat }, () => {
      void goto(href);
    });
  }
</script>

<a
  class="variant-ghost btn relative {block ? 'w-full' : 'btn-sm'}"
  {href}
  onclick={press}
  data-testid="go-to-chat"
  aria-label={count && unread > 0
    ? `${S.exchanges.goToChat}, ${fill(S.hub.unread, { count: unread })}`
    : undefined}
>
  {S.exchanges.goToChat}
  {#if count && unread > 0}
    <span
      class="variant-filled-primary badge absolute -right-2 -top-2 min-w-5 rounded-full px-1.5 py-0 text-xs"
      aria-hidden="true"
      data-testid="go-to-chat-unread"
    >
      {unread}
    </span>
  {/if}
</a>
