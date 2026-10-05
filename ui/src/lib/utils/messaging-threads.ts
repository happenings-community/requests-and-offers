import { encodeHashToBase64, type ActionHash, type AgentPubKey } from '@holochain/client';
import type { Message } from '$lib/schemas/messaging.schemas';
import type { UIExchange, UIInterest } from '$lib/types/ui';
import type { ListingType } from '$lib/types/holochain';

/**
 * Turning what the zome returns into the conversations a member sees.
 *
 * **Pure on purpose.** Every rule in this file is a decision about what a member sees,
 * and each one is a thing that can be got wrong silently: the wrong thread key merges or
 * splits people, the wrong sort puts a proposal before the message that led to it. Kept
 * free of Effect, stores and the client, they are testable as tables, the way the zome
 * proves its validation rules. The store does the fetching and calls these.
 */

/**
 * Hide everything from the people this member has blocked.
 *
 * **One function, applied once** (brief E, decision 4). Every read the interface makes
 * starts from the same inbox, so the filter goes there rather than being repeated in the
 * personal list, the role inbox and a member's own correspondence. Three copies of a
 * rule like this is three chances for one of them to be forgotten.
 *
 * Blocking is by **person**, not by agent, unlike the chain entries it replaces: a
 * thread is one person, and blocking one of someone's devices was never what anybody
 * meant. An author whose `User` will not resolve is kept, because a block cannot be
 * proven against somebody we cannot identify, and dropping messages on a failed lookup
 * would hide more than the member asked to hide.
 */
export function applyBlocks<T extends { from: AgentPubKey }>(
  messages: T[],
  agentToUser: (agent: AgentPubKey) => ActionHash | undefined,
  blocked: ReadonlySet<string>
): T[] {
  if (blocked.size === 0) return messages;
  return messages.filter((message) => {
    const user = agentToUser(message.from);
    return !user || !blocked.has(encodeHashToBase64(user));
  });
}

/**
 * Does this failure mean "we could not find the recipient's devices from here"?
 *
 * **This is a waiting condition, not a refusal.** A member never has no devices: they
 * cannot create a profile or a listing without a key. An empty agent lookup means this
 * device has not found them, because the zome reads those links with
 * `GetStrategy::Network`, which falls back to locally cached metadata and so comes back
 * empty when offline with a cold cache. The message has not been written anywhere, and
 * trying again later is the right response, so it goes to the outbox and the member sees
 * "Waiting to send".
 *
 * Matched on a fragment rather than the whole sentence, so that rewording the tail does
 * not silently turn every queued message into a refusal. The zome's constant is
 * `DEVICES_NOT_FOUND` in `coordinator/messaging/src/message.rs`, and **its doc comment
 * points back here**: the two have to move together.
 */
const DEVICES_NOT_FOUND_FRAGMENT = "could not reach that member's devices";

export function isDevicesNotFound(reason: string | undefined | null): boolean {
  return (reason ?? '').toLowerCase().includes(DEVICES_NOT_FOUND_FRAGMENT);
}

/**
 * Why a send did not go through, in the only three kinds that matter.
 *
 * The question behind this is "may the message already have been written?", because
 * that decides whether retrying is safe:
 *
 * - `devicesNotFound` — the zome refused before committing anything, so retrying is
 *   safe and the app does it by itself.
 * - `noAnswer` — a timeout, or the connection going, with no reply either way. The call
 *   **may** have committed. Never retried automatically; the member is asked.
 * - `refused` — the zome answered and said no. Nothing was written, but trying the same
 *   thing again would fail the same way, so the member sees the reason instead.
 */
export type SendFailure =
  | { kind: 'devicesNotFound' }
  | { kind: 'noAnswer'; reason: string }
  | { kind: 'refused'; reason: string };

/**
 * The conductor's wire errors that mean **the zome answered, and said no**.
 *
 * From `ExternalApiWireError` in `holochain_conductor_api` 0.6.1,
 * `src/admin_interface.rs:617-640`, which is
 * `#[serde(tag = "type", rename_all = "snake_case")]`, so these are the names that reach
 * the client. A `wasm_error!(Guest(..))` from our own zome arrives as `ribosome_error`
 * carrying its own text.
 *
 * **`internal_error` and `dna_read_error` are deliberately absent.** Either could in
 * principle be raised after something was written, and the only job of this list is to
 * carry the claim "nothing was written", so anything that cannot carry it is left out.
 *
 * A timeout or a dropped socket never appears here, by construction: they are not
 * answers, so they fall through to the default.
 */
const ZOME_ANSWERED = new Set([
  'ribosome_error',
  'zome_call_unauthorized',
  'zome_call_authentication_failed',
  'deserialization'
]);

/**
 * Classify a failed send.
 *
 * **`noAnswer` is the default, and `refused` has to be earned** (Sam, 4 October). Calling
 * something a refusal claims we know the message did not land, and we only know that when
 * the zome answered. So refusal is a positive match against `ZOME_ANSWERED`, and
 * everything else falls through to the honest answer: we do not know.
 *
 * I had this the wrong way round at first, reasoning that telling someone their message
 * failed was the cautious direction. It is not. A member told "not sent" about a message
 * that did send will type it again, which is exactly the duplicate this whole design
 * exists to avoid. "This may not have sent. Send again?" lets them look at the
 * conversation and decide for themselves.
 *
 * The cost of this default, plainly: a genuine refusal whose name is not on the list is
 * offered a Send again that will fail the same way, wasting a tap. The other mistake
 * posts a message twice to another person.
 */
export function classifySendFailure(error: unknown): SendFailure {
  const { name, message } = errorShape(error);
  if (isDevicesNotFound(message)) return { kind: 'devicesNotFound' };
  if (ZOME_ANSWERED.has(name)) return { kind: 'refused', reason: message };
  return { kind: 'noAnswer', reason: message };
}

/**
 * Read `name` and `message` off whatever was thrown, **without `instanceof`**.
 *
 * `instanceof` is the wrong tool here for two reasons, and the first is not theoretical.
 * This worktree holds **ten copies of `@holochain/client`**: ours at 0.20.5 and nine at
 * 0.20.0, under `@theweave/*`, `@holochain-open-dev/*` and `vf-graphql-holochain`. Inside
 * Moss the error may be built by one of those, and `instanceof HolochainError` against
 * our copy would miss it. Even `instanceof Error` is not safe: an error crossing a realm,
 * or arriving structured-cloned from a worker, is a plain object with the right fields
 * and the wrong prototype.
 *
 * So the shape is what is read, never the class. The fields are the contract that every
 * copy shares; the constructor is not.
 */
export function errorShape(error: unknown): { name: string; message: string } {
  if (typeof error === 'string') return { name: '', message: error };
  if (error !== null && typeof error === 'object') {
    const shape = error as { name?: unknown; message?: unknown };
    return {
      name: typeof shape.name === 'string' ? shape.name : '',
      // **Not `String(error)`.** An object made with `Object.create(null)` has no
      // `toString`, so converting it throws `Cannot convert object to primitive value` —
      // and this runs inside a catch handler, where throwing would lose the member's
      // message rather than queue it. A null-prototype object is exactly what a
      // structured clone can produce, which is the case this whole function exists for.
      message: typeof shape.message === 'string' ? shape.message : ''
    };
  }
  return { name: '', message: error === null || error === undefined ? '' : String(error) };
}

/**
 * The message off whatever was thrown, read by shape and never by class.
 *
 * The one-liner this replaces, `e instanceof Error ? e.message : String(e)`, is wrong
 * twice over: `instanceof` misses an error from another copy of a library or one that has
 * crossed a realm, and `String(e)` **throws** on an object made with
 * `Object.create(null)`, which is what a structured clone can produce. Two of the places
 * it was used show their result to a member.
 */
export const reasonOf = (error: unknown): string => guestReason(errorShape(error).message);

/**
 * The zome's own sentence, pulled out of whatever the conductor wrapped it in.
 *
 * A `wasm_error!(Guest("..."))` does not reach the client as that sentence. `catchError`
 * in `@holochain/client` builds `HolochainError(response.value.type,
 * response.value.value)`, and for a guest error the value is the conductor's own
 * rendering of a ribosome error, with our text inside it. Showing that to a member means
 * showing them wire text.
 *
 * So the innermost `Guest("...")` is unwrapped when it is there, and anything else is
 * returned untouched. **Written to tolerate not knowing the wrapper's exact shape**: the
 * one thing it must never do is lose the message, so an unrecognised shape passes
 * straight through rather than being replaced by a guess.
 */
/**
 * Did the zome refuse this for length?
 *
 * The composer disables Send past the limit, so this is a backstop: it catches a message
 * that grew between the check and the call, or a client that skipped the check. Matched
 * on a fragment of `message.rs`'s "Message content is {n} bytes, over the {max} byte
 * limit", because the numbers in it vary.
 */
export function isTooLong(reason: string | undefined | null): boolean {
  return /message content is \d+ bytes, over the/i.test(reason ?? '');
}

export function guestReason(raw: string): string {
  const match = /Guest\((?:"((?:[^"\\]|\\.)*)"|'([^']*)')\)/.exec(raw);
  const inner = match?.[1] ?? match?.[2];
  if (inner === undefined) return raw;
  // Rust's Debug escaping, undone: the text was a plain sentence before it was wrapped.
  return inner.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}

/**
 * The largest message the zome will accept, in **bytes, not characters**.
 *
 * Mirrors `MAX_CONTENT_BYTES` in `coordinator/messaging/src/message.rs:35`, which checks
 * `content.len()` — and Rust's `String::len` is the UTF-8 byte length. A character
 * counter would be wrong for anyone not writing in ASCII: one emoji is four bytes, and
 * most accented letters are two, so a member writing in a language with accents would be
 * refused while the counter still showed room.
 */
export const MAX_CONTENT_BYTES = 16 * 1024;

/** How many UTF-8 bytes this text takes, which is what the zome measures. */
export function contentBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Bytes still available. Negative once the message is too long to send. */
export function bytesLeft(text: string): number {
  return MAX_CONTENT_BYTES - contentBytes(text);
}

/**
 * How much of the budget this text uses, as a whole percent.
 *
 * **Floored**, so it never claims the limit is reached before it is: 16,383 bytes reads
 * as 99%, not 100%.
 */
export function percentUsed(text: string): number {
  return Math.floor((contentBytes(text) / MAX_CONTENT_BYTES) * 100);
}

/**
 * How far past the limit this text is, as a whole percent.
 *
 * **Ceilinged**, the opposite of `percentUsed` and for the same reason: neither should
 * understate the problem. 20,001 bytes is 22.08% over and reads as 23%.
 */
export function percentOver(text: string): number {
  const over = contentBytes(text) - MAX_CONTENT_BYTES;
  if (over <= 0) return 0;
  return Math.ceil((over / MAX_CONTENT_BYTES) * 100);
}

/**
 * How many messages this text would have to be split into.
 *
 * The byte size over the limit, rounded up, so anything past the limit is at least two.
 * It is a guide rather than a promise: where the splits fall is the member's choice, and
 * splitting mid-word or mid-sentence is not something to do for them.
 */
export function messagesNeeded(text: string): number {
  return Math.max(1, Math.ceil(contentBytes(text) / MAX_CONTENT_BYTES));
}

/**
 * A thread's identity: the counterparty's `User`, base64.
 *
 * **Keyed by `User`, never by agent.** A member may run several devices and each has its
 * own `AgentPubKey`; the zome encrypts one copy per agent, so the same person's messages
 * arrive under different keys. Keying by agent would split one person into a row per
 * device, which is what the brief's break-it-on-purpose test demonstrates.
 */
export type ThreadKey = string;

export const threadKeyOf = (user: ActionHash): ThreadKey => encodeHashToBase64(user);

/** A message that could not be decrypted. A fault, never a filter: see the zome. */
export type Fault = {
  hash: ActionHash;
  from: AgentPubKey;
  at: number;
};

/**
 * A message with the one thing the zome's shape does not say directly: whose it is.
 *
 * `Message.from` is an agent key, and knowing whether it is one of mine would mean
 * holding every one of my own agent keys. The source already answers it — an inbox copy
 * was addressed to me, a sent copy by me — so it is recorded once here instead of being
 * re-derived at every call site.
 */
export type ThreadMessage = Message & { mine: boolean };

/** One conversation, one person. */
export type UIThread = {
  counterparty: ActionHash;
  key: ThreadKey;
  /** Personal messages only, oldest first. */
  messages: ThreadMessage[];
  /** Listings either of you has shown interest in, between the two of you. */
  interests: UIInterest[];
  /** Exchanges between the two of you. */
  exchanges: UIExchange[];
  /** The latest thing that happened, for sorting the list. */
  lastAt: number;
  /** Messages from them that arrived after this thread's read marker. */
  unread: number;
  archived: boolean;
};

/** What the "Show" filter offers. */
export type ThreadFilter =
  | 'all'
  | 'unopened'
  | 'offers'
  | 'requests'
  | 'exchanges'
  | 'archived';

/**
 * Holochain timestamps are microseconds. Everything in this module is milliseconds, so
 * that one conversion happens here rather than at each comparison.
 */
export const toMillis = (micros: number): number => Math.floor(micros / 1000);

const sameHash = (a: ActionHash, b: ActionHash) => encodeHashToBase64(a) === encodeHashToBase64(b);

/**
 * Only personal messages. A role message is somebody's correspondence with the admins
 * and belongs in its own area.
 *
 * **`get_inbox` already drops them, `get_sent` does not**, and that is correct of both:
 * the inbox is what a member is shown, while `get_sent` is everything this agent wrote,
 * which legitimately includes role messages. Deciding what Messages shows is this layer's
 * job, so the filter lives here and applies to both sources rather than relying on one of
 * them having done it.
 */
export const isPersonal = (message: Message): boolean => message.role === undefined;

/**
 * Build one thread per counterparty.
 *
 * Threads are seeded from four sources, not only from messages: showing interest in a
 * listing opens a conversation before a word is written, so a member with an interest and
 * no messages still has a row.
 *
 * `agentToUser` resolves a message's author or recipient agent to the `User` that owns
 * it. A message whose agent will not resolve is dropped rather than given a thread of its
 * own, because a thread with no `User` cannot be opened, replied to or marked read.
 */
export function buildThreads(input: {
  me: ActionHash;
  inbox: Message[];
  sent: Message[];
  exchanges: UIExchange[];
  /** Interests either side has shown, each with the `User` on the other end. */
  interests: Array<{ interest: UIInterest; counterparty: ActionHash }>;
  agentToUser: (agent: AgentPubKey) => ActionHash | undefined;
  /** How far this member has read each conversation, thread key to milliseconds. */
  readUpTo: Readonly<Record<ThreadKey, number>>;
  archivedKeys: ReadonlySet<ThreadKey>;
}): UIThread[] {
  const threads = new Map<ThreadKey, UIThread>();

  const ensure = (counterparty: ActionHash): UIThread => {
    const key = threadKeyOf(counterparty);
    let thread = threads.get(key);
    if (!thread) {
      thread = {
        counterparty,
        key,
        messages: [] as ThreadMessage[],
        interests: [],
        exchanges: [],
        lastAt: 0,
        unread: 0,
        archived: input.archivedKeys.has(key)
      };
      threads.set(key, thread);
    }
    return thread;
  };

  // Messages they sent me: the counterparty is the author.
  for (const message of input.inbox.filter(isPersonal)) {
    const user = input.agentToUser(message.from);
    if (!user) continue;
    ensure(user).messages.push({ ...message, mine: false });
  }

  // Messages I sent: the counterparty is the agent the copy was encrypted to.
  for (const message of input.sent.filter(isPersonal)) {
    const user = input.agentToUser(message.to);
    // My own copy of a role message reaches my inbox as well; `isPersonal` has already
    // dropped it. Skipping myself here covers the case where a copy was addressed to
    // another of my own agents.
    if (!user || sameHash(user, input.me)) continue;
    ensure(user).messages.push({ ...message, mine: true });
  }

  for (const exchange of input.exchanges) {
    const other = counterpartyOfExchange(exchange, input.me);
    if (!other) continue;
    ensure(other).exchanges.push(exchange);
  }

  for (const { interest, counterparty } of input.interests) {
    if (sameHash(counterparty, input.me)) continue;
    ensure(counterparty).interests.push(interest);
  }



  for (const thread of threads.values()) {
    thread.messages = collapseCopies(thread.messages).sort((a, b) => a.at - b.at);

    const readUpTo = input.readUpTo[thread.key] ?? 0;
    thread.unread =
      thread.messages.filter((m) => !m.mine && toMillis(m.at) > readUpTo).length +
      unreadCards(thread.exchanges, input.me, readUpTo);

    // **A new message brings an archived conversation back** (Sam, 4 October). Archiving
    // is "I am done with this for now", not "never show me this person again", and the
    // alternative is a message that arrives into a folder nobody opens. It returns to All
    // and stays marked unopened, so it is visible as something new rather than quietly
    // restored. The store persists the un-archiving, so it does not re-archive on the next
    // load.
    if (thread.archived && thread.unread > 0) {
      thread.archived = false;
    }

    thread.lastAt = Math.max(
      ...[
        0,
        ...thread.messages.map((m) => toMillis(m.at)),
        ...thread.exchanges.map((e) => e.created_at ?? 0),
        ...thread.interests.map((i) => i.created_at ?? 0)
      ]
    );
  }

  return [...threads.values()].sort((a, b) => b.lastAt - a.lastAt);
}

/**
 * Cards in this conversation that arrived since it was last opened.
 *
 * **A card counts exactly as a message does** (Sam, 4 October). A proposal arriving used
 * to leave its conversation looking quiet while adding to a separate exchanges number, so
 * one event was counted twice in one place and not at all in the other.
 *
 * Two things can be new to me on an exchange, and only one of them can be mine:
 *
 * - **the proposal**, when somebody else wrote it;
 * - **the answer to it**, accept or decline, when I wrote the proposal and they replied.
 *
 * Whoever did not write the agreement is the one who answers it, so authorship of the
 * agreement decides both. An exchange I proposed and they have not answered is not
 * unread: nothing has happened since I last looked.
 */
function unreadCards(exchanges: UIExchange[], me: ActionHash, readUpTo: number): number {
  let count = 0;
  for (const exchange of exchanges) {
    // `counterparty` names whoever did *not* write the agreement, so I wrote it exactly
    // when I am not the counterparty.
    const iWroteIt = !sameHash(exchange.agreement.counterparty, me);

    if (!iWroteIt && (exchange.created_at ?? 0) > readUpTo) count += 1;
    if (iWroteIt && exchange.response && (exchange.response.created_at ?? 0) > readUpTo) {
      count += 1;
    }
  }
  return count;
}

/**
 * How many conversations have something unopened in them.
 *
 * **Conversations, counted once** (Sam, 4 October). A conversation holding an unread
 * message and an unread proposal is one thing to look at, not two, and the badge and the
 * Messages list both read this so they cannot disagree.
 */
export function unopenedConversations(threads: UIThread[]): number {
  return threads.filter((t) => t.unread > 0).length;
}

/**
 * Which archived threads a new message has brought back, for the caller to persist.
 *
 * Separate from `buildThreads` so the pure function stays pure: it decides, the store
 * writes. Recomputed from the same inputs, so the two cannot disagree.
 */
export function unarchivedByNewMessages(threads: UIThread[], archivedKeys: ReadonlySet<ThreadKey>): ThreadKey[] {
  return threads.filter((t) => !t.archived && archivedKeys.has(t.key)).map((t) => t.key);
}

/**
 * Collapse the copies of one logical message into one row.
 *
 * **The zome stores one entry per recipient *agent***, because it encrypts to an agent
 * key rather than to a person. Writing to someone who runs two devices therefore puts two
 * entries on my chain, and `get_sent` returns both: without this, every message to that
 * person would appear twice in our own conversation.
 *
 * The copies have different action hashes and timestamps a few milliseconds apart, so
 * there is nothing exact to group by. They are collapsed on author, side, content and the
 * second they were written in, keeping the earliest.
 *
 * **What that costs:** the same person sending the identical text twice inside one second
 * shows once. That is a worse outcome than showing a duplicate only in a case a member
 * has to work at, and this is the cheaper of the two mistakes. The clean fix is a per-send
 * identifier in the message body, which is a zome change and so belongs to a brief that
 * touches the zome, not to this one.
 */
function collapseCopies(messages: ThreadMessage[]): ThreadMessage[] {
  const byIdentity = new Map<string, ThreadMessage>();
  for (const message of messages) {
    const identity = [
      encodeHashToBase64(message.from),
      message.mine ? 'mine' : 'theirs',
      Math.floor(toMillis(message.at) / 1000),
      message.content
    ].join('\u0000');
    const existing = byIdentity.get(identity);
    if (!existing || message.at < existing.at) byIdentity.set(identity, message);
  }
  return [...byIdentity.values()];
}

/** The `User` on the other end of an exchange, or undefined if I am not in it. */
export function counterpartyOfExchange(
  exchange: UIExchange,
  me: ActionHash
): ActionHash | undefined {
  const { counterparty, provider, receiver } = exchange.agreement;
  if (sameHash(counterparty, me)) {
    // I am the counterparty, so the other side is whichever of the two parties is not me.
    return sameHash(provider, me) ? receiver : provider;
  }
  return counterparty;
}

/**
 * Does a thread belong under this filter?
 *
 * "Offers" and "Requests" mean a conversation carrying an interest or proposal card of
 * that type, which is why they read the cards rather than the messages.
 *
 * **Archived is a view, not a state.** Every other filter hides archived threads, and
 * "Archived" shows only those, so a conversation is never in two places at once.
 */
export function matchesFilter(thread: UIThread, filter: ThreadFilter): boolean {
  if (filter === 'archived') return thread.archived;
  if (thread.archived) return false;

  switch (filter) {
    case 'all':
      return true;
    case 'unopened':
      return thread.unread > 0;
    case 'exchanges':
      return thread.exchanges.length > 0;
    case 'offers':
      return hasListingType(thread, 'Offer');
    case 'requests':
      return hasListingType(thread, 'Request');
  }
}

function hasListingType(thread: UIThread, type: ListingType): boolean {
  return (
    thread.interests.some((i) => i.listing_type === type) ||
    thread.exchanges.some((e) => e.agreement.listing_type === type)
  );
}

// ============================================================================
// THE CONVERSATION TIMELINE
// ============================================================================

/** One thing in a conversation, in time order with everything else. */
export type TimelineItem =
  | { kind: 'message'; at: number; message: ThreadMessage }
  | { kind: 'interest'; at: number; interest: UIInterest }
  | { kind: 'exchange'; at: number; exchange: UIExchange };

/**
 * The listings these two people may propose from, split by whose they are.
 *
 * **A listing is proposable when one of you has shown interest in the other's.**
 * A thread's interests are already exactly the interests between these two
 * people, so the eligible listings are the ones those interests name and nothing else
 * needs fetching to decide it.
 *
 * Whose a listing is follows from who showed the interest, with no lookup: if I showed
 * interest, the listing is theirs; if they did, it is mine. A member cannot show interest
 * in their own listing, so the two groups cannot overlap.
 */
export function proposableFrom(
  thread: UIThread,
  me: ActionHash
): { theirs: UIInterest[]; yours: UIInterest[] } {
  const theirs: UIInterest[] = [];
  const yours: UIInterest[] = [];
  for (const interest of thread.interests) {
    if (sameHash(interest.user, me)) theirs.push(interest);
    else yours.push(interest);
  }
  return { theirs, yours };
}

/**
 * Does this exchange read as an agreement, or as a proposal still being decided?
 *
 * One record, two appearances, because that is how a conversation reads: the proposal is
 * the thing being decided, the line is the decision.
 *
 * **A declined proposal stays a card**, which is why `Declined` is named here rather than
 * left to a catch-all. The card is what carries the reason the other person gave, and
 * collapsing it to a line would throw that away at the moment it matters most.
 * `Cancelled` likewise: a cancelled exchange had an agreement, so it keeps the line.
 */
export function showsAsAgreement(status: string): boolean {
  return status !== 'Proposed' && status !== 'Declined';
}

/**
 * Messages and cards in one list, oldest first.
 *
 * A proposal belongs where it happened, between the messages that led to it and the ones
 * that followed, which is the whole point of putting cards inside the conversation.
 *
 * **An exchange keeps the proposal's place for its whole life.** The time used is the
 * agreement record's, never the response's, so accepting something does not move it down
 * the conversation to the moment it was accepted. The messages either side of it would
 * otherwise reshuffle around an event that had already been read in place. Ties
 * are broken by kind so the order is stable rather than depending on the input: an
 * interest opened the conversation, so it sorts before a message at the same instant.
 */
export function buildTimeline(thread: UIThread): TimelineItem[] {
  const items: TimelineItem[] = [
    ...thread.interests.map((interest) => ({
      kind: 'interest' as const,
      at: interest.created_at ?? 0,
      interest
    })),
    ...thread.messages.map((message) => ({
      kind: 'message' as const,
      at: toMillis(message.at),
      message
    })),
    ...thread.exchanges.map((exchange) => ({
      kind: 'exchange' as const,
      at: exchange.created_at ?? 0,
      exchange
    }))
  ];

  const rank = { interest: 0, exchange: 1, message: 2 };
  return items.sort((a, b) => a.at - b.at || rank[a.kind] - rank[b.kind]);
}
