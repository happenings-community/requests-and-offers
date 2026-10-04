import { encodeHashToBase64, type ActionHash } from '@holochain/client';
import messagingStore from '$lib/stores/messaging.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { runEffect } from '$lib/utils/effect';
import {
  matchesFilter,
  threadKeyOf,
  type Fault,
  type ThreadFilter,
  type UIThread
} from '$lib/utils/messaging-threads';

/**
 * The Messages list: which conversations to show, and what to call the people in them.
 *
 * The rules about *what belongs in a row* are pure and live in
 * `utils/messaging-threads.ts`. This holds the screen's own state, which is the chosen
 * filter and the resolved names, and nothing else. Following
 * `useExchangesManagement.svelte.ts`.
 */

export const FILTERS: { key: ThreadFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unopened', label: 'Unopened' },
  { key: 'offers', label: 'Offers' },
  { key: 'requests', label: 'Requests' },
  { key: 'exchanges', label: 'Exchanges' },
  { key: 'archived', label: 'Archived' }
];

export function useMessages() {
  let filter = $state<ThreadFilter>('all');
  const names = $state<Record<string, string>>({});

  const threads = $derived(messagingStore.threads);
  const shown = $derived(threads.filter((t) => matchesFilter(t, filter)));
  const faults = $derived(messagingStore.faults);

  /**
   * The unopened count across every conversation, archived ones included.
   *
   * Archived is a view, not a mute: a conversation returns to All as soon as something
   * unread arrives, so a count that skipped archived rows would briefly disagree with
   * the list it sits above.
   */
  const unreadTotal = $derived(threads.reduce((sum, t) => sum + t.unread, 0));

  const nameOf = (thread: UIThread) => names[thread.key] ?? 'A member';
  const nameOfAgent = (key: string) => names[key] ?? 'A member';

  /**
   * One lookup per person, not per row.
   *
   * A name that will not resolve leaves a placeholder rather than emptying the list: not
   * knowing what to call someone is no reason to hide their messages.
   */
  async function resolveNames(list: UIThread[]): Promise<void> {
    for (const thread of list) {
      if (thread.key in names) continue;
      const user = await runEffect(usersStore.getUserByActionHash(thread.counterparty));
      names[thread.key] = user?.name ?? 'A member';
    }
  }

  /** A fault row names the sender, who is an agent rather than a `User`. */
  async function resolveFaultNames(list: Fault[]): Promise<void> {
    for (const fault of list) {
      const key = encodeHashToBase64(fault.from);
      if (key in names) continue;
      const user = await runEffect(usersStore.getUserByAgentPubKey(fault.from));
      names[key] = user?.name ?? 'A member';
    }
  }

  async function initialize(): Promise<void> {
    const loaded = await runEffect(messagingStore.loadConversations());
    await resolveNames(loaded ?? []);
    await resolveFaultNames(messagingStore.faults);
  }

  const setFilter = (next: ThreadFilter) => {
    filter = next;
  };

  const setArchived = (thread: UIThread, archived: boolean) =>
    messagingStore.setArchived(thread.counterparty, archived);

  const keyOf = (counterparty: ActionHash) => threadKeyOf(counterparty);

  return {
    get filter() {
      return filter;
    },
    get threads() {
      return threads;
    },
    get shown() {
      return shown;
    },
    get faults() {
      return faults;
    },
    get loading() {
      return messagingStore.loading;
    },
    get error() {
      return messagingStore.error;
    },
    get unreadTotal() {
      return unreadTotal;
    },
    initialize,
    setFilter,
    setArchived,
    nameOf,
    nameOfAgent,
    keyOf
  };
}
