import {
  decodeHashFromBase64,
  encodeHashToBase64,
  type ActionHash,
  type AgentPubKey
} from '@holochain/client';
import { Effect as E } from 'effect';
import {
  MessagingServiceTag,
  MessagingServiceLive,
  type MessagingService
} from '$lib/services/zomes/messaging.service';
import holochainClientService, {
  HolochainClientServiceLive,
  HolochainClientServiceTag
} from '$lib/services/HolochainClientService.svelte';
import { Schema } from 'effect';
import { MessagingError } from '$lib/errors/messaging.errors';
import {
  MessagingSignalSchema,
  type InboxEntry,
  type Message
} from '$lib/schemas/messaging.schemas';
import type { UIInterest } from '$lib/types/ui';
import {
  EMPTY_LOCAL,
  localKey,
  type OutboxItem,
  readLocal,
  writeLocal,
  type LocalStore,
  type BlockEvent,
  type MessagingLocalState,
  type ReceiptSetting
} from '$lib/utils/messaging-local';
import {
  applyBlocks,
  buildThreads,
  clampReceipt,
  readableUpTo,
  receiptPlan,
  receiptsEnabledFor,
  classifySendFailure,
  unarchivedByNewMessages,
  isPersonal,
  threadKeyOf,
  toMicros,
  toMillis,
  type Fault,
  type ThreadKey,
  type UIThread
} from '$lib/utils/messaging-threads';
import usersStore from '$lib/stores/users.store.svelte';
import { getMyAgentPubKey } from '$lib/utils/holochain-client.utils';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import requestsStore from '$lib/stores/requests.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';

/**
 * The Messages screens' state.
 *
 * The assembly rules live in `utils/messaging-threads.ts` as pure functions and are
 * tested there. This layer does the fetching, the agent-to-`User` resolution the zome
 * cannot do for us, and the two pieces of local state the DHT does not hold: which
 * conversations are archived, and which messages are waiting to go out.
 */

// ============================================================================
// LOCAL STATE: ARCHIVE AND OUTBOX
// ============================================================================

/**
 * Local state lives in one versioned namespace, keyed by **my own agent key**.
 *
 * `AGENTS=3 bun start` runs three agents in one browser profile, and an unkeyed name
 * would give all three the same archive and the same outbox. The rules for reading and
 * writing it, including what happens when the stored version is one this build does not
 * know, are in `utils/messaging-local.ts` where they can be tested.
 */
const keyFor = (me: AgentPubKey) => localKey(encodeHashToBase64(me));

export type { OutboxItem };

/** How often to try the outbox again while anything is waiting. */
const RETRY_INTERVAL_MS = 30_000;

/**
 * How far before the first attempt `find_sent` starts looking. This device stamps the
 * moment Send was pressed; the conductor stamps the links. They are the same machine in
 * the desktop app, so this only has to cover rounding and a clock stepping.
 */
const SEND_CLOCK_MARGIN_MS = 5_000;

const storage = (): LocalStore | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage;

const readFor = (me: AgentPubKey | null) => (me ? readLocal(storage(), keyFor(me)) : EMPTY_LOCAL);

const writeFor = (me: AgentPubKey | null, patch: Partial<MessagingLocalState>) =>
  me ? writeLocal(storage(), keyFor(me), patch) : false;

// ============================================================================
// THE STORE
// ============================================================================

export type MessagingStore = {
  readonly threads: UIThread[];
  /** Messages that would not decrypt. A fault, never a filter: the row says so. */
  readonly faults: Fault[];
  readonly outbox: OutboxItem[];
  readonly loading: boolean;
  /** False until the first read of the conversations has finished. */
  readonly everLoaded: boolean;
  readonly error: string | null;

  loadConversations: () => E.Effect<UIThread[], MessagingError>;
  threadFor: (counterparty: ActionHash) => UIThread | undefined;
  /** `listing` sends a card-only message; the zome refuses one carrying text as well. */
  send: (
    counterparty: ActionHash,
    content: string,
    listing?: ActionHash
  ) => E.Effect<void, MessagingError>;
  markThreadRead: (counterparty: ActionHash) => void;
  receiveReceipt: (from: ActionHash, claimed: number) => void;
  theirReadUpTo: (counterparty: ActionHash) => number;
  receiptsOn: (counterparty: ActionHash) => boolean;
  receiptSettingFor: (counterparty: ActionHash) => ReceiptSetting;
  receiptsOverall: () => boolean;
  /** Whether this member has been told what a proposal and a message put out. */
  noticeSeen: () => boolean;
  markNoticeSeen: () => void;
  setReceiptsOverall: (on: boolean) => void;
  setReceiptsForChat: (counterparty: ActionHash, setting: ReceiptSetting) => void;
  setArchived: (counterparty: ActionHash, archived: boolean) => void;
  setBlocked: (counterparty: ActionHash, blocked: boolean) => void;
  isBlocked: (counterparty: ActionHash) => boolean;
  blockedUsers: () => string[];
  blockHistory: () => BlockEvent[];
  /** Send everything waiting, oldest first. Called on a timer and when the network returns. */
  flushOutbox: () => E.Effect<void, never>;
  /** Start the retry timer, app-wide. Returns the stopper, for the layout's teardown. */
  startRetrying: () => () => void;
  /** Subscribe to nudges and receipts, app-wide. Returns the unsubscribe. */
  listen: () => () => void;
  /** Try one message again, because the member asked. */
  retryUnsent: (id: string) => E.Effect<void, never>;
  /** Keep a message the zome refused after the member had left its conversation. */
  keepRefused: (counterparty: ActionHash, content: string, reason: string) => void;
  /** Drop one message from the outbox, because the member asked. */
  discardUnsent: (id: string) => void;
};

/** Exported for the unit tests, which want a store that has loaded nothing yet. */
export function createMessagingStore(): MessagingStore {
  let threads = $state<UIThread[]>([]);
  let faults = $state<Fault[]>([]);
  let outbox = $state<OutboxItem[]>([]);
  let loading = $state(false);
  /** Has any read of the conversations finished, well or badly? */
  let everLoaded = $state(false);
  let error = $state<string | null>(null);

  /**
   * My own agent key, which every read and write of local state is keyed by.
   *
   * **Resolved the first time anything asks, not at the end of the first load.** It used
   * to be set after the inbox, the sent list, the exchanges and the interests had all been
   * read, and until then every local write returned `false` without writing: a member who
   * turned receipts off on a freshly opened Messages page, or was told the first-contact
   * notice and said go on, had it silently dropped. The profile is known long before the
   * conversations are, so there is nothing to wait for.
   */
  let myAgent: AgentPubKey | null = null;
  const myAgentKey = (): AgentPubKey | null => (myAgent ??= myAgentOf());

  /**
   * A reactive mirror of this member's local state.
   *
   * **Local storage is not a signal.** Nothing in Svelte watches it, so a page that asked
   * `isBlocked` or `blockedUsers` straight from storage computed its answer once at mount
   * and never again: Unblock lifted the block and left the row on the screen, and Block
   * on a conversation left the Block button showing. Every read below touches the mirror,
   * and every write and every load refreshes it, so a screen that reads a block, a
   * receipt setting or a read mark re-renders when one changes.
   *
   * `null` until the first load or write fills it; until then a read is answered from
   * storage, but has still touched the mirror, so it re-runs once the mirror is filled.
   * A patch that storage refused (private browsing, a full quota) is kept in the mirror
   * anyway, so the screen shows what the member just did even though it will not survive
   * a reload.
   */
  let mirror = $state<MessagingLocalState | null>(null);

  const localState = (): MessagingLocalState => mirror ?? readFor(myAgentKey());

  const write = (patch: Partial<MessagingLocalState>): boolean => {
    const key = myAgentKey();
    const ok = writeFor(key, patch);
    mirror = ok ? readFor(key) : { ...localState(), ...patch };
    return ok;
  };

  /**
   * Bring in whatever outbox this device already holds.
   *
   * **Before anything reads or writes the outbox, not after the first successful read
   * of the conversations.** The list in memory starts empty and used to be filled only at
   * the end of that read. If any of its five calls failed, the stored messages were never
   * retried, and the next held send wrote the in-memory list (the new message alone) over
   * them: a member's unsent message gone without a trace. Everything that touches the
   * outbox calls this first. Items already in memory are kept, so a message that storage
   * refused to keep is not dropped by adopting what storage has.
   */
  let outboxAdopted = false;
  /**
   * Ids this store has finished with: sent, found already sent, or discarded.
   *
   * An item is taken out of memory and out of storage together, but storage can refuse
   * the write (a full quota, private browsing) and still hold the old list. Anything
   * read back from storage is checked against this, so a message the member discarded,
   * or one that went, does not come back and get sent.
   */
  const gone = new Set<string>();
  const dropFromOutbox = (id: string): void => {
    gone.add(id);
    outbox = outbox.filter((q) => q.id !== id);
    write({ outbox });
  };
  const adoptOutbox = (): void => {
    if (outboxAdopted) return;
    const key = myAgentKey();
    if (!key) return;
    outboxAdopted = true;
    const held = new Set(outbox.map((item) => item.id));
    outbox = [...readFor(key).outbox.filter((item) => !held.has(item.id)), ...outbox];
  };

  const withServices = <A>(
    body: (
      service: MessagingService,
      client: { isConnected: boolean }
    ) => E.Effect<A, MessagingError>
  ): E.Effect<A, MessagingError> =>
    E.gen(function* () {
      const service = yield* MessagingServiceTag;
      const client = yield* HolochainClientServiceTag;
      return yield* body(service, client);
    }).pipe(E.provide(MessagingServiceLive), E.provide(HolochainClientServiceLive)) as E.Effect<
      A,
      MessagingError
    >;

  /**
   * The error that was actually thrown, out from under our own wrapper.
   *
   * `MessagingError` is app code with one copy in the bundle, so `instanceof` is safe
   * for it, unlike the client's classes. What it wraps is not ours and is read by shape.
   */
  const causeOf = (e: unknown): unknown =>
    e instanceof MessagingError && e.cause !== undefined ? e.cause : e;

  const myUserHash = (): ActionHash | undefined =>
    usersStore.currentUser?.original_action_hash ?? undefined;

  /**
   * Resolve every agent we have seen to the `User` that owns it.
   *
   * One lookup per distinct agent, not per message: a conversation of forty messages is
   * two agents. A member with two devices resolves both to one `User`, which is what
   * keeps them one row.
   */
  const resolveAgents = (agents: AgentPubKey[]) =>
    E.gen(function* () {
      const map = new Map<string, ActionHash>();
      const distinct = [...new Map(agents.map((a) => [encodeHashToBase64(a), a])).values()];
      for (const agent of distinct) {
        const user = yield* usersStore
          .getUserByAgentPubKey(agent)
          .pipe(E.catchAll(() => E.succeed(null)));
        if (user?.original_action_hash) {
          map.set(encodeHashToBase64(agent), user.original_action_hash);
        }
      }
      return map;
    });

  /** A read from another store, as this store's own fault. */
  const asFault = (context: string) => (e: unknown) => MessagingError.fromError(e, context);

  /**
   * Every interest that concerns me, with the `User` on the other end.
   *
   * Two directions, and both are needed: the listings I have shown interest in, where
   * the counterparty is the listing's author, and the interests other people have shown
   * in mine, where the counterparty is the interested member. Only the first would miss
   * the person who has just pressed Show interest on my offer, which is exactly when a
   * conversation should appear.
   *
   * **A read that fails, fails the load.** Each of these used to be read as "none" when
   * it failed, so a conversation whose only content was an interest vanished from
   * Messages and from the badge, with no error shown. A listing read and found absent
   * (`null`) is a different thing and is skipped: there is no one to talk to about it.
   */
  const loadInterests = (
    me: ActionHash
  ): E.Effect<Array<{ interest: UIInterest; counterparty: ActionHash }>, MessagingError> =>
    E.gen(function* () {
      const out: Array<{ interest: UIInterest; counterparty: ActionHash }> = [];

      const mine = yield* exchangesStore
        .getMyInterests()
        .pipe(E.mapError(asFault('reading the listings you are interested in')));
      for (const interest of mine) {
        const listing =
          interest.listing_type === 'Request'
            ? yield* requestsStore
                .getRequest(interest.listing)
                .pipe(E.mapError(asFault('reading a listing you are interested in')))
            : yield* offersStore
                .getOffer(interest.listing)
                .pipe(E.mapError(asFault('reading a listing you are interested in')));
        if (listing?.creator) out.push({ interest, counterparty: listing.creator });
      }

      const myListings = [
        ...(yield* requestsStore
          .getMyListings(me)
          .pipe(E.mapError(asFault('reading your requests')))),
        ...(yield* offersStore.getMyListings(me).pipe(E.mapError(asFault('reading your offers'))))
      ];
      for (const listing of myListings) {
        if (!listing.original_action_hash) continue;
        const interests = yield* exchangesStore
          .getInterestsForListing(listing.original_action_hash)
          .pipe(E.mapError(asFault('reading who is interested in your listing')));
        for (const interest of interests) {
          out.push({ interest, counterparty: interest.user });
        }
      }

      return out;
    });

  /**
   * Every inbox entry this agent has read, by hash, so a poll fetches only what is new.
   *
   * A message never changes once written, and the poll runs every fifteen seconds for
   * as long as the app is open, so `get_inbox` was fetching every message a member had
   * ever received, every fifteen seconds (Sacha's review of #301, 7 October). Now the
   * zome is told what is held, lists what should still show, and sends only the rest.
   * A hash it stops listing (its author is no longer accepted, say) is dropped here, so
   * the reading-side filters still apply to a message read long ago. Unreadable entries
   * are held too, so a fault is not re-fetched every poll.
   *
   * Keyed by this agent, so a profile change on the same device starts clean.
   */
  let held = new Map<string, InboxEntry>();
  let heldFor: string | null = null;
  /**
   * The role messages in this inbox, as the last poll listed them. Not shown here (the
   * role inbox reads them its own way); handed back so the zome does not fetch and
   * decrypt each one again on every poll to find out it is not personal chat.
   */
  let skippedRoleMessages: string[] = [];

  const loadConversations = (): E.Effect<UIThread[], MessagingError> =>
    withServices((service) =>
      E.gen(function* () {
        loading = true;
        error = null;

        const me = myUserHash();
        if (!me) {
          // No profile yet: nothing to show, and not an error worth a red screen.
          threads = [];
          faults = [];
          loading = false;
          everLoaded = true;
          return [];
        }

        const agentKey = myAgentKey();
        const agentId = agentKey ? encodeHashToBase64(agentKey) : null;
        if (agentId !== heldFor) {
          held = new Map();
          skippedRoleMessages = [];
          heldFor = agentId;
        }
        const delta = yield* service.getInboxDelta(
          [...held.keys()].map((key) => decodeHashFromBase64(key)),
          skippedRoleMessages.map((key) => decodeHashFromBase64(key))
        );
        skippedRoleMessages = delta.skipped.map((hash) => encodeHashToBase64(hash));
        const visible = new Set(delta.visible.map((hash) => encodeHashToBase64(hash)));
        for (const key of [...held.keys()]) if (!visible.has(key)) held.delete(key);
        for (const entry of delta.entries) held.set(encodeHashToBase64(entry.hash), entry);
        const entries = [...held.values()];
        const inbox: Message[] = [];
        const seenFaults: Fault[] = [];
        for (const entry of entries) {
          if (entry.type === 'Read') inbox.push(entry);
          else seenFaults.push({ hash: entry.hash, from: entry.from, at: toMillis(entry.at) });
        }

        const sent = yield* service.getSent();

        const exchanges = yield* exchangesStore
          .loadMyExchanges()
          .pipe(E.mapError(asFault('reading your exchanges')));
        const interests = yield* loadInterests(me);

        const agentToUserMap = yield* resolveAgents([
          ...inbox.map((m) => m.from),
          ...seenFaults.map((f) => f.from),
          ...sent.filter(isPersonal).map((m) => m.to)
        ]);
        const agentToUser = (agent: AgentPubKey) => agentToUserMap.get(encodeHashToBase64(agent));

        // Filled from storage on every load, so a change made on another tab, or by a
        // write this screen did not see, reaches the screen with the next poll.
        const local = (mirror = readFor(myAgentKey()));
        const archivedKeys = new Set<ThreadKey>(local.archived);
        // What storage holds, plus anything held in memory that storage refused to keep.
        outboxAdopted = true;
        const stored = new Set(local.outbox.map((item) => item.id));
        // Where both hold an item, this store's copy is the newer: storage that refused
        // a write still says "waiting" about a message since refused.
        const inMemory = new Map(outbox.map((item) => [item.id, item]));
        outbox = [
          ...local.outbox
            .filter((item) => !gone.has(item.id))
            .map((item) => inMemory.get(item.id) ?? item),
          ...outbox.filter((item) => !stored.has(item.id))
        ];

        // **Where blocking is applied to what was read.** Everything below reads from
        // this list, so the personal threads, the role inbox and a member's own
        // correspondence all get the same answer without the rule being written three
        // times. A message from a blocked person that could not be read is dropped by
        // the same rule: a fault row names its sender, and a blocked person is not shown.
        // (Signals are the other place: `listen` asks `isBlockedAgent`.)
        const blocked = new Set(local.blocked);
        const visibleInbox = applyBlocks(inbox, agentToUser, blocked);
        const visibleFaults = seenFaults.filter((fault) => {
          const person = agentToUser(fault.from);
          return !(person && blocked.has(threadKeyOf(person)));
        });

        threads = buildThreads({
          me,
          inbox: visibleInbox,
          sent,
          exchanges,
          interests,
          agentToUser,
          readUpTo: local.readUpTo,
          archivedKeys
        });
        faults = visibleFaults;

        // **The mark that rides in a message body.** A reader's `read_up_to` reaches this
        // agent in the body of their next message as well as by signal, which is what
        // brings a receipt lost while this agent was offline. It is recorded exactly as
        // a signal is: resolved to the person, then clamped to what was actually sent
        // them. Nothing here was read before, so Read could only ever come by signal.
        for (const m of visibleInbox) {
          if (m.readUpTo === undefined) continue;
          const person = agentToUser(m.from);
          if (person) receiveReceipt(person, toMillis(m.readUpTo));
        }

        // A new message brought these back to All. Persist it, or the next load would
        // archive them again and the member would lose the same message twice.
        const returned = unarchivedByNewMessages(threads, archivedKeys);
        if (returned.length > 0) {
          write({
            archived: [...archivedKeys].filter((k) => !returned.includes(k))
          });
        }

        loading = false;
        everLoaded = true;
        return threads;
      }).pipe(
        E.catchAll((e) => {
          loading = false;
          everLoaded = true;
          error = e instanceof MessagingError ? e.message : String(e);
          return E.fail(e as MessagingError);
        })
      )
    );

  /**
   * My own agent key: the one this installation's client runs as.
   *
   * Read from the client, not the profile. `currentUser` is the profile record, and
   * nothing fills its `agents` list, so asking it gave `null`: every local write was
   * refused, and the next load replaced what the screen had just shown with an empty
   * state. Blocks, archives, read marks, receipt settings and the outbox were never saved.
   */
  const myAgentOf = (): AgentPubKey | null => getMyAgentPubKey();

  const threadFor = (counterparty: ActionHash) =>
    threads.find((t) => t.key === threadKeyOf(counterparty));

  /**
   * The outbox item's id **is** the send id carried in the message body.
   *
   * One identity rather than two. It is what the zome stores, what every reader
   * collapses copies by, and what `find_sent` looks for when an answer is lost, so there
   * is nothing to keep in step.
   */
  const newSendId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const queue = (
    counterparty: ActionHash,
    content: string,
    id: string,
    pressedAt: number,
    listing?: ActionHash
  ) => {
    const item: OutboxItem = {
      id,
      to: threadKeyOf(counterparty),
      content,
      ...(listing ? { listing: encodeHashToBase64(listing) } : {}),
      queuedAt: pressedAt,
      state: 'waiting'
    };
    adoptOutbox();
    outbox = [...outbox, item];
    write({ outbox });
  };

  /**
   * Send one message, or hold it if this device cannot reach the recipient right now.
   *
   * **Two outcomes offline, and only one of them needs an outbox.** `send_message` reads
   * the recipient's agent keys with `GetStrategy::Network`, which
   * `holochain_zome_types` 0.6 documents at `src/entry.rs:91-104` as falling back to
   * locally cached metadata:
   *
   * - **Warm cache.** The links are already here, the call succeeds, the entries are
   *   written to this agent's chain, and Holochain publishes them when it can. Nothing to
   *   queue, and nothing for a member to do.
   * - **Cold cache.** The lookup comes back empty and the zome answers
   *   `DEVICES_NOT_FOUND`. Nothing has been written. The message goes to the outbox.
   *
   * The second is matched on the zome's reason, not on the connection status. The
   * websocket to the local conductor stays up when the internet drops (Sam, 5 October), so
   * it would have said "connected" in exactly the case the outbox exists for.
   *
   * A call that got no answer at all is also held, with its send id, so the next run can
   * ask the chain whether it went. Every other failure is a real refusal and reaches the
   * member with the zome's reason.
   */
  const send = (
    counterparty: ActionHash,
    content: string,
    listing?: ActionHash
  ): E.Effect<void, MessagingError> => {
    const sendId = newSendId();
    // Where `find_sent` will start looking if this call's answer is lost: before the
    // call, with a margin for this device's clock against the conductor's. Taken when
    // the failure is noticed, it fell after an attempt that had in fact committed, the
    // search missed it, and the message went twice.
    const pressedAt = Date.now() - SEND_CLOCK_MARGIN_MS;
    // The read mark rides along, if this chat sends receipts. One rule decides this and
    // the signal, so a chat set to Off cannot leak through the other path.
    const local = localState();
    const key = threadKeyOf(counterparty);
    const plan = receiptPlan({
      setting: local.receiptsByChat[key],
      overall: local.receipts,
      myReadUpTo: local.readUpTo[key] ?? 0
    });
    const readUpTo = plan.readUpTo === undefined ? undefined : toMicros(plan.readUpTo);
    return withServices((service) =>
      service.sendMessage({ toUser: counterparty, content, sendId, listing, readUpTo }).pipe(
        E.asVoid,
        E.catchAll((e) => {
          // Classify the *cause*, never the wrapper. `MessagingError.fromError` prefixes
          // its context onto the message, and flattens anything that is not an `Error`
          // with `String(...)`, which turns a plain-object error from another copy of
          // the client into "[object Object]". The cause is the thing that was actually
          // thrown, and `classifySendFailure` reads its fields rather than its class.
          const failure = classifySendFailure(causeOf(e));
          // Nothing was written, so it is safe to hold and retry.
          if (failure.kind === 'devicesNotFound') {
            queue(counterparty, content, sendId, pressedAt, listing);
            return E.void;
          }
          // No answer: we do not know, and we do not guess. It goes to the outbox with
          // its send id, and the next flush asks the chain whether it went.
          if (failure.kind === 'noAnswer') {
            queue(counterparty, content, sendId, pressedAt, listing);
            return E.void;
          }
          return E.fail(e);
        })
      )
    );
  };

  /**
   * Send everything waiting, oldest first, and keep anything that does not go.
   *
   * **Gated on reachable peers, not on the websocket.** The conductor knows how many live
   * transport connections it has, through `getNetworkPeerStatus`, and that is the honest
   * answer to "is there any point trying": with none, every send would fail the same way
   * and only churn. With no peer information at all the run goes ahead, because refusing
   * to try is worse than trying and failing.
   *
   * **Exactly once, as far as this side can make it.** An item leaves the outbox only
   * after its own send succeeded, matched by `id`. A failure stops the run rather than
   * skipping on: if the connection has gone again the rest would fail too, and sending
   * later items first would reorder the conversation.
   *
   * **A send whose answer was lost is not sent twice.** Each item carries its send id,
   * which the zome keeps inside the message body, and the chain is asked for that id
   * (`find_sent`) before anything is sent again. If that question itself cannot be
   * answered the item is handed to the member as "may not have sent", not retried blind.
   */
  /**
   * The run in flight, if there is one. The timer, the browser's `online` event and a
   * member pressing "send again" can all ask at once, and two runs over the same item
   * each found it unsent and each sent it. A caller that arrives during a run waits for
   * that run instead of starting another.
   */
  let flushing: Promise<void> | null = null;

  const flushOutbox = (): E.Effect<void, never> =>
    E.promise(() => {
      flushing ??= E.runPromise(flushOnce()).finally(() => {
        flushing = null;
      });
      return flushing;
    });

  const flushOnce = (): E.Effect<void, never> =>
    E.gen(function* () {
      adoptOutbox();
      if (!outbox.some((item) => item.state === 'waiting')) return;

      const reachable = yield* E.promise(() =>
        holochainClientService
          .getNetworkPeerStatus()
          .then((status) => status.reachable)
          .catch(() => null)
      );
      if (reachable === 0) return;

      const waiting = outbox
        .filter((item) => item.state === 'waiting')
        .sort((a, b) => a.queuedAt - b.queuedAt);

      // Whoever a message could not reach, or could not be resolved for, in this run.
      // The rest of *their* messages wait, so a conversation stays in order, but nobody
      // else's do: one person being offline used to hold back every message to everyone.
      const stalled = new Set<ThreadKey>();

      for (const item of waiting) {
        if (stalled.has(item.to)) continue;

        // The item names its own recipient: the thread key is the counterparty's `User`
        // hash in base64. Looking the thread up instead meant a message to somebody with
        // no thread loaded yet was skipped for ever, silently.
        const counterparty = decodeHashFromBase64(item.to) as ActionHash;

        // Not `send`: that one queues on failure, which would add a second copy of
        // something already here. This call reports the reason instead, because the
        // reason is what decides whether retrying is safe.
        // **Ask before sending again.** A lost answer says nothing about whether the
        // call committed, so the chain is checked for this send id first. Found means it
        // went: drop it and move on. Not found means it did not, and sending again is
        // safe. Bounded by when the item was queued, so the check does not get slower as
        // a member's history grows.
        const already = yield* withServices((service) =>
          service.findSent({ sendId: item.id, since: toMicros(item.queuedAt) })
        ).pipe(
          E.map((hash) => ({ ok: true as const, hash })),
          E.catchAll(() => E.succeed({ ok: false as const, hash: null }))
        );

        // The list was taken when the run began, and a run waits on the conductor for
        // every item. A message the member discarded meanwhile, while an earlier one was
        // going or while the chain was being asked about this one, is not sent.
        if (!outbox.some((q) => q.id === item.id && q.state === 'waiting')) continue;

        if (already.ok && already.hash) {
          dropFromOutbox(item.id);
          continue;
        }

        if (!already.ok) {
          // The check itself failed, which is the one case we genuinely cannot resolve.
          // Handed to the member as a fault rather than retried blind.
          outbox = outbox.map((q) =>
            q.id === item.id ? { ...q, state: 'mayNotHaveSent' as const } : q
          );
          write({ outbox });
          stalled.add(item.to);
          continue;
        }

        const failure = yield* withServices((service) =>
          service
            .sendMessage({
              toUser: counterparty,
              content: item.content,
              sendId: item.id,
              listing: item.listing ? decodeHashFromBase64(item.listing) : undefined
            })
            .pipe(E.asVoid)
        ).pipe(
          E.as(null),
          // `cause` is the client's own error, which carries the name and message the
          // classifier reads. `MessagingError` prefixes its context onto the message, so
          // classifying the wrapper would lose the distinction between a timeout and a
          // refusal.
          E.catchAll((e) => E.succeed(classifySendFailure(causeOf(e))))
        );

        if (failure === null) {
          dropFromOutbox(item.id);
          continue;
        }

        if (failure.kind === 'devicesNotFound' || failure.kind === 'noAnswer') {
          // Either still unreachable, or still silent. Both stay `waiting`: the next run
          // asks the chain again before sending anything, so nothing is sent twice. The
          // rest of this person's messages wait behind it.
          stalled.add(item.to);
          continue;
        }

        // A refusal: the zome answered and said no. Nothing was written, and trying the
        // same thing again would fail the same way, so the member reads the reason
        // rather than watching it retry for ever.
        outbox = outbox.map((q) =>
          q.id === item.id ? { ...q, state: 'refused' as const, reason: failure.reason } : q
        );
        write({ outbox });
        stalled.add(item.to);
      }
    });

  /**
   * Listen for what other agents send this one directly.
   *
   * **Nudges and receipts arrive the same way**, as a tagged remote signal, so one
   * subscription handles both. A nudge means something is waiting and the conversations
   * are re-read; a receipt says how far somebody has read, which is clamped and kept
   * locally.
   *
   * Registered with the client rather than the socket, because the client is replaced on
   * every reconnect and handlers are re-attached for us.
   */
  const listen = (): (() => void) =>
    holochainClientService.onZomeSignal('messaging', (payload) => {
      // Decoded against the schema rather than cast: a payload whose shape has drifted
      // from what this reads is dropped here, where a test can see it, instead of
      // arriving as `undefined` fields that quietly become NaN and then 0. That is
      // exactly how Read never appeared: the wire said `read_up_to` and this read
      // `readUpTo`.
      const decoded = Schema.decodeUnknownEither(MessagingSignalSchema)(payload);
      if (decoded._tag === 'Left') {
        console.warn('messaging: a signal arrived in a shape this build does not read', payload);
        return;
      }
      const signal = decoded.right;

      // **A blocked person's signals do nothing.** The sender is an agent and a block is
      // on a person, so the sender is resolved first. A nudge from someone blocked does
      // not trigger a read (which would also tell a watcher this device is awake), and
      // their receipt is not recorded. A sender who cannot be resolved is not known to
      // be blocked: their nudge still triggers a read, since a nudge only says "look",
      // and what the read returns goes through the block list anyway.
      void E.runPromise(
        usersStore.getUserByAgentPubKey(signal.from).pipe(
          E.catchAll(() => E.succeed(null)),
          E.flatMap((user) => {
            const person = user?.original_action_hash;
            if (person && isBlocked(person)) return E.void;

            if (signal.type === 'Nudge') {
              return loadConversations().pipe(
                E.asVoid,
                E.catchAll(() => E.void)
              );
            }
            // A receipt we cannot attribute is worth nothing.
            if (person) receiveReceipt(person, toMillis(signal.readUpTo));
            return E.void;
          })
        )
      );
    });

  /**
   * Try the outbox again on a timer, for as long as anything is waiting.
   *
   * **Started by the root layout, not by a conversation.** The outbox belongs to the
   * member, not to the chat it was written in: a message held while one conversation was
   * open must still go after they navigate away, reload, or come back tomorrow. The timer
   * is the fallback half of the retry; the other half is the browser's `online` event,
   * which the layout also wires to `flushOutbox`. Neither is sufficient alone: the event
   * never fires if the connection never dropped, and a timer alone would wait up to its
   * full interval after it came back.
   */
  const startRetrying = (): (() => void) => {
    if (typeof setInterval === 'undefined') return () => {};
    const handle = setInterval(() => {
      adoptOutbox();
      if (outbox.some((item) => item.state === 'waiting')) void E.runPromise(flushOutbox());
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(handle);
  };

  /**
   * Mark this thread read up to now, locally.
   *
   * **Nothing is committed and nothing is published.** This was a private `ReadMarker`
   * entry on the chain, and a private entry hides its content but not its timing: one
   * written moments after a message arrived was a read receipt by correlation. It never
   * synced between a member's devices anyway.
   *
   * A receipt, if this chat sends them, is a separate remote signal that leaves no
   * record either.
   */
  const markThreadRead = (counterparty: ActionHash): void => {
    const thread = threadFor(counterparty);
    if (!thread) return;

    const local = localState();
    const previous = local.readUpTo[thread.key] ?? 0;
    // As far as reading can have got: the newest thing in here that counts as unread,
    // cards included. Taking only the newest message left any later card permanently
    // outside the mark, so the count cleared on opening and came straight back.
    const me = myUserHash();
    if (!me) return;
    const newest = readableUpTo(thread, me);
    if (newest <= previous) return;

    write({ readUpTo: { ...local.readUpTo, [thread.key]: newest } });
    threads = threads.map((t) => (t.key === thread.key ? { ...t, unread: 0 } : t));

    // **Only when the mark advances, and only if this chat sends them.** Re-sending an
    // unchanged mark would tell the other person this agent is online without having
    // read anything, which is a smaller version of the leak receipts replaced.
    if (
      !receiptPlan({
        setting: local.receiptsByChat[thread.key],
        overall: local.receipts,
        myReadUpTo: newest
      }).sendSignal
    ) {
      return;
    }
    void E.runPromise(
      withServices((service) =>
        service.sendReceipt({ toUser: counterparty, readUpTo: toMicros(newest) })
      ).pipe(E.catchAll(() => E.void))
      // A receipt that cannot be delivered is dropped without an error by design, so
      // there is nothing to report and nothing to retry: the same mark rides in the body
      // of the next message instead.
    );
  };

  /**
   * Somebody says they have read up to here.
   *
   * The time is their claim and is clamped to the last message this agent actually sent
   * them; only the provenance is trustworthy. Stored locally, like everything else here.
   */
  const receiveReceipt = (from: ActionHash, claimed: number): void => {
    const thread = threadFor(from);
    if (!thread) return;
    const lastSent = Math.max(
      0,
      ...thread.messages.filter((m) => m.mine).map((m) => toMillis(m.at))
    );
    const clamped = clampReceipt(claimed, lastSent);
    const local = localState();
    if ((local.theirReadUpTo[thread.key] ?? 0) >= clamped) return;
    write({ theirReadUpTo: { ...local.theirReadUpTo, [thread.key]: clamped } });
  };

  /** How far the other person says they have read, for the Read status on my messages. */
  const theirReadUpTo = (counterparty: ActionHash): number =>
    localState().theirReadUpTo[threadKeyOf(counterparty)] ?? 0;

  /** Whether this chat sends receipts, resolved against the overall setting. */
  const receiptsOn = (counterparty: ActionHash): boolean => {
    const local = localState();
    return receiptsEnabledFor(local.receiptsByChat[threadKeyOf(counterparty)], local.receipts);
  };

  const setReceiptsOverall = (on: boolean): void => {
    write({ receipts: on });
  };

  /** What this chat is set to, before the overall setting is applied. */
  const receiptSettingFor = (counterparty: ActionHash): ReceiptSetting =>
    localState().receiptsByChat[threadKeyOf(counterparty)] ?? 'inherit';

  /** The overall setting, which governs every chat left on `inherit`. */
  const receiptsOverall = (): boolean => localState().receipts;

  /** Whether this member has already been told what a proposal and a message put out. */
  const noticeSeen = (): boolean => localState().noticeSeen;

  /**
   * Remember that they have.
   *
   * Written before the member is taken anywhere, so a notice cannot appear twice because
   * the page navigated first. If the write fails, which it does in private browsing, they
   * see it again; saying it twice is the harmless direction.
   */
  const markNoticeSeen = (): void => {
    write({ noticeSeen: true });
  };

  const setReceiptsForChat = (counterparty: ActionHash, setting: ReceiptSetting): void => {
    const local = localState();
    write({
      receiptsByChat: { ...local.receiptsByChat, [threadKeyOf(counterparty)]: setting }
    });
  };

  /**
   * Try one stalled message again, because the member asked.
   *
   * Back to `waiting` first, so if it fails the same way again the automatic path
   * handles it. **This is the only way out of `mayNotHaveSent` or `refused`:** nothing
   * puts a message back on automatic retrying without the member saying so.
   */
  const retryUnsent = (id: string): E.Effect<void, never> =>
    E.gen(function* () {
      adoptOutbox();
      outbox = outbox.map((q) =>
        q.id === id ? { ...q, state: 'waiting' as const, reason: undefined } : q
      );
      write({ outbox });
      // A run already under way took its list before this item was put back, and asking
      // for a flush only waits for that run. Then one more, so "send again" sends now
      // and not at the next tick. Not otherwise: a second ask straight after a send that
      // got no answer is the narrowest moment to ask the chain whether it went.
      const joinedARun = flushing !== null;
      yield* flushOutbox();
      if (joinedARun) yield* flushOutbox();
    });

  /**
   * Keep a message the zome refused when there was no screen left to say so on.
   *
   * A refusal normally shows beside the composer with the draft still in it. If the
   * member has moved to another conversation by the time it comes, the draft has gone
   * with the page. It goes in the outbox as `refused`, with the reason, where the
   * member finds it in that person's conversation and can send it again or discard it.
   */
  const keepRefused = (counterparty: ActionHash, content: string, reason: string): void => {
    adoptOutbox();
    const item: OutboxItem = {
      id: newSendId(),
      to: threadKeyOf(counterparty),
      content,
      queuedAt: Date.now() - SEND_CLOCK_MARGIN_MS,
      state: 'refused',
      reason
    };
    outbox = [...outbox, item];
    write({ outbox });
  };

  /**
   * Drop one message from the outbox for good, because the member asked.
   *
   * Nothing leaves the outbox by itself except a send that went: a refused message stayed
   * on this device and on screen with no way to clear it, and a waiting one could not be
   * taken back. If it had in fact been sent and the answer lost, discarding does not
   * unsend it; it only stops this device trying again.
   */
  const discardUnsent = (id: string): void => {
    adoptOutbox();
    dropFromOutbox(id);
  };

  /**
   * Block or unblock a person.
   *
   * **Local, and by person.** It was a private entry on the chain, which hid who was
   * blocked but not when, and a block committed moments after a message arrived named
   * the person to anyone watching. A block only ever acted at the recipient's end
   * anyway, so nothing is lost by keeping it here.
   *
   * Both the block and the unblock are kept, so a member can see who they blocked
   * before and undo a mistake, which is what paths.blockedMembers() shows.
   */
  const setBlocked = (counterparty: ActionHash, blocked: boolean): void => {
    const key = threadKeyOf(counterparty);
    const local = localState();
    const next = new Set(local.blocked);
    if (blocked) next.add(key);
    else next.delete(key);
    write({
      blocked: [...next],
      blockHistory: [...local.blockHistory, { user: key, blocked, at: Date.now() }]
    });
    void E.runPromise(loadConversations().pipe(E.catchAll(() => E.void)));
  };

  const isBlocked = (counterparty: ActionHash): boolean =>
    localState().blocked.includes(threadKeyOf(counterparty));

  /** Who is blocked now, as `User` hashes in base64. */
  const blockedUsers = (): string[] => localState().blocked;

  /** Every block and unblock, newest last. */
  const blockHistory = (): BlockEvent[] => localState().blockHistory;

  const setArchived = (counterparty: ActionHash, archived: boolean): void => {
    const key = threadKeyOf(counterparty);
    threads = threads.map((t) => (t.key === key ? { ...t, archived } : t));
    const current = new Set(localState().archived);
    if (archived) current.add(key);
    else current.delete(key);
    write({ archived: [...current] });
  };

  return {
    get threads() {
      return threads;
    },
    get faults() {
      return faults;
    },
    get outbox() {
      return outbox;
    },
    get loading() {
      return loading;
    },
    get everLoaded() {
      return everLoaded;
    },
    get error() {
      return error;
    },
    loadConversations,
    threadFor,
    send,
    markThreadRead,
    receiveReceipt,
    theirReadUpTo,
    receiptsOn,
    receiptSettingFor,
    receiptsOverall,
    noticeSeen,
    markNoticeSeen,
    setReceiptsOverall,
    setReceiptsForChat,
    setArchived,
    setBlocked,
    isBlocked,
    blockedUsers,
    blockHistory,
    flushOutbox,
    startRetrying,
    listen,
    retryUnsent,
    keepRefused,
    discardUnsent
  };
}

export const messagingStore = createMessagingStore();
export default messagingStore;
