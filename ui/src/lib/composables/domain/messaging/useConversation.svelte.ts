import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
import messagingStore, { type OutboxItem } from '$lib/stores/messaging.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import { runEffect } from '$lib/utils/effect';
import {
  buildTimeline,
  reasonOf,
  proposableFrom,
  threadKeyOf,
  type TimelineItem,
  type UIThread
} from '$lib/utils/messaging-threads';
import requestsStore from '$lib/stores/requests.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';
import type { UIInterest } from '$lib/types/ui';

/**
 * One conversation: the person, the timeline, the composer and anything still waiting to
 * go out.
 *
 * The ordering rules are pure, in `utils/messaging-threads.ts`. What is here is the
 * screen's own state and the calls that change something.
 */
export function useConversation(counterpartyB64: string) {
  const counterparty = $derived(decodeHashFromBase64(counterpartyB64) as ActionHash);
  const key = $derived(threadKeyOf(counterparty));

  let name = $state('A member');
  let myUser = $state<ActionHash | undefined>(undefined);
  let draft = $state('');
  let sendError = $state<string | null>(null);
  let sending = $state(false);

  const thread = $derived<UIThread | undefined>(
    messagingStore.threads.find((t) => t.key === key)
  );
  const timeline = $derived<TimelineItem[]>(thread ? buildTimeline(thread) : []);

  /** Anything for this person that has not gone out, oldest first. */
  const waiting = $derived<OutboxItem[]>(
    messagingStore.outbox.filter((item) => item.to === key).sort((a, b) => a.queuedAt - b.queuedAt)
  );

  const titles = $state<Record<string, string>>({});
  const titleOf = (listing: ActionHash) => titles[encodeHashToBase64(listing)] ?? 'A listing';

  /**
   * The listings either of you may propose from. Empty until a thread is loaded, which is
   * also when "Make a proposal" has anything to offer.
   */
  const proposable = $derived(
    thread && myUser ? proposableFrom(thread, myUser) : { theirs: [], yours: [] }
  );

  /** One title lookup per listing, so the picker can name them. */
  async function resolveTitles(interests: UIInterest[]): Promise<void> {
    for (const interest of interests) {
      const key = encodeHashToBase64(interest.listing);
      if (key in titles) continue;
      const listing =
        interest.listing_type === 'Request'
          ? await runEffect(requestsStore.getRequest(interest.listing))
          : await runEffect(offersStore.getOffer(interest.listing));
      titles[key] = listing?.title ?? 'A listing';
    }
  }

  async function initialize(): Promise<void> {
    await runEffect(messagingStore.loadConversations());
    const user = await runEffect(usersStore.getUserByActionHash(counterparty));
    name = user?.name ?? 'A member';
    myUser = usersStore.currentUser?.original_action_hash;
    // Opening a conversation is what marks it read. Nothing else does, so a nav badge and
    // a row always agree about what has been seen.
    messagingStore.markThreadRead(counterparty);
    if (thread) await resolveTitles(thread.interests);
  }

  async function send(): Promise<void> {
    const content = draft.trim();
    if (content.length === 0 || sending) return;
    sending = true;
    sendError = null;
    try {
      await runEffect(messagingStore.send(counterparty, content));
      // Cleared only on the paths that kept the message: a real refusal throws, and the
      // draft stays so nothing a member typed is lost to an error.
      draft = '';
      await runEffect(messagingStore.loadConversations());
    } catch (e) {
      sendError = reasonOf(e);
    } finally {
      sending = false;
    }
  }

  const retry = (id: string) => runEffect(messagingStore.retryUnsent(id));

  /** Accept or decline a proposal. A decline must carry a reason; the form enforces it. */
  async function respond(agreement: ActionHash, accepted: boolean, note: string): Promise<void> {
    await runEffect(exchangesStore.respond(agreement, accepted, note));
    await runEffect(messagingStore.loadConversations());
  }

  async function withdrawInterest(interest: ActionHash): Promise<void> {
    await runEffect(exchangesStore.withdrawInterest(interest));
    await runEffect(messagingStore.loadConversations());
  }

  return {
    get counterparty() {
      return counterparty;
    },
    get name() {
      return name;
    },
    get thread() {
      return thread;
    },
    get timeline() {
      return timeline;
    },
    get waiting() {
      return waiting;
    },
    get proposable() {
      return proposable;
    },
    titleOf,
    get draft() {
      return draft;
    },
    set draft(value: string) {
      draft = value;
    },
    get sending() {
      return sending;
    },
    get sendError() {
      return sendError;
    },
    get loading() {
      return messagingStore.loading;
    },
    initialize,
    send,
    retry,
    respond,
    withdrawInterest
  };
}
