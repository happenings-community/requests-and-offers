import { encodeHashToBase64, type ActionHash } from '@holochain/client';
import { readHash } from '$lib/paths';
import messagingStore, { type OutboxItem } from '$lib/stores/messaging.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import { reasonOf } from '$lib/utils/error-shape';
import { runEffect } from '$lib/utils/effect';
import {
  buildTimeline,
  proposableFrom,
  threadKeyOf,
  type TimelineItem,
  type UIThread
} from '$lib/utils/messaging-threads';
import requestsStore from '$lib/stores/requests.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';
import type { UIInterest } from '$lib/types/ui';
import type { ReceiptSetting } from '$lib/utils/messaging-local';
import { COMMON_STRINGS as C } from '$lib/strings/common.strings';

/**
 * One conversation: the person, the timeline, the composer and anything still waiting to
 * go out.
 *
 * The ordering rules are pure, in `utils/messaging-threads.ts`. What is here is the
 * screen's own state and the calls that change something.
 */
export function useConversation(address: string | (() => string)) {
  /**
   * The address as it is now. A page passes a getter, because SvelteKit keeps the same
   * component when only the `[user]` part of the URL changes: read once, the page went on
   * showing, and sending to, whoever it was first opened on.
   */
  const counterpartyB64 = $derived(typeof address === 'function' ? address() : address);
  /**
   * The address, read as `paths` reads one, or `null` when it is not a hash at all.
   *
   * **The address is checked, not trusted.** `decodeHashFromBase64` does not throw on
   * rubbish, it decodes what it can, so the length is the check, as it is in `paths`. A
   * hash that no member record answers to rendered a full conversation, composer
   * included, addressed to "A member". Both are their own state now, kept apart from
   * "not yet read" and "the read failed".
   */
  const decoded = $derived(readHash(counterpartyB64));
  /** Only meaningful once `loaded`; the page reads it in that branch alone. */
  const counterparty = $derived(decoded as ActionHash);
  const key = $derived(decoded ? threadKeyOf(decoded) : '');
  /** Why there is nobody here: the address is not one, or no member answers to it. */
  let missing = $state<'address' | 'member' | null>(null);

  let name = $state(C.someone);
  let myUser = $state<ActionHash | undefined>(undefined);
  let draft = $state('');
  let sendError = $state<string | null>(null);
  /** Why a card action (share, accept, decline, withdraw) was refused, when one was. */
  let actionError = $state<string | null>(null);
  let sending = $state(false);
  /** True once this screen's own read has finished. Until then, nothing is an answer. */
  let loaded = $state(false);
  /** Why the read failed, when it did. The page shows this instead of the conversation. */
  let loadError = $state<string | null>(null);

  const thread = $derived<UIThread | undefined>(messagingStore.threads.find((t) => t.key === key));
  const timeline = $derived<TimelineItem[]>(thread ? buildTimeline(thread) : []);

  /** Anything for this person that has not gone out, oldest first. */
  const waiting = $derived<OutboxItem[]>(
    messagingStore.outbox.filter((item) => item.to === key).sort((a, b) => a.queuedAt - b.queuedAt)
  );

  const titles = $state<Record<string, string>>({});
  const titleOf = (listing: ActionHash) => titles[encodeHashToBase64(listing)] ?? C.something;

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
      titles[key] = listing?.title ?? C.something;
    }
  }

  /**
   * Read everything this screen shows, and say so if it could not.
   *
   * **A failed read is a fault, never an empty conversation.** The empty timeline and the
   * working composer are what a brand-new conversation looks like, so showing them after
   * a failed `get_inbox` told a member with forty messages that there was nothing there.
   * The reason is kept for the page, which offers this same call again.
   */
  /** Which run of `initialize` is the current one. */
  let run = 0;
  /** The address the screen's state belongs to. */
  let shownFor: string | null = null;

  async function initialize(): Promise<void> {
    // An earlier run that resumes after the address has changed must not write the last
    // person's name, or "loaded", over the next one's.
    const mine = ++run;
    const stale = () => mine !== run;
    // Everything this screen holds about a person is cleared first, so the last person's
    // name, draft and errors never show on the next one. The page runs this for a change
    // of address and for Try again after a failed read, where there is no composer and
    // so no draft to lose.
    shownFor = counterpartyB64;
    loaded = false;
    loadError = null;
    missing = null;
    sendError = null;
    actionError = null;
    sending = false;
    name = C.someone;
    draft = '';
    if (!decoded) {
      missing = 'address';
      return;
    }
    const person = decoded;
    try {
      await runEffect(messagingStore.loadConversations());
      if (stale()) return;
      const user = await runEffect(usersStore.getUserByActionHash(person));
      if (stale()) return;
      if (!user) {
        // Read, and absent: not a fault, and not a conversation either.
        missing = 'member';
        return;
      }
      name = user.name ?? C.someone;
      myUser = usersStore.currentUser?.original_action_hash;
      receiptSetting = messagingStore.receiptSettingFor(counterparty);
      // Opening a conversation is what marks it read. Nothing else does, so a nav badge
      // and a row always agree about what has been seen.
      messagingStore.markThreadRead(counterparty);
      if (thread) await resolveTitles(thread.interests);
      if (stale()) return;
      loaded = true;
    } catch (e) {
      if (!stale()) loadError = reasonOf(e);
    }
  }

  async function send(): Promise<void> {
    const content = draft.trim();
    if (content.length === 0 || sending) return;
    sending = true;
    sendError = null;
    // What was in the box when Send was pressed. A send that gets no answer takes a full
    // timeout, and the box stays open for typing meanwhile.
    const typed = draft;
    // Whose conversation this was pressed in. If the member has moved to another by the
    // time the answer comes, nothing about it is written on the new one's screen: not a
    // "wasn't sent", not a cleared box, not a Send button coming back to life.
    const pressedFor = shownFor;
    const stillHere = () => shownFor === pressedFor;
    try {
      await runEffect(messagingStore.send(counterparty, content));
    } catch (e) {
      if (stillHere()) {
        sendError = reasonOf(e);
        sending = false;
      }
      return;
    }
    if (stillHere()) {
      // Cleared only on the paths that kept the message: a real refusal returned above,
      // and the draft stays so nothing a member typed is lost to an error. And only if
      // it is still what was sent: anything typed since is the start of the next message.
      if (draft === typed) draft = '';
      sending = false;
    }
    await refresh();
  }

  /**
   * Re-read after something was done. **A failed re-read is not a failed send.** The two
   * used to share one `try`, so a message that had gone was reported as "wasn't sent"
   * whenever the read after it failed, and a card action that had gone as "didn't go
   * through", which invites doing it twice. The store reports its own read failures.
   */
  async function refresh(): Promise<void> {
    try {
      await runEffect(messagingStore.loadConversations());
    } catch {
      // `messagingStore.error` has the reason; the next poll tries again.
    }
  }

  const retry = (id: string) => runEffect(messagingStore.retryUnsent(id));
  const discard = (id: string) => messagingStore.discardUnsent(id);

  /**
   * Keep the open conversation read as it grows.
   *
   * Opening marks it read, but the poll and nudges add messages while it is open, and
   * those stayed unread (counted in the nav badge, no receipt sent) until the member left
   * and came back. The page calls this whenever the timeline changes; the store does
   * nothing unless the mark actually advances.
   */
  const markRead = () => {
    if (loaded && decoded) messagingStore.markThreadRead(counterparty);
  };

  /** One card action: the same refresh after, and the reason kept if it was refused. */
  async function act(action: () => Promise<unknown>): Promise<void> {
    actionError = null;
    const pressedFor = shownFor;
    try {
      await action();
    } catch (e) {
      if (shownFor === pressedFor) actionError = reasonOf(e);
      return;
    }
    await refresh();
  }

  /**
   * What one of my messages is doing: sending, sent, or read.
   *
   * **Read only where a receipt actually arrived.** Anything the other person has read
   * without one reaching us stays at Sent, which is why the general line says receipts
   * do not always arrive. Nothing here guesses.
   */
  /** What this chat does about receipts: inherit, on, or off. */
  let receiptSetting = $state<ReceiptSetting>('inherit');

  const setReceipts = (setting: ReceiptSetting) => {
    receiptSetting = setting;
    messagingStore.setReceiptsForChat(counterparty, setting);
  };

  const statusOf = (at: number): 'sent' | 'read' =>
    at <= messagingStore.theirReadUpTo(counterparty) ? 'read' : 'sent';

  /** My own published listings, for the Share a listing picker. */
  let shareable = $state<Array<{ hash: ActionHash; title: string; type: 'Request' | 'Offer' }>>([]);

  async function loadShareable(): Promise<void> {
    if (!myUser) return;
    const [requests, offers] = [
      await runEffect(requestsStore.getMyListings(myUser)).catch(() => []),
      await runEffect(offersStore.getMyListings(myUser)).catch(() => [])
    ];
    shareable = [
      ...requests.map((r) => ({
        hash: r.original_action_hash as ActionHash,
        title: r.title,
        type: 'Request' as const
      })),
      ...offers.map((o) => ({
        hash: o.original_action_hash as ActionHash,
        title: o.title,
        type: 'Offer' as const
      }))
    ].filter((l) => !!l.hash);
  }

  /**
   * Send one of my listings as a card.
   *
   * **A card-only message, with no text.** The zome refuses a body carrying both, which
   * is what keeps a listing a card rather than becoming context on something somebody
   * wrote.
   */
  const shareListing = (listing: ActionHash): Promise<void> =>
    act(() => runEffect(messagingStore.send(counterparty, '', listing)));

  /** Accept or decline a proposal. A decline must carry a reason; the form enforces it. */
  const respond = (agreement: ActionHash, accepted: boolean, note: string): Promise<void> =>
    act(() => runEffect(exchangesStore.respond(agreement, accepted, note)));

  /** The proposer's one move while a proposal waits, as on the exchange page. */
  const withdrawProposal = (agreement: ActionHash): Promise<void> =>
    act(() => runEffect(exchangesStore.cancel(agreement, 'Withdrawn by the proposer')));

  const withdrawInterest = (interest: ActionHash): Promise<void> =>
    act(() => runEffect(exchangesStore.withdrawInterest(interest)));

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
    get shareable() {
      return shareable;
    },
    statusOf,
    get receiptSetting() {
      return receiptSetting;
    },
    setReceipts,
    loadShareable,
    shareListing,
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
    get actionError() {
      return actionError;
    },
    get loading() {
      return messagingStore.loading;
    },
    get loaded() {
      return loaded;
    },
    get loadError() {
      return loadError;
    },
    get missing() {
      return missing;
    },
    initialize,
    send,
    retry,
    discard,
    markRead,
    respond,
    withdrawProposal,
    withdrawInterest
  };
}
