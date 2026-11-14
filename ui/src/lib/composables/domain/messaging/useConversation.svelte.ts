import { SvelteMap } from 'svelte/reactivity';
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
 * The people a card (a shared listing, an accept, a decline, a withdrawal) is on its way
 * to, each with the press that put them there.
 *
 * **Outside any one screen.** A card still going is still going after the member leaves
 * the conversation, for another person or for the list, and comes back: kept on the
 * screen, it was forgotten with the screen, and the row was free for a second card.
 * Exported for the unit tests, which clear it between cases.
 */
export const cardsGoing = new SvelteMap<string, symbol>();

/**
 * Why the last card to each person was refused, until the member has seen it.
 *
 * Beside `cardsGoing` and for the same reason: an accept refused after the member had
 * left for the list and come back was said on a screen that no longer existed, and the
 * proposal simply showed as still to be answered. Exported for the unit tests.
 */
export const cardRefusals = new SvelteMap<string, { reason: string; about?: string }>();

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
  const actionError = $derived.by(() => {
    const refusal = cardRefusals.get(counterpartyB64);
    if (!refusal) return null;
    // Said only while the thing it is about is still waiting. A reason kept from an
    // earlier visit may be "no answer" for an accept that did in fact land: by the time
    // the member is back the proposal is an agreement, and "that didn't go through"
    // over it would be wrong.
    if (refusal.about && thread && !stillWaiting(thread, refusal.about)) return null;
    return refusal.reason;
  });
  let sending = $state(false);
  /** True once this screen's own read has finished. Until then, nothing is an answer. */
  let loaded = $state(false);
  /** Why the read failed, when it did. The page shows this instead of the conversation. */
  let loadError = $state<string | null>(null);

  const thread = $derived<UIThread | undefined>(messagingStore.threads.find((t) => t.key === key));

  /** Is this proposal, or this interest, still in the conversation and unanswered? */
  const stillWaiting = (t: UIThread, hash: string): boolean =>
    t.exchanges.some(
      (e) => encodeHashToBase64(e.agreement_hash) === hash && e.status === 'Proposed' && !e.response
    ) || t.interests.some((i) => encodeHashToBase64(i.interest_hash) === hash);
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
    // name, draft and errors never show on the next one.
    //
    // The draft is the exception when the address has not changed. The page also runs
    // this for Try again after a failed read, and the composer can be on screen before
    // that read has finished (the layout's poll has usually filled the store already),
    // so a member may have typed by then: the draft is theirs and is kept.
    const samePerson = shownFor === counterpartyB64;
    // Leaving a person is having seen whatever was said about their last card.
    // (Only if it could have been: a visit whose read failed showed the fault instead.)
    if (shownFor !== null && !samePerson && loaded) cardRefusals.delete(shownFor);
    shownFor = counterpartyB64;
    // A message still going to this same person is still this screen's: Try again after
    // a failed read must not free Send under it, or leave its text in the box to be sent
    // twice. For another person, the answer is no longer this screen's to act on.
    if (!samePerson) {
      sendPress++;
      sending = false;
    }
    loaded = false;
    loadError = null;
    missing = null;
    sendError = null;
    name = C.someone;
    if (!samePerson) draft = '';
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

  /**
   * Which press of Send this screen is waiting on.
   *
   * **Send's own count.** It was shared with the cards, so a card pressed while a
   * message was still going made that message's answer look like somebody else's: Send
   * stayed disabled with the sent text still in the box, and a refusal of either was
   * reported nowhere. A card and a message are answered separately; a card is answered
   * to the person it was pressed for (see `act`).
   */
  let sendPress = 0;

  async function send(): Promise<void> {
    const content = draft.trim();
    if (content.length === 0 || sending) return;
    sending = true;
    sendError = null;
    // What was in the box when Send was pressed. A send that gets no answer takes a full
    // timeout, and the box stays open for typing meanwhile.
    const typed = draft;
    // This press, on this screen. If the member has moved to another conversation by the
    // time the answer comes, or has come back and pressed Send again, the answer is not
    // this screen's to act on: no "wasn't sent" on someone else's page, no cleared box,
    // no Send button coming back to life under a later message still on its way.
    // (`initialize` moves the count on as well, so leaving and returning counts.)
    const mine = ++sendPress;
    const target = counterparty;
    const stillMine = () => mine === sendPress;
    try {
      await runEffect(messagingStore.send(target, content));
    } catch (e) {
      if (stillMine()) {
        sendError = reasonOf(e);
        sending = false;
      } else {
        // Refused after the member had left: there is no screen to say so on and the
        // draft went with the page. Kept in that person's conversation as a refused
        // message, with the reason, so it is neither lost nor silently dropped.
        messagingStore.keepRefused(target, content, reasonOf(e));
      }
      return;
    }
    if (stillMine()) {
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

  /**
   * A card action is on its way to this person. One at a time: a second click sends a
   * second card.
   *
   * **Held until the re-read after it has finished**, not only until the action has. The
   * picker row and the card's own buttons stay on screen through the re-read, and a click
   * in that gap sent a second card. The page disables every card control on this.
   */
  const acting = $derived(cardsGoing.has(counterpartyB64));

  /**
   * One card action: the same refresh after, and the reason kept if it was refused.
   *
   * **Answers whether it was done.** A card clears what the member typed (a reason for
   * declining) only on `true`: `false` is a refusal, shown by the page, or an action not
   * run because another was still going, and neither is a reason to lose their words.
   */
  async function act(
    action: () => Promise<unknown>,
    options: {
      /** The proposal or interest the card answers, so its reason is not said once that has moved on. */
      about?: ActionHash;
      /** What to do with a refusal that comes when this person is no longer on screen. */
      refusedElsewhere?: (reason: string) => void;
    } = {}
  ): Promise<boolean> {
    const { refusedElsewhere } = options;
    const about = options.about ? encodeHashToBase64(options.about) : undefined;
    const here = counterpartyB64;
    if (cardsGoing.has(here)) return false;
    const mine = Symbol('card');
    cardsGoing.set(here, mine);
    cardRefusals.delete(here);
    // Released for the person it was pressed for, and for nobody else: another card may
    // be going on the screen the member has moved to.
    const release = () => {
      if (cardsGoing.get(here) === mine) cardsGoing.delete(here);
    };
    try {
      await action();
    } catch (e) {
      // Said to the member where they are looking at this person, or the next time
      // they are. The one exception is a card that can be kept as a refused item in the
      // person's outbox instead: that says it, and offers sending again, by itself.
      const looking = !left && counterpartyB64 === here;
      if (!looking && refusedElsewhere) refusedElsewhere(reasonOf(e));
      else cardRefusals.set(here, { reason: reasonOf(e), about });
      release();
      return false;
    }
    await refresh();
    release();
    return true;
  }

  /**
   * The page is going away. Any answer still on its way now belongs to no screen.
   *
   * `initialize` moves Send's count on for a change of person, but leaving Messages
   * altogether destroys the page without running it, and a refusal that came after
   * that was written to a screen nobody could see and kept nowhere.
   */
  let left = false;
  const leave = (): void => {
    left = true;
    sendPress++;
    // Seen, if it was on screen. One that comes after this is kept for the next visit.
    if (shownFor !== null && loaded) cardRefusals.delete(shownFor);
  };

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
  const shareListing = (listing: ActionHash): Promise<boolean> => {
    const target = counterparty;
    return act(() => runEffect(messagingStore.send(target, '', listing)), {
      // Refused after the member had left: kept in that person's conversation as a
      // refused card, with the reason, exactly as a refused message is.
      refusedElsewhere: (reason) => messagingStore.keepRefused(target, '', reason, listing)
    });
  };

  /** Accept or decline a proposal. A decline must carry a reason; the form enforces it. */
  const respond = (agreement: ActionHash, accepted: boolean, note: string): Promise<boolean> =>
    act(() => runEffect(exchangesStore.respond(agreement, accepted, note)), { about: agreement });

  /** The proposer's one move while a proposal waits, as on the exchange page. */
  const withdrawProposal = (agreement: ActionHash): Promise<boolean> =>
    act(() => runEffect(exchangesStore.cancel(agreement, 'Withdrawn by the proposer')), {
      about: agreement
    });

  const withdrawInterest = (interest: ActionHash): Promise<boolean> =>
    act(() => runEffect(exchangesStore.withdrawInterest(interest)), { about: interest });

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
    get acting() {
      return acting;
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
    leave,
    send,
    retry,
    discard,
    markRead,
    respond,
    withdrawProposal,
    withdrawInterest
  };
}
