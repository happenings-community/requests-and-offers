import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect as E } from 'effect';
import { encodeHashToBase64 } from '@holochain/client';
import { localKey } from '$lib/utils/messaging-local';
import { createMessagingStore, type MessagingStore } from '$lib/stores/messaging.store.svelte';

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
      loadMyExchanges: () => Effect.succeed([])
    }
  };
});

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
