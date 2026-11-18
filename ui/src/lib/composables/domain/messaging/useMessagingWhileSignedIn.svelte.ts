import { untrack } from 'svelte';
import usersStore from '$lib/stores/users.store.svelte';
import messagingStore from '$lib/stores/messaging.store.svelte';
import messagingPresence from '$lib/services/messagingPresence.svelte';
import { runEffect } from '$lib/utils/effect';

/** How often the conversations are read again while nothing else has said to. */
export const MESSAGING_POLL_MS = 15000;

/**
 * Messaging's background work, for as long as a member is signed in on a network that has
 * messaging: the conversations read again every fifteen seconds, the outbox retried, and
 * the listener for nudges and receipts. Called once, by the root layout, from component
 * initialisation; it stops with the layout.
 *
 * **It tracks whether someone is signed in, not who.** Reading the member again
 * (`refreshCurrentUser`) replaces the user record, and when the layout's effect tracked
 * the record itself the poll, the retry timer and the listener were stopped and started
 * again every time. Starting reads the stores too, so it is untracked: nothing it reads
 * can restart it.
 *
 * @param onCounted called each time a read of the conversations has come back, so the
 *   layout knows the unopened count is a real one.
 */
export function useMessagingWhileSignedIn(onCounted: () => void): void {
  const signedIn = $derived(!!usersStore.currentUser);

  $effect(() => {
    if (messagingPresence.isAbsent || !signedIn) return;
    return untrack(() => start(onCounted));
  });
}

function start(onCounted: () => void): () => void {
  const refresh = () =>
    runEffect(messagingStore.loadConversations())
      .then(onCounted)
      .catch(() => {});
  void refresh();
  const interval = setInterval(refresh, MESSAGING_POLL_MS);
  const stopRetrying = messagingStore.startRetrying();
  const stopListening = messagingStore.listen();
  return () => {
    clearInterval(interval);
    stopRetrying();
    stopListening();
  };
}
