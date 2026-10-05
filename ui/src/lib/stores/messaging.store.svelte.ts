import { encodeHashToBase64, type ActionHash, type AgentPubKey } from '@holochain/client';
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
import { MessagingError } from '$lib/errors/messaging.errors';
import type { Message } from '$lib/schemas/messaging.schemas';
import type { UIInterest } from '$lib/types/ui';
import {
  EMPTY_LOCAL,
  localKey,
  type OutboxItem,
  readLocal,
  writeLocal,
  type LocalStore,
  type MessagingLocalState,
  type ReceiptSetting
} from '$lib/utils/messaging-local';
import {
  applyBlocks,
  buildThreads,
  clampReceipt,
  receiptsEnabledFor,
  classifySendFailure,
  unarchivedByNewMessages,
  isPersonal,
  threadKeyOf,
  toMillis,
  type Fault,
  type ThreadKey,
  type UIThread
} from '$lib/utils/messaging-threads';
import usersStore from '$lib/stores/users.store.svelte';
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

const storage = (): LocalStore | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage;

const readFor = (me: AgentPubKey | null) =>
  me ? readLocal(storage(), keyFor(me)) : EMPTY_LOCAL;

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
  readonly error: string | null;

  loadConversations: () => E.Effect<UIThread[], MessagingError>;
  threadFor: (counterparty: ActionHash) => UIThread | undefined;
  send: (counterparty: ActionHash, content: string) => E.Effect<void, MessagingError>;
  markThreadRead: (counterparty: ActionHash) => void;
  receiveReceipt: (from: ActionHash, claimed: number) => void;
  theirReadUpTo: (counterparty: ActionHash) => number;
  receiptsOn: (counterparty: ActionHash) => boolean;
  setReceiptsOverall: (on: boolean) => void;
  setReceiptsForChat: (counterparty: ActionHash, setting: ReceiptSetting) => void;
  setArchived: (counterparty: ActionHash, archived: boolean) => void;
  /** Send everything waiting, oldest first. Called when the connection returns. */
  flushOutbox: () => E.Effect<void, never>;
  /** Start the retry timer. Returns the stopper, for the screen's teardown. */
  startRetrying: () => () => void;
  /** Try one message again, because the member asked. */
  retryUnsent: (id: string) => E.Effect<void, never>;
};

function createMessagingStore(): MessagingStore {
  let threads = $state<UIThread[]>([]);
  let faults = $state<Fault[]>([]);
  let outbox = $state<OutboxItem[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  /** My own agent key, needed for both local keys. Set on the first load. */
  let myAgent: AgentPubKey | null = null;

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
    }).pipe(
      E.provide(MessagingServiceLive),
      E.provide(HolochainClientServiceLive)
    ) as E.Effect<A, MessagingError>;

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

  /**
   * Every interest that concerns me, with the `User` on the other end.
   *
   * Two directions, and both are needed: the listings I have shown interest in, where
   * the counterparty is the listing's author, and the interests other people have shown
   * in mine, where the counterparty is the interested member. Only the first would miss
   * the person who has just pressed Show interest on my offer, which is exactly when a
   * conversation should appear.
   */
  const loadInterests = (me: ActionHash) =>
    E.gen(function* () {
      const out: Array<{ interest: UIInterest; counterparty: ActionHash }> = [];

      const mine = yield* exchangesStore.getMyInterests().pipe(E.catchAll(() => E.succeed([])));
      for (const interest of mine) {
        const listing =
          interest.listing_type === 'Request'
            ? yield* requestsStore.getRequest(interest.listing).pipe(E.catchAll(() => E.succeed(null)))
            : yield* offersStore.getOffer(interest.listing).pipe(E.catchAll(() => E.succeed(null)));
        if (listing?.creator) out.push({ interest, counterparty: listing.creator });
      }

      const myListings = [
        ...(yield* requestsStore.getMyListings(me).pipe(E.catchAll(() => E.succeed([])))),
        ...(yield* offersStore.getMyListings(me).pipe(E.catchAll(() => E.succeed([]))))
      ];
      for (const listing of myListings) {
        if (!listing.original_action_hash) continue;
        const interests = yield* exchangesStore
          .getInterestsForListing(listing.original_action_hash)
          .pipe(E.catchAll(() => E.succeed([])));
        for (const interest of interests) {
          out.push({ interest, counterparty: interest.user });
        }
      }

      return out;
    });

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
          return [];
        }

        const entries = yield* service.getInbox();
        const inbox: Message[] = [];
        const seenFaults: Fault[] = [];
        for (const entry of entries) {
          if (entry.type === 'Read') inbox.push(entry as unknown as Message);
          else seenFaults.push({ hash: entry.hash, from: entry.from, at: toMillis(entry.at) });
        }

        const sent = yield* service.getSent();

        const exchanges = yield* exchangesStore
          .loadMyExchanges()
          .pipe(E.catchAll(() => E.succeed([])));
        const interests = yield* loadInterests(me);

        const agentToUserMap = yield* resolveAgents([
          ...inbox.map((m) => m.from),
          ...sent.filter(isPersonal).map((m) => m.to)
        ]);
        const agentToUser = (agent: AgentPubKey) => agentToUserMap.get(encodeHashToBase64(agent));

        myAgent = yield* E.sync(() => myAgentOf());
        const local = readFor(myAgent);
        const archivedKeys = new Set<ThreadKey>(local.archived);
        outbox = local.outbox;

        // **The one place blocking is applied.** Everything below reads from this list,
        // so the personal threads, the role inbox and a member's own correspondence all
        // get the same answer without the rule being written three times.
        const blocked = new Set(local.blocked);
        const visibleInbox = applyBlocks(inbox, agentToUser, blocked);

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
        faults = seenFaults;

        // A new message brought these back to All. Persist it, or the next load would
        // archive them again and the member would lose the same message twice.
        const returned = unarchivedByNewMessages(threads, archivedKeys);
        if (returned.length > 0) {
          writeFor(myAgent, {
            archived: [...archivedKeys].filter((k) => !returned.includes(k))
          });
        }

        loading = false;
        return threads;
      }).pipe(
        E.catchAll((e) => {
          loading = false;
          error = e instanceof MessagingError ? e.message : String(e);
          return E.fail(e as MessagingError);
        })
      )
    );

  /** My own agent key, from whichever of my agents this installation runs. */
  const myAgentOf = (): AgentPubKey | null =>
    (usersStore.currentUser?.agents?.[0] as AgentPubKey | undefined) ?? null;

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

  const queue = (counterparty: ActionHash, content: string, id: string) => {
    const item: OutboxItem = {
      id,
      to: threadKeyOf(counterparty),
      content,
      queuedAt: Date.now(),
      state: 'waiting'
    };
    outbox = [...outbox, item];
    writeFor(myAgent, { outbox });
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
   * Every other failure is a real refusal and reaches the member with the zome's reason.
   */
  const send = (counterparty: ActionHash, content: string): E.Effect<void, MessagingError> => {
    const sendId = newSendId();
    return withServices((service) =>
      service.sendMessage({ toUser: counterparty, content, sendId } as never).pipe(
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
            queue(counterparty, content, sendId);
            return E.void;
          }
          // No answer: we do not know, and we do not guess. It goes to the outbox with
          // its send id, and the next flush asks the chain whether it went.
          if (failure.kind === 'noAnswer') {
            queue(counterparty, content, sendId);
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
   * The gap that remains, stated rather than hidden: if a send succeeds at the conductor
   * but we never learn it, the retry sends a second copy. Closing that needs an
   * identifier inside the message body so a duplicate can be recognised on read, which is
   * a zome change and the same one the per-agent copies want.
   */
  const flushOutbox = (): E.Effect<void, never> =>
    E.gen(function* () {
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

      for (const item of waiting) {
        const counterparty = threads.find((t) => t.key === item.to)?.counterparty;
        if (!counterparty) continue;

        // Not `send`: that one queues on failure, which would add a second copy of
        // something already here. This call reports the reason instead, because the
        // reason is what decides whether retrying is safe.
        // **Ask before sending again.** A lost answer says nothing about whether the
        // call committed, so the chain is checked for this send id first. Found means it
        // went: drop it and move on. Not found means it did not, and sending again is
        // safe. Bounded by when the item was queued, so the check does not get slower as
        // a member's history grows.
        const already = yield* withServices((service) =>
          service.findSent({ sendId: item.id, since: (item.queuedAt * 1000) as never })
        ).pipe(
          E.map((hash) => ({ ok: true as const, hash })),
          E.catchAll(() => E.succeed({ ok: false as const, hash: null }))
        );

        if (already.ok && already.hash) {
          outbox = outbox.filter((q) => q.id !== item.id);
          writeFor(myAgent, { outbox });
          continue;
        }

        if (!already.ok) {
          // The check itself failed, which is the one case we genuinely cannot resolve.
          // Handed to the member as a fault rather than retried blind.
          outbox = outbox.map((q) =>
            q.id === item.id ? { ...q, state: 'mayNotHaveSent' as const } : q
          );
          writeFor(myAgent, { outbox });
          break;
        }

        const failure = yield* withServices((service) =>
          service
            .sendMessage({
              toUser: counterparty,
              content: item.content,
              sendId: item.id
            } as never)
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
          outbox = outbox.filter((q) => q.id !== item.id);
          writeFor(myAgent, { outbox });
          continue;
        }

        if (failure.kind === 'devicesNotFound' || failure.kind === 'noAnswer') {
          // Either still unreachable, or still silent. Both stay `waiting`: the next run
          // asks the chain again before sending anything, so nothing is sent twice. Stop
          // here, because the rest would meet the same conditions.
          break;
        }

        // A refusal: the zome answered and said no. Nothing was written, and trying the
        // same thing again would fail the same way, so the member reads the reason
        // rather than watching it retry for ever.
        outbox = outbox.map((q) =>
          q.id === item.id ? { ...q, state: 'refused' as const, reason: failure.reason } : q
        );
        writeFor(myAgent, { outbox });
        break;
      }
    });

  /**
   * Try the outbox again on a timer, for as long as anything is waiting.
   *
   * The timer is the fallback half of the retry; the other half is the reconnect, which
   * the screen wires to `flushOutbox` through the client's connection handler. Neither is
   * sufficient alone: a reconnect never fires if the websocket never dropped, which is the
   * usual case when it is the internet that went, and a timer alone would wait up to its
   * full interval after a reconnect.
   */
  const startRetrying = (): (() => void) => {
    if (typeof setInterval === 'undefined') return () => {};
    const handle = setInterval(() => {
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

    const local = readFor(myAgent);
    const previous = local.readUpTo[thread.key] ?? 0;
    // The newest thing they sent, which is as far as reading can have got.
    const newest = Math.max(
      0,
      ...thread.messages.filter((m) => !m.mine).map((m) => toMillis(m.at))
    );
    if (newest <= previous) return;

    writeFor(myAgent, { readUpTo: { ...local.readUpTo, [thread.key]: newest } });
    threads = threads.map((t) => (t.key === thread.key ? { ...t, unread: 0 } : t));

    // **Only when the mark advances, and only if this chat sends them.** Re-sending an
    // unchanged mark would tell the other person this agent is online without having
    // read anything, which is a smaller version of the leak receipts replaced.
    if (!receiptsEnabledFor(local.receiptsByChat[thread.key], local.receipts)) return;
    void E.runPromise(
      withServices((service) =>
        service.sendReceipt({ toUser: counterparty, readUpTo: (newest * 1000) as never })
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
    const local = readFor(myAgent);
    if ((local.theirReadUpTo[thread.key] ?? 0) >= clamped) return;
    writeFor(myAgent, { theirReadUpTo: { ...local.theirReadUpTo, [thread.key]: clamped } });
  };

  /** How far the other person says they have read, for the Read status on my messages. */
  const theirReadUpTo = (counterparty: ActionHash): number =>
    readFor(myAgent).theirReadUpTo[threadKeyOf(counterparty)] ?? 0;

  /** Whether this chat sends receipts, resolved against the overall setting. */
  const receiptsOn = (counterparty: ActionHash): boolean => {
    const local = readFor(myAgent);
    return receiptsEnabledFor(local.receiptsByChat[threadKeyOf(counterparty)], local.receipts);
  };

  const setReceiptsOverall = (on: boolean): void => {
    writeFor(myAgent, { receipts: on });
  };

  const setReceiptsForChat = (counterparty: ActionHash, setting: ReceiptSetting): void => {
    const local = readFor(myAgent);
    writeFor(myAgent, {
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
      outbox = outbox.map((q) =>
        q.id === id ? { ...q, state: 'waiting' as const, reason: undefined } : q
      );
      writeFor(myAgent, { outbox });
      yield* flushOutbox();
    });

  const setArchived = (counterparty: ActionHash, archived: boolean): void => {
    const key = threadKeyOf(counterparty);
    threads = threads.map((t) => (t.key === key ? { ...t, archived } : t));
    const current = new Set(readFor(myAgent).archived);
    if (archived) current.add(key);
    else current.delete(key);
    writeFor(myAgent, { archived: [...current] });
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
    setReceiptsOverall,
    setReceiptsForChat,
    setArchived,
    flushOutbox,
    startRetrying,
    retryUnsent
  };
}

export const messagingStore = createMessagingStore();
export default messagingStore;
