import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect as E } from 'effect';
import { encodeHashToBase64 } from '@holochain/client';
import { MESSAGING_STRINGS } from '$lib/strings/messaging.strings';
import { localKey } from '$lib/utils/messaging-local';
import { createMessagingStore, type MessagingStore } from '$lib/stores/messaging.store.svelte';
import { unopenedConversations } from '$lib/utils/messaging-threads';

/**
 * The messaging store around the outbox and the local state, with the zome stood in for.
 *
 * Each test takes a fresh copy of the store, because the thing under test is what the
 * store does before and between loads: a setting changed on a cold page, a message that
 * waits with nothing else on screen.
 */

const {
  hashes,
  sendMessage,
  findSent,
  getInbox,
  getInboxDelta,
  getSent,
  sendReceipt,
  peers,
  userByAgent,
  myInterests,
  signalHandlers
} = vi.hoisted(() => {
  const hash = (n: number) => new Uint8Array(Array(39).fill(n));
  return {
    hashes: {
      ME: hash(1),
      MY_AGENT: hash(2),
      ANITA: hash(3),
      LISTING: hash(4),
      ANITA_AGENT: hash(5)
    },
    sendMessage: vi.fn(),
    findSent: vi.fn(),
    getInbox: vi.fn(),
    /** Set to answer `getInboxDelta` directly; otherwise it is derived from `getInbox`. */
    getInboxDelta: vi.fn(),
    getSent: vi.fn(),
    sendReceipt: vi.fn(),
    /** How many peers the conductor can reach; a test sets 0 for "offline". */
    peers: { reachable: 1 },
    userByAgent: vi.fn(),
    myInterests: vi.fn(),
    /** Whatever `listen()` subscribed, so a test can deliver a signal. */
    signalHandlers: [] as Array<(payload: unknown) => void>
  };
});
const { MY_AGENT, ANITA, LISTING, ANITA_AGENT } = hashes;

vi.mock('$lib/services/zomes/messaging.service', async () => {
  const { Context, Effect, Layer } = await import('effect');
  const MessagingServiceTag = Context.GenericTag<unknown>('MessagingService');
  const service = {
    sendMessage: (...a: unknown[]) => sendMessage(...a),
    findSent: (...a: unknown[]) => findSent(...a),
    getInbox: () => getInbox(),
    // The real zome answers from what the caller holds. Most cases here need the
    // whole inbox each time, so by default the delta is everything `getInbox` gives,
    // all of it visible: the store then holds and shows exactly that.
    getInboxDelta: (known: unknown[], skipped: unknown[]) =>
      getInboxDelta.getMockImplementation()
        ? getInboxDelta(known, skipped)
        : Effect.map(getInbox(), (entries: Array<{ hash: unknown }>) => ({
            visible: entries.map((e) => e.hash),
            entries,
            skipped: []
          })),
    getSent: () => getSent(),
    sendReceipt: (...a: unknown[]) => {
      sendReceipt(...a);
      return Effect.void;
    }
  };
  return { MessagingServiceTag, MessagingServiceLive: Layer.succeed(MessagingServiceTag, service) };
});

vi.mock('$lib/services/HolochainClientService.svelte', async () => {
  const { Context, Layer } = await import('effect');
  const HolochainClientServiceTag = Context.GenericTag<unknown>('HolochainClientService');
  const client = {
    isConnected: true,
    // The app's own agent, as the real client gives it.
    client: { myPubKey: hashes.MY_AGENT },
    getNetworkPeerStatus: () => Promise.resolve({ reachable: peers.reachable, known: 1 }),
    onZomeSignal: (_zome: string, handler: (payload: unknown) => void) => {
      signalHandlers.push(handler);
      return () => {};
    }
  };
  return {
    default: client,
    HolochainClientServiceTag,
    HolochainClientServiceLive: Layer.succeed(HolochainClientServiceTag, client)
  };
});

vi.mock('$lib/stores/users.store.svelte', async () => {
  const { Effect } = await import('effect');
  return {
    default: {
      // As the real store holds it: the profile record, with no `agents` list. A mock
      // that supplied one hid that local state was never saved in the running app.
      currentUser: { original_action_hash: hashes.ME },
      getUserByAgentPubKey: (agent: unknown) => Effect.succeed(userByAgent(agent)),
      getUserByActionHash: () => Effect.succeed(null)
    }
  };
});

vi.mock('$lib/stores/exchanges.store.svelte', async () => {
  const { Effect } = await import('effect');
  return {
    default: {
      getMyInterests: () => myInterests(),
      getInterestsForListing: () => Effect.succeed([]),
      loadMyExchanges: () => Effect.succeed(exchangesNow.list)
    }
  };
});

/** My exchanges as the exchanges store would give them; empty unless a case sets them. */
const { exchangesNow } = vi.hoisted(() => ({ exchangesNow: { list: [] as unknown[] } }));

const { listings } = vi.hoisted(() => ({
  listings: async () => {
    const { Effect } = await import('effect');
    return {
      default: {
        getMyListings: () => Effect.succeed([]),
        getRequest: () => Effect.succeed(null),
        getOffer: () => Effect.succeed(null)
      }
    };
  }
}));
vi.mock('$lib/stores/requests.store.svelte', listings);
vi.mock('$lib/stores/offers.store.svelte', listings);

/** What the zome says when the recipient's agents are not cached: safe to hold. */
const devicesNotFound = {
  name: 'HolochainError',
  message: "send_message: could not reach that member's devices"
};

/** A store that has loaded nothing yet, as on a cold page. */
async function freshStore(): Promise<MessagingStore> {
  return createMessagingStore();
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  signalHandlers.length = 0;
  peers.reachable = 1;
  findSent.mockReturnValue(E.succeed(null));
  getInbox.mockReturnValue(E.succeed([]));
  getSent.mockReturnValue(E.succeed([]));
  userByAgent.mockReturnValue(null);
  myInterests.mockReturnValue(E.succeed([]));
});

/** Milliseconds, as the screens think; the zome speaks microseconds. */
const T_SENT = 1_760_000_000_000;
const micros = (ms: number) => ms * 1000;

/** One of mine to Anita's agent, as `get_sent` returns it. */
const mineToAnita = () => ({
  hash: hashes.LISTING,
  from: MY_AGENT,
  to: ANITA_AGENT,
  at: micros(T_SENT),
  content: 'see you at ten',
  sendId: 'send-1'
});

/** One of Anita's to me, carrying her mark, as `get_inbox` returns it. */
const fromAnitaWithMark = (readUpToMs: number) => ({
  type: 'Read',
  hash: hashes.ME,
  from: ANITA_AGENT,
  to: MY_AGENT,
  at: micros(T_SENT + 60_000),
  content: 'ok',
  sendId: 'send-2',
  readUpTo: micros(readUpToMs)
});

afterEach(() => {
  vi.useRealTimers();
});

describe('local state before the first load (F4)', () => {
  /**
   * A member who turns receipts off on a freshly loaded page, or is told the first-contact
   * notice and says go on, has changed something. It must be written under their key now,
   * not dropped because the first load of conversations has not finished yet.
   */
  it('keeps a setting changed before any conversation has loaded', async () => {
    const store = await freshStore();

    store.setReceiptsOverall(false);
    store.markNoticeSeen();

    expect(store.receiptsOverall(), 'the setting the member chose').toBe(false);
    expect(store.noticeSeen(), 'they were told').toBe(true);
    expect(
      localStorage.getItem(localKey(encodeHashToBase64(MY_AGENT))),
      'written under my own agent key'
    ).not.toBeNull();
  });
});

describe('the outbox with no conversation open (F1)', () => {
  it('sends a waiting message to a person this store has no thread for', async () => {
    const store = await freshStore();
    sendMessage.mockReturnValueOnce(E.fail(devicesNotFound)).mockReturnValue(E.succeed([]));

    await E.runPromise(store.send(ANITA, 'see you at ten'));
    expect(store.outbox, 'held, not lost').toHaveLength(1);

    await E.runPromise(store.flushOutbox());

    expect(sendMessage, 'tried again').toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[1][0]).toMatchObject({
      toUser: ANITA,
      content: 'see you at ten'
    });
    expect(store.outbox, 'gone once it went').toHaveLength(0);
  });

  it('the retry timer tries again by itself, with nothing on screen', async () => {
    vi.useFakeTimers();
    const store = await freshStore();
    sendMessage.mockReturnValueOnce(E.fail(devicesNotFound)).mockReturnValue(E.succeed([]));
    const stop = store.startRetrying();

    await E.runPromise(store.send(ANITA, 'see you at ten'));
    await vi.advanceTimersByTimeAsync(30_000);
    stop();

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(store.outbox).toHaveLength(0);
  });
});

describe('a shared listing that has to wait (F2)', () => {
  it('keeps its listing and goes out as a card, not as an empty message', async () => {
    const store = await freshStore();
    sendMessage.mockReturnValueOnce(E.fail(devicesNotFound)).mockReturnValue(E.succeed([]));

    await E.runPromise(store.send(ANITA, '', LISTING));
    expect(store.outbox[0]?.listing, 'the card is what waits').toBe(encodeHashToBase64(LISTING));

    await E.runPromise(store.flushOutbox());

    const retried = sendMessage.mock.calls[1][0] as { content: string; listing?: Uint8Array };
    expect(retried.content).toBe('');
    expect(retried.listing, 'the listing travels with the retry').toEqual(LISTING);
  });
});

describe('reads that overlap', () => {
  /**
   * The poll, a nudge and the read after a send finish in any order. A slow poll started
   * before a message was sent landed after the read that showed it and took it away.
   */
  it('an older read that finishes late does not replace what a newer one showed', async () => {
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    // The older read: slow, and started before the message existed.
    getSent.mockReturnValueOnce(E.sleep('60 millis').pipe(E.as([])));
    const older = E.runPromise(store.loadConversations());
    await new Promise((resolve) => setTimeout(resolve, 10));
    // The newer one sees it.
    getSent.mockReturnValue(E.succeed([mineToAnita()]));
    await E.runPromise(store.loadConversations());
    expect(store.threads, 'shown').toHaveLength(1);
    expect(store.loading, 'a read is still under way').toBe(true);

    await older;

    expect(store.threads, 'still shown').toHaveLength(1);
    expect(store.threads[0].messages).toHaveLength(1);
    expect(store.loading).toBe(false);
  });

  /** "Only the newest started writes" would show nothing while reads keep overlapping. */
  it('a read writes even though a later one has started and not finished', async () => {
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    getSent.mockReturnValue(E.succeed([mineToAnita()]));
    const store = await freshStore();
    const first = E.runPromise(store.loadConversations());
    getSent.mockReturnValue(E.sleep('60 millis').pipe(E.as([mineToAnita()])));
    const later = E.runPromise(store.loadConversations());

    expect(await first, 'and answers with what it found').toHaveLength(1);
    expect(store.threads, 'shown before the later one has finished').toHaveLength(1);
    await later;
  });

  /** The other order: its error stood over the conversations until the next read began. */
  it('an older read that fails first is not left reported once a newer one has worked', async () => {
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    getSent.mockReturnValueOnce(
      E.sleep('10 millis').pipe(E.andThen(E.fail(new Error('no answer'))))
    );
    const older = E.runPromise(store.loadConversations()).catch(() => 'failed');
    getSent.mockReturnValue(E.sleep('40 millis').pipe(E.as([mineToAnita()])));
    const newer = E.runPromise(store.loadConversations());

    expect(await older).toBe('failed');
    expect(store.error, 'reported while nothing newer has worked').not.toBeNull();
    await newer;

    expect(store.threads).toHaveLength(1);
    expect(store.error).toBeNull();
  });

  /** Cleared at the start of each read, the fault gave way to "No conversations yet". */
  it('a failure stays reported while the next read is under way, and goes when one works', async () => {
    const store = await freshStore();
    getSent.mockReturnValue(E.fail(new Error('no answer')));
    await E.runPromise(store.loadConversations()).catch(() => {});
    expect(store.error).not.toBeNull();

    getSent.mockReturnValue(E.sleep('30 millis').pipe(E.as([])));
    const next = E.runPromise(store.loadConversations());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(store.error, 'still the state of the screen').not.toBeNull();

    await next;
    expect(store.error).toBeNull();
  });

  /** Thrown away with nothing in its place, the conversation looked empty and unfaulted. */
  it('an older read still writes when the later one failed', async () => {
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    getSent.mockReturnValueOnce(E.sleep('40 millis').pipe(E.as([mineToAnita()])));
    const older = E.runPromise(store.loadConversations());
    await new Promise((resolve) => setTimeout(resolve, 10));
    getSent.mockReturnValue(E.fail(new Error('no answer')));
    await E.runPromise(store.loadConversations()).catch(() => {});
    expect(store.error, 'the failure is reported').not.toBeNull();

    await older;

    expect(store.threads, 'what the older one found is shown').toHaveLength(1);
  });

  it('an older read that fails late is not reported over a newer one that worked', async () => {
    const store = await freshStore();
    getSent.mockReturnValueOnce(
      E.sleep('40 millis').pipe(E.andThen(E.fail(new Error('no answer'))))
    );
    const older = E.runPromise(store.loadConversations()).catch(() => 'failed');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await E.runPromise(store.loadConversations());

    expect(await older).toBe('failed');
    expect(store.error).toBeNull();
  });
});

describe('receipts (F5)', () => {
  /**
   * The zome emits `{ type: 'Receipt', readUpTo, from }`; `from` is an agent and a thread
   * is a person, so the agent is resolved first. The claim is clamped to the last thing
   * this agent actually sent them, so a receipt cannot say more was read than was sent.
   */
  it('a receipt signal marks my messages read, clamped to what I sent', async () => {
    getSent.mockReturnValue(E.succeed([mineToAnita()]));
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    await E.runPromise(store.loadConversations());
    store.listen();
    expect(signalHandlers, 'listening').toHaveLength(1);

    signalHandlers[0]({ type: 'Receipt', readUpTo: micros(T_SENT + 5_000), from: ANITA_AGENT });

    await vi.waitFor(() => expect(store.theirReadUpTo(ANITA)).toBe(T_SENT));
  });

  /**
   * The same mark rides in the body of the reader's next message, which is what brings a
   * receipt lost while this agent was offline. Nothing read it before.
   */
  it('the mark in a message body counts as a receipt too', async () => {
    getSent.mockReturnValue(E.succeed([mineToAnita()]));
    getInbox.mockReturnValue(E.succeed([fromAnitaWithMark(T_SENT + 5_000)]));
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();

    await E.runPromise(store.loadConversations());

    expect(store.theirReadUpTo(ANITA), 'read, as far as I had sent').toBe(T_SENT);
  });
});

describe('a read that fails during the load (F10)', () => {
  /**
   * The interests and the exchanges used to be read as "none" when their read failed, so
   * a conversation whose only content was an interest vanished with no error shown.
   */
  it('fails the load and says why, rather than reading as "no interests"', async () => {
    myInterests.mockReturnValue(E.fail(new Error('get_my_interests: no answer')));
    const store = await freshStore();

    await expect(E.runPromise(store.loadConversations())).rejects.toThrow();

    expect(store.error, 'the fault, for the screen').toContain('no answer');
  });
});

describe('a poll fetches only what is new', () => {
  /**
   * The zome is told what the store holds and sends back only the rest, plus the list
   * of what should still show. The store keeps the first, and drops anything no longer
   * listed, so a message from a since-rejected author leaves the screen without ever
   * being fetched again.
   *
   * **To make this go red:** send an empty `known` on every poll, or keep an entry the
   * zome stopped listing.
   */
  it('tells the zome what it holds, keeps it, and drops what the zome stops listing', async () => {
    const first = fromAnitaWithMark(T_SENT);
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    getInboxDelta
      .mockImplementationOnce(() =>
        E.succeed({ visible: [first.hash], entries: [first], skipped: [] })
      )
      .mockImplementationOnce(() => E.succeed({ visible: [first.hash], entries: [], skipped: [] }))
      .mockImplementationOnce(() => E.succeed({ visible: [], entries: [], skipped: [] }));
    const store = await freshStore();

    await E.runPromise(store.loadConversations());
    expect(store.threads, 'the message is read and shown').toHaveLength(1);

    await E.runPromise(store.loadConversations());
    expect(getInboxDelta.mock.calls[1][0], 'the second poll says what it holds').toEqual([
      first.hash
    ]);
    expect(store.threads, 'and still shows it, from what it held').toHaveLength(1);

    await E.runPromise(store.loadConversations());
    expect(store.threads, 'dropped once the zome stops listing it').toHaveLength(0);
  });

  it('hands back the role messages the zome listed, and never shows one as chat', async () => {
    // A role message is not personal chat. The zome opens it once to find that out and
    // lists its hash in `skipped`; handed back, it is not fetched and decrypted again.
    const roleMessage = hashes.LISTING;
    getInboxDelta
      .mockImplementationOnce(() => E.succeed({ visible: [], entries: [], skipped: [roleMessage] }))
      .mockImplementationOnce(() => E.succeed({ visible: [], entries: [], skipped: [roleMessage] }))
      .mockImplementationOnce(() => E.succeed({ visible: [], entries: [], skipped: [] }));
    const store = await freshStore();

    await E.runPromise(store.loadConversations());
    expect(getInboxDelta.mock.calls[0][1], 'the first poll has nothing to hand back').toEqual([]);
    expect(store.threads, 'a role message opens no personal thread').toHaveLength(0);

    await E.runPromise(store.loadConversations());
    expect(getInboxDelta.mock.calls[1][1], 'the second poll hands back what was listed').toEqual([
      roleMessage
    ]);
    expect(getInboxDelta.mock.calls[1][0], 'and does not claim to hold it as chat').toEqual([]);

    await E.runPromise(store.loadConversations());
    expect(
      getInboxDelta.mock.calls[2][1],
      'the third still hands it back, having been told so again'
    ).toEqual([roleMessage]);
  });
});

describe('blocking', () => {
  it('a block is kept on this device, and survives the reload it starts', async () => {
    const store = await freshStore();
    store.setBlocked(ANITA, true);
    await E.runPromise(store.loadConversations());
    expect(store.isBlocked(ANITA)).toBe(true);
    expect(store.blockedUsers()).toEqual([encodeHashToBase64(ANITA)]);
    const saved = localStorage.getItem(localKey(encodeHashToBase64(MY_AGENT)));
    expect(saved).toContain(encodeHashToBase64(ANITA));
  });
});

describe('a send whose answer was lost', () => {
  /** No answer at all: a timeout, or the socket going. Not something the zome said. */
  const noAnswer = { name: 'Error', message: 'Timed out waiting for the conductor' };
  /** The zome answered and said no, so nothing was written. */
  const refusal = { name: 'ribosome_error', message: 'Only an accepted member can send' };

  /**
   * The duplicate-prevention the outbox rests on: the chain is asked for the send id
   * before anything is sent again, and a send that is found is dropped, not repeated.
   */
  it('is not sent again when the chain already has it', async () => {
    const store = await freshStore();
    sendMessage.mockReturnValueOnce(E.fail(noAnswer)).mockReturnValue(E.succeed([]));
    await E.runPromise(store.send(ANITA, 'see you at ten'));
    expect(store.outbox, 'held with its send id').toHaveLength(1);
    const heldId = store.outbox[0].id;

    findSent.mockReturnValue(E.succeed(hashes.LISTING));
    await E.runPromise(store.flushOutbox());

    expect(findSent.mock.calls[0][0], 'asked for this very send').toMatchObject({
      sendId: heldId
    });
    expect(sendMessage, 'the one original call and no second copy').toHaveBeenCalledTimes(1);
    expect(store.outbox, 'dropped: it went').toHaveLength(0);
  });

  it('is handed to the member, not retried blind, when the chain cannot be asked', async () => {
    const store = await freshStore();
    sendMessage.mockReturnValueOnce(E.fail(noAnswer)).mockReturnValue(E.succeed([]));
    await E.runPromise(store.send(ANITA, 'see you at ten'));

    findSent.mockReturnValue(E.fail(new Error('find_sent: no answer')));
    await E.runPromise(store.flushOutbox());

    expect(sendMessage, 'nothing sent without knowing').toHaveBeenCalledTimes(1);
    expect(store.outbox[0]?.state).toBe('mayNotHaveSent');
  });

  it('a refusal on the retry stops the retrying and keeps the reason', async () => {
    const store = await freshStore();
    sendMessage.mockReturnValueOnce(E.fail(devicesNotFound)).mockReturnValue(E.fail(refusal));
    await E.runPromise(store.send(ANITA, 'see you at ten'));

    await E.runPromise(store.flushOutbox());

    expect(store.outbox[0]?.state).toBe('refused');
    expect(store.outbox[0]?.reason, "the zome's own reason, for the member").toContain(
      'Only an accepted member can send'
    );

    // Refused items are not picked up again by themselves.
    await E.runPromise(store.flushOutbox());
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('a held message can be discarded, and stays discarded after a reload', async () => {
    const store = await freshStore();
    sendMessage.mockReturnValue(E.fail(devicesNotFound));
    await E.runPromise(store.send(ANITA, 'see you at ten'));
    const heldId = store.outbox[0].id;

    store.discardUnsent(heldId);
    expect(store.outbox).toHaveLength(0);

    await E.runPromise(store.loadConversations());
    expect(store.outbox, 'not read back from storage').toHaveLength(0);
  });
});

describe('a blocked person', () => {
  /**
   * A block acts on what is read and on what arrives by signal. A nudge from someone
   * blocked must not start a read, their receipt must not be recorded, and a message of
   * theirs that could not be read must not appear as a fault row naming them.
   */
  it('their nudge starts no read', async () => {
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    await E.runPromise(store.loadConversations());
    store.setBlocked(ANITA, true);
    // Blocking re-reads the conversations itself; let that finish before counting.
    await new Promise((resolve) => setTimeout(resolve, 20));
    store.listen();
    const readsBefore = getSent.mock.calls.length;

    signalHandlers[0]({ type: 'Nudge', hash: hashes.LISTING, from: ANITA_AGENT });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(getSent.mock.calls.length, 'no read was started').toBe(readsBefore);
  });

  it('a nudge from someone not blocked does start a read', async () => {
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    await E.runPromise(store.loadConversations());
    store.listen();
    const readsBefore = getSent.mock.calls.length;

    signalHandlers[0]({ type: 'Nudge', hash: hashes.LISTING, from: ANITA_AGENT });

    await vi.waitFor(() => expect(getSent.mock.calls.length).toBeGreaterThan(readsBefore));
  });

  it('their receipt is not recorded', async () => {
    getSent.mockReturnValue(E.succeed([mineToAnita()]));
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    await E.runPromise(store.loadConversations());
    store.setBlocked(ANITA, true);
    store.listen();

    signalHandlers[0]({ type: 'Receipt', readUpTo: micros(T_SENT + 5_000), from: ANITA_AGENT });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(store.theirReadUpTo(ANITA)).toBe(0);
  });

  it('a message of theirs that could not be read is not shown as a fault', async () => {
    const unreadable = {
      type: 'Unreadable',
      hash: hashes.ME,
      from: ANITA_AGENT,
      at: micros(T_SENT)
    };
    getInbox.mockReturnValue(E.succeed([unreadable]));
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();

    await E.runPromise(store.loadConversations());
    expect(store.faults, 'shown while they are not blocked').toHaveLength(1);

    store.setBlocked(ANITA, true);
    await E.runPromise(store.loadConversations());
    expect(store.faults, 'hidden once they are').toHaveLength(0);
  });
});

describe('the first read and the ones after', () => {
  /** The list page shows "Loading" on `loading && !everLoaded`: the first read only. */
  it('says a read has finished, whether it went well or badly', async () => {
    const store = await freshStore();
    expect(store.everLoaded, 'nothing read yet').toBe(false);

    myInterests.mockReturnValue(E.fail(new Error('get_my_interests: no answer')));
    await expect(E.runPromise(store.loadConversations())).rejects.toThrow();

    expect(store.everLoaded, 'a failed read is still a finished one').toBe(true);
  });
});

describe('an outbox this device already holds', () => {
  const BELA = new Uint8Array(Array(39).fill(9));
  const KEY = localKey(encodeHashToBase64(MY_AGENT));
  const held = (id: string, to: Uint8Array, queuedAt: number) => ({
    id,
    to: encodeHashToBase64(to),
    content: `message ${id}`,
    queuedAt,
    state: 'waiting'
  });
  const stored = () =>
    (JSON.parse(localStorage.getItem(KEY) ?? '{}') as { outbox?: Array<{ id: string }> }).outbox ??
    [];

  /**
   * The outbox in memory starts empty and was filled only at the end of a successful
   * read of the conversations. If that read failed, a stored message was never retried.
   */
  it('is retried even when the conversations cannot be read', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 2, outbox: [held('old-1', ANITA, T_SENT)] })
    );
    const store = await freshStore();
    getInbox.mockReturnValue(E.fail(new Error('get_inbox_delta: no answer')));
    await expect(E.runPromise(store.loadConversations())).rejects.toThrow();
    sendMessage.mockReturnValue(E.succeed([]));

    await E.runPromise(store.flushOutbox());

    expect(findSent.mock.calls[0]?.[0], 'the chain was asked about it').toMatchObject({
      sendId: 'old-1'
    });
    expect(sendMessage, 'and it was sent').toHaveBeenCalledTimes(1);
    expect(stored(), 'and cleared').toHaveLength(0);
  });

  /** And the next held send wrote the in-memory list, the new message alone, over it. */
  it('is not overwritten by the next message to be held', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 2, outbox: [held('old-1', ANITA, T_SENT)] })
    );
    const store = await freshStore();
    sendMessage.mockReturnValue(E.fail(devicesNotFound));

    await E.runPromise(store.send(ANITA, 'a new one'));

    expect(
      stored().map((item) => item.id),
      'the earlier message is still held, ahead of the new one'
    ).toEqual(['old-1', store.outbox[1].id]);
  });

  /** One person being unreachable used to hold back every message to everyone. */
  it('one person out of reach does not hold back a message to somebody else', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        schemaVersion: 2,
        outbox: [
          held('to-anita-1', ANITA, T_SENT),
          held('to-anita-2', ANITA, T_SENT + 1),
          held('to-bela', BELA, T_SENT + 2)
        ]
      })
    );
    const store = await freshStore();
    sendMessage.mockImplementation((input: { sendId: string }) =>
      input.sendId === 'to-bela' ? E.succeed([]) : E.fail(devicesNotFound)
    );

    await E.runPromise(store.flushOutbox());

    const tried = sendMessage.mock.calls.map(([input]) => (input as { sendId: string }).sendId);
    expect(tried, 'her second waits behind her first; his goes').toEqual(['to-anita-1', 'to-bela']);
    expect(
      store.outbox.map((item) => item.id),
      'only hers are still held'
    ).toEqual(['to-anita-1', 'to-anita-2']);
  });

  /** The timer, the `online` event and "send again" can all ask at the same moment. */
  it('two runs asked for at once send a message once', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 2, outbox: [held('old-1', ANITA, T_SENT)] })
    );
    const store = await freshStore();
    // A send that takes a moment, as a real one does: the second run is asked for while
    // the first is still waiting on the conductor.
    sendMessage.mockReturnValue(E.sleep('20 millis').pipe(E.as([])));

    const first = E.runPromise(store.flushOutbox());
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = E.runPromise(store.flushOutbox());
    await Promise.all([first, second]);

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('nothing is tried while the conductor can reach nobody', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 2, outbox: [held('old-1', ANITA, T_SENT)] })
    );
    const store = await freshStore();
    peers.reachable = 0;

    await E.runPromise(store.flushOutbox());

    expect(findSent, 'not even the question').not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(store.outbox, 'still held').toHaveLength(1);
  });

  it('a refused message is sent again when the member says so', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        schemaVersion: 2,
        outbox: [{ ...held('old-1', ANITA, T_SENT), state: 'refused', reason: 'Not yet accepted' }]
      })
    );
    const store = await freshStore();
    sendMessage.mockReturnValue(E.succeed([]));

    await E.runPromise(store.flushOutbox());
    expect(sendMessage, 'left alone until asked').not.toHaveBeenCalled();

    await E.runPromise(store.retryUnsent('old-1'));

    expect(sendMessage, "sent on the member's word").toHaveBeenCalledTimes(1);
    expect(store.outbox).toHaveLength(0);
  });
});

describe('a blocked person is told nothing', () => {
  /** A proposal Anita wrote to me: a card, so her conversation exists though she is blocked. */
  const herProposal = (atMs: number) => ({
    agreement_hash: new Uint8Array(Array(39).fill(50)),
    status: 'Proposed',
    created_at: atMs,
    agreement: {
      listing: new Uint8Array(Array(39).fill(40)),
      listing_type: 'Offer',
      interest: new Uint8Array(Array(39).fill(41)),
      counterparty: hashes.ME,
      provider: ANITA,
      receiver: hashes.ME,
      primary: { direction: 'Provide', resource_conforms_to: 'x', resource_kind: 'Service' },
      reciprocal: { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift' },
      medium: 'Gift',
      terms: '',
      delivery_timeframe: ''
    }
  });
  afterEach(() => {
    exchangesNow.list = [];
  });

  it("a blocked person's proposal still shows, but does not count as unopened", async () => {
    exchangesNow.list = [herProposal(T_SENT)];
    const store = await freshStore();
    await E.runPromise(store.loadConversations());
    expect(unopenedConversations(store.threads), 'counted before the block').toBe(1);

    store.setBlocked(ANITA, true);
    await vi.waitFor(() => expect(unopenedConversations(store.threads)).toBe(0));
    expect(store.threads, 'the card is still there').toHaveLength(1);
  });

  it('opening a blocked person’s conversation sends them no receipt', async () => {
    exchangesNow.list = [herProposal(T_SENT)];
    const store = await freshStore();
    store.setBlocked(ANITA, true);
    await E.runPromise(store.loadConversations());

    store.markThreadRead(ANITA);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(sendReceipt).not.toHaveBeenCalled();
  });

  it('nor does a message to them carry the mark', async () => {
    exchangesNow.list = [herProposal(T_SENT)];
    const store = await freshStore();
    await E.runPromise(store.loadConversations());
    store.markThreadRead(ANITA);
    sendMessage.mockReturnValue(E.succeed([]));

    await E.runPromise(store.send(ANITA, 'before'));
    expect(sendMessage.mock.calls[0][0], 'carried while not blocked').toMatchObject({
      readUpTo: micros(T_SENT)
    });

    store.setBlocked(ANITA, true);
    await E.runPromise(store.send(ANITA, 'after'));
    expect((sendMessage.mock.calls[1][0] as { readUpTo?: number }).readUpTo).toBeUndefined();
  });
});

describe('a block storage refused to keep', () => {
  /** Private browsing, or a full quota: every write to storage throws. */
  const refuseWrites = () =>
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

  it('holds until a reload, through every read of the conversations', async () => {
    getInbox.mockReturnValue(
      E.succeed([
        {
          type: 'Read',
          hash: hashes.ME,
          from: ANITA_AGENT,
          to: MY_AGENT,
          at: micros(T_SENT),
          content: 'hello'
        }
      ])
    );
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    await E.runPromise(store.loadConversations());
    expect(store.threads).toHaveLength(1);
    const refused = refuseWrites();

    try {
      store.setBlocked(ANITA, true);
      await E.runPromise(store.loadConversations());
      await E.runPromise(store.loadConversations());

      expect(store.isBlocked(ANITA), 'still blocked').toBe(true);
      expect(store.threads, 'and her message still hidden').toHaveLength(0);
    } finally {
      refused.mockRestore();
    }
  });

  it('is written once storage takes it again, and then storage decides', async () => {
    const store = await freshStore();
    const refused = refuseWrites();
    store.setBlocked(ANITA, true);
    refused.mockRestore();

    store.setBlocked(ANITA, false);
    await E.runPromise(store.loadConversations());

    expect(store.isBlocked(ANITA), 'the later unblock is what holds').toBe(false);
  });
});

describe('receipts going out', () => {
  /** One of Anita's to me, with no mark of hers. */
  const fromAnita = (atMs: number, hash = hashes.ME) => ({
    type: 'Read',
    hash,
    from: ANITA_AGENT,
    to: MY_AGENT,
    at: micros(atMs),
    content: 'hello'
  });

  it('opening a conversation tells the other person how far it was read, once', async () => {
    getInbox.mockReturnValue(E.succeed([fromAnita(T_SENT)]));
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    await E.runPromise(store.loadConversations());

    store.markThreadRead(ANITA);
    await vi.waitFor(() => expect(sendReceipt).toHaveBeenCalledTimes(1));
    expect(sendReceipt.mock.calls[0][0]).toMatchObject({ toUser: ANITA, readUpTo: micros(T_SENT) });

    // Nothing new to have read: nothing more is said.
    store.markThreadRead(ANITA);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sendReceipt, 'only when the mark advances').toHaveBeenCalledTimes(1);
  });

  it('says nothing when this conversation does not send receipts', async () => {
    getInbox.mockReturnValue(E.succeed([fromAnita(T_SENT)]));
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    await E.runPromise(store.loadConversations());
    store.setReceiptsOverall(false);

    store.markThreadRead(ANITA);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(sendReceipt).not.toHaveBeenCalled();
  });

  it('the next message carries the same mark in its body', async () => {
    getInbox.mockReturnValue(E.succeed([fromAnita(T_SENT)]));
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();
    await E.runPromise(store.loadConversations());
    store.markThreadRead(ANITA);
    sendMessage.mockReturnValue(E.succeed([]));

    await E.runPromise(store.send(ANITA, 'see you at ten'));

    expect(sendMessage.mock.calls[0][0]).toMatchObject({ readUpTo: micros(T_SENT) });
  });
});

describe('what the outbox must not do', () => {
  const BELA = new Uint8Array(Array(39).fill(9));
  const KEY = localKey(encodeHashToBase64(MY_AGENT));
  const held = (id: string, to: Uint8Array, queuedAt: number) => ({
    id,
    to: encodeHashToBase64(to),
    content: `message ${id}`,
    queuedAt,
    state: 'waiting'
  });
  const store2 = (items: unknown[]) =>
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 2, outbox: items }));
  const storedIds = () =>
    (
      (JSON.parse(localStorage.getItem(KEY) ?? '{}') as { outbox?: Array<{ id: string }> })
        .outbox ?? []
    ).map((item) => item.id);
  const noAnswer = { name: 'Error', message: 'Timed out waiting for the conductor' };

  /**
   * **One message the keystore cannot encrypt must not hold up the rest** (the walk of
   * 15 November). Against zomes with the old 16 KiB limit Lair refuses it for its size,
   * and the conductor reports that as `internal_error`, which used to read as no answer.
   * It was retried for ever, and every later message to that person waited behind it
   * until the member found Discard. (With the limit at 3 KiB the zome refuses it first;
   * the test after this one covers that.)
   *
   * Now it is refused with a reason, which takes it out of the retrying, and the next
   * message to the same person goes on the next run, as after any refusal.
   *
   * **To make this go red:** remove the `isKeystoreFrameOverflow` branch from
   * `classifySendFailure`. The first stays waiting and the second never goes.
   */
  it('refuses a message the keystore cannot encrypt, and sends the next one to the same person', async () => {
    const store = await freshStore();
    store2([held('long', ANITA, 1), held('short', ANITA, 2)]);
    const overflow = {
      name: 'internal_error',
      message:
        'Wasm runtime error while working with Ribosome: RuntimeError: holochain::core::ribosome::host_fn::ed_25519_x_salsa20_poly1305_encrypt:43: Host("{\\"error\\":\\"FrameOverflow\\",\\"message\\":\\"11980 > 8192\\"}")'
    };
    findSent.mockReturnValue(E.succeed(null));
    sendMessage.mockReturnValueOnce(E.fail(overflow)).mockReturnValue(E.succeed([]));

    await E.runPromise(store.flushOutbox());
    const long = store.outbox.find((item) => item.id === 'long');
    expect(long?.state, 'refused, not waiting').toBe('refused');
    expect(long?.reason).toBe(MESSAGING_STRINGS.conversation.tooLongToEncrypt);

    await E.runPromise(store.flushOutbox());
    expect(
      store.outbox.map((item) => item.id),
      'the next message went; the refused one stays for the member'
    ).toEqual(['long']);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[1][0]).toMatchObject({ content: 'message short' });
  });

  /**
   * **The same for any refusal from the zome, as Holochain 0.7 sends it**: as
   * `internal_error`, not 0.6's `ribosome_error`, which every other fixture here uses. A
   * message refused for being too long, or because the sender is not accepted yet, is
   * refused with the zome's own sentence, and the next message to that person goes.
   *
   * **To make this go red:** remove `isZomeFailure` from `classifySendFailure`.
   */
  it('refuses on a 0.7 refusal from the zome, and sends the next one to the same person', async () => {
    const store = await freshStore();
    store2([held('long', ANITA, 1), held('short', ANITA, 2)]);
    const tooLong = {
      name: 'internal_error',
      message:
        'Wasm runtime error while working with Ribosome: RuntimeError: messaging::message:350: Guest("Message content is 3073 bytes, over the 3072 byte limit")'
    };
    findSent.mockReturnValue(E.succeed(null));
    sendMessage.mockReturnValueOnce(E.fail(tooLong)).mockReturnValue(E.succeed([]));

    await E.runPromise(store.flushOutbox());
    const long = store.outbox.find((item) => item.id === 'long');
    expect(long?.state).toBe('refused');
    expect(long?.reason, "the zome's own sentence, unwrapped").toBe(
      'Message content is 3073 bytes, over the 3072 byte limit'
    );

    await E.runPromise(store.flushOutbox());
    expect(store.outbox.map((item) => item.id)).toEqual(['long']);
    expect(sendMessage.mock.calls[1][0]).toMatchObject({ content: 'message short' });
  });

  /**
   * And sent straight away, a 0.7 refusal is reported as a refusal: not queued as
   * "Waiting to send", which is what the member saw for anything the zome said no to.
   */
  it('reports a 0.7 refusal on a send, and queues nothing', async () => {
    const store = await freshStore();
    sendMessage.mockReturnValue(
      E.fail({
        name: 'internal_error',
        message:
          'Wasm runtime error while working with Ribosome: RuntimeError: messaging::message:120: Guest("Your member profile is not accepted yet, so you cannot send messages")'
      })
    );

    const result = await E.runPromise(E.either(store.send(ANITA, 'see you at ten')));

    expect(result._tag, 'the send fails, so the screen can say why').toBe('Left');
    expect(store.outbox, 'nothing held to retry').toHaveLength(0);
  });

  /**
   * `find_sent` skips everything older than `since`. An attempt that committed and then
   * lost its answer wrote its links *before* the failure was noticed, so a search that
   * starts when the item was queued never sees them and the message goes twice.
   */
  it('asks the chain from before the first attempt, not from when it failed', async () => {
    const store = await freshStore();
    let firstAttemptAt = 0;
    sendMessage.mockImplementationOnce(() => {
      firstAttemptAt = Date.now();
      // The call commits, then the answer is lost a little later.
      return E.sleep('30 millis').pipe(E.zipRight(E.fail(noAnswer)));
    });
    await E.runPromise(store.send(ANITA, 'see you at ten'));
    expect(store.outbox, 'held').toHaveLength(1);

    // The zome's own rule: found only if the link is not older than `since`.
    const committedAtMicros = firstAttemptAt * 1000;
    findSent.mockImplementation((input: { since: number }) =>
      E.succeed(committedAtMicros >= input.since ? hashes.LISTING : null)
    );
    await E.runPromise(store.flushOutbox());

    expect(sendMessage, 'found, so not sent a second time').toHaveBeenCalledTimes(1);
    expect(store.outbox).toHaveLength(0);
  });

  it('looks from five seconds before the attempt, for a clock that disagrees', async () => {
    const store = await freshStore();
    // The clock is held still, so this is the exact time and not a race with it.
    const pressed = 1_760_000_123_456;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(pressed);
    sendMessage.mockReturnValueOnce(E.fail(noAnswer));
    findSent.mockReturnValue(E.succeed(null));
    try {
      await E.runPromise(store.send(ANITA, 'see you at ten'));
      await E.runPromise(store.flushOutbox());
    } finally {
      clock.mockRestore();
    }

    const since = (findSent.mock.calls[0][0] as { since: number }).since / 1000;
    expect(since, 'five seconds before Send was pressed').toBe(pressed - 5_000);
  });

  it('does not send a message discarded while the chain was being asked about it', async () => {
    store2([held('a', ANITA, T_SENT)]);
    const store = await freshStore();
    findSent.mockReturnValue(E.sleep('30 millis').pipe(E.as(null)));
    sendMessage.mockReturnValue(E.succeed([]));

    const run = E.runPromise(store.flushOutbox());
    await new Promise((resolve) => setTimeout(resolve, 10));
    store.discardUnsent('a');
    await run;

    expect(sendMessage).not.toHaveBeenCalled();
  });

  /** "Send again" pressed during a run only waited for that run, whose list was older. */
  it('sends again at once, even when a run is already under way', async () => {
    store2([
      held('a', ANITA, T_SENT),
      { ...held('b', BELA, T_SENT + 1), state: 'refused', reason: 'Not yet accepted' }
    ]);
    const store = await freshStore();
    sendMessage.mockReturnValue(E.sleep('20 millis').pipe(E.as([])));

    const run = E.runPromise(store.flushOutbox());
    await new Promise((resolve) => setTimeout(resolve, 5));
    await E.runPromise(store.retryUnsent('b'));
    await run;

    const sent = sendMessage.mock.calls.map(([input]) => (input as { sendId: string }).sendId);
    expect(sent).toEqual(['a', 'b']);
    expect(store.outbox).toHaveLength(0);
  });

  /** Storage that refused the write still says "waiting"; this store knows better. */
  it('does not go back to retrying a refused message when storage kept the old state', async () => {
    store2([held('a', ANITA, T_SENT)]);
    const store = await freshStore();
    sendMessage.mockReturnValue(
      E.fail({ name: 'ribosome_error', message: 'Only an accepted member can send' })
    );
    const refuse = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      await E.runPromise(store.flushOutbox());
      await E.runPromise(store.loadConversations());
      await E.runPromise(store.flushOutbox());
    } finally {
      refuse.mockRestore();
    }

    expect(store.outbox[0]?.state).toBe('refused');
    expect(sendMessage, 'tried once, not on every run').toHaveBeenCalledTimes(1);
  });

  it('keeps a refusal on the device, so it is still refused after a reload', async () => {
    store2([held('a', ANITA, T_SENT)]);
    const store = await freshStore();
    sendMessage.mockReturnValue(
      E.fail({ name: 'ribosome_error', message: 'Only an accepted member can send' })
    );

    await E.runPromise(store.flushOutbox());

    const kept = (
      JSON.parse(localStorage.getItem(KEY) ?? '{}') as {
        outbox: Array<{ state: string; reason?: string }>;
      }
    ).outbox[0];
    expect(kept.state).toBe('refused');
    expect(kept.reason).toContain('Only an accepted member can send');
  });

  /** A second ask straight after a silent send is the worst moment to ask the chain. */
  it('"send again" asks the chain once when no run was under way', async () => {
    store2([{ ...held('a', ANITA, T_SENT), state: 'refused', reason: 'Not yet accepted' }]);
    const store = await freshStore();
    sendMessage.mockReturnValue(E.fail(noAnswer));

    await E.runPromise(store.retryUnsent('a'));

    expect(findSent).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps a message refused after its conversation was left, for that person', async () => {
    const store = await freshStore();

    store.keepRefused(ANITA, 'to Anita', 'Only an accepted member can send');

    expect(store.outbox[0]).toMatchObject({
      to: encodeHashToBase64(ANITA),
      content: 'to Anita',
      state: 'refused',
      reason: 'Only an accepted member can send'
    });
    await E.runPromise(store.flushOutbox());
    expect(sendMessage, 'not retried without the member').not.toHaveBeenCalled();
  });

  /** Kept before the stored outbox had been read, it wrote over what was stored. */
  it('keeps a refused message beside what is already stored, on a store that has read nothing', async () => {
    store2([held('a', ANITA, T_SENT)]);
    const store = await freshStore();

    store.keepRefused(ANITA, 'to Anita', 'Only an accepted member can send');

    expect(storedIds()).toHaveLength(2);
    expect(storedIds()).toContain('a');
  });

  it('keeps that refused message on the device, so a reload still shows it', async () => {
    const store = await freshStore();

    store.keepRefused(ANITA, 'to Anita', 'Only an accepted member can send');

    const reopened = await freshStore();
    await E.runPromise(reopened.flushOutbox());
    expect(reopened.outbox).toHaveLength(1);
    expect(reopened.outbox[0]).toMatchObject({ content: 'to Anita', state: 'refused' });
  });

  it('leaves out a stored item whose listing is not a hash', async () => {
    store2([{ ...held('bad', ANITA, T_SENT), listing: 42 }, held('a', ANITA, T_SENT + 1)]);
    const store = await freshStore();
    sendMessage.mockReturnValue(E.succeed([]));

    await E.runPromise(store.flushOutbox());

    const sent = sendMessage.mock.calls.map(([input]) => (input as { sendId: string }).sendId);
    expect(sent).toEqual(['a']);
  });

  it('does not send a message discarded while the run was under way', async () => {
    store2([held('a', ANITA, T_SENT), held('b', BELA, T_SENT + 1)]);
    const store = await freshStore();
    sendMessage.mockReturnValue(E.sleep('20 millis').pipe(E.as([])));

    const run = E.runPromise(store.flushOutbox());
    await new Promise((resolve) => setTimeout(resolve, 5));
    store.discardUnsent('b');
    await run;

    const sent = sendMessage.mock.calls.map(([input]) => (input as { sendId: string }).sendId);
    expect(sent).toEqual(['a']);
  });

  /** Storage can refuse a write and go on holding the old list. */
  it('does not bring back a discarded message that storage failed to forget', async () => {
    store2([held('a', ANITA, T_SENT)]);
    const store = await freshStore();
    const refuse = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      store.discardUnsent('a');
      await E.runPromise(store.loadConversations());
      sendMessage.mockReturnValue(E.succeed([]));
      await E.runPromise(store.flushOutbox());
    } finally {
      refuse.mockRestore();
    }

    expect(store.outbox, 'still gone from the screen').toHaveLength(0);
    expect(sendMessage, 'and not sent').not.toHaveBeenCalled();
  });

  it('keeps a held message that storage refused to keep, across a read', async () => {
    const store = await freshStore();
    sendMessage.mockReturnValue(E.fail(devicesNotFound));
    const refuse = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      await E.runPromise(store.send(ANITA, 'see you at ten'));
      await E.runPromise(store.loadConversations());
    } finally {
      refuse.mockRestore();
    }

    expect(store.outbox, 'on screen, though not on the device').toHaveLength(1);
  });

  it('sends oldest first, whatever order the device holds them in', async () => {
    store2([held('later', ANITA, T_SENT + 10), held('earlier', BELA, T_SENT)]);
    const store = await freshStore();
    sendMessage.mockReturnValue(E.succeed([]));

    await E.runPromise(store.flushOutbox());

    const sent = sendMessage.mock.calls.map(([input]) => (input as { sendId: string }).sendId);
    expect(sent).toEqual(['earlier', 'later']);
  });

  it('takes a message the chain already has off the device too', async () => {
    store2([held('a', ANITA, T_SENT)]);
    const store = await freshStore();
    findSent.mockReturnValue(E.succeed(hashes.LISTING));

    await E.runPromise(store.flushOutbox());

    expect(storedIds()).toEqual([]);
  });

  /** Discard and "send again" act on what the device holds, before any read has run. */
  it('discards a stored message on a store that has read nothing', async () => {
    store2([held('a', ANITA, T_SENT), held('b', BELA, T_SENT + 1)]);
    const store = await freshStore();

    store.discardUnsent('a');

    expect(storedIds(), 'the other one is kept, not overwritten').toEqual(['b']);
  });

  /** The timer waits up to its interval; coming back online should not. */
  it('tries the outbox again as soon as the browser says it is back online', async () => {
    store2([held('a', ANITA, T_SENT)]);
    const store = await freshStore();
    findSent.mockReturnValue(E.succeed(null));
    // Nothing gets through, so it is still waiting for the next time.
    sendMessage.mockReturnValue(E.fail(devicesNotFound));
    const stop = store.startRetrying();

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.outbox[0]?.state, 'still waiting').toBe('waiting');

    stop();
    window.dispatchEvent(new Event('online'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(sendMessage, 'and not once stopped').toHaveBeenCalledTimes(1);
  });

  it('sends a stored message again on a store that has read nothing', async () => {
    store2([{ ...held('a', ANITA, T_SENT), state: 'mayNotHaveSent' }]);
    const store = await freshStore();
    sendMessage.mockReturnValue(E.succeed([]));

    await E.runPromise(store.retryUnsent('a'));

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('the timer stops when it is told to', async () => {
    store2([held('a', ANITA, T_SENT)]);
    const store = await freshStore();
    findSent.mockReturnValue(E.succeed(null));
    sendMessage.mockReturnValue(E.fail(devicesNotFound));
    vi.useFakeTimers();
    const stop = store.startRetrying();
    await vi.advanceTimersByTimeAsync(31_000);
    const tries = sendMessage.mock.calls.length;
    expect(tries, 'it was running').toBeGreaterThan(0);

    stop();
    await vi.advanceTimersByTimeAsync(120_000);
    vi.useRealTimers();

    expect(sendMessage).toHaveBeenCalledTimes(tries);
  });

  it('the timer picks up a stored message with no read and no page open', async () => {
    store2([held('a', ANITA, T_SENT)]);
    const store = await freshStore();
    sendMessage.mockReturnValue(E.succeed([]));
    vi.useFakeTimers();
    const stop = store.startRetrying();
    await vi.advanceTimersByTimeAsync(31_000);
    stop();
    vi.useRealTimers();

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
  });

  /** One item with no recipient used to throw in the loop and stop everything behind it. */
  it('is not stopped by a stored item it cannot read', async () => {
    store2([
      { id: 'broken', content: 'no recipient', queuedAt: T_SENT, state: 'waiting' },
      held('a', ANITA, T_SENT + 1)
    ]);
    const store = await freshStore();
    sendMessage.mockReturnValue(E.succeed([]));

    await E.runPromise(store.flushOutbox());

    const sent = sendMessage.mock.calls.map(([input]) => (input as { sendId: string }).sendId);
    expect(sent).toEqual(['a']);
  });
});

describe('a blocked person, in what is read', () => {
  it('their messages are left out of the conversations', async () => {
    const theirs = {
      type: 'Read',
      hash: hashes.ME,
      from: ANITA_AGENT,
      to: MY_AGENT,
      at: micros(T_SENT),
      content: 'hello'
    };
    getInbox.mockReturnValue(E.succeed([theirs]));
    userByAgent.mockReturnValue({ original_action_hash: ANITA });
    const store = await freshStore();

    await E.runPromise(store.loadConversations());
    expect(
      store.threads.flatMap((t) => t.messages),
      'shown while not blocked'
    ).toHaveLength(1);

    store.setBlocked(ANITA, true);
    await E.runPromise(store.loadConversations());
    expect(
      store.threads.flatMap((t) => t.messages),
      'left out once blocked'
    ).toHaveLength(0);
  });
});
