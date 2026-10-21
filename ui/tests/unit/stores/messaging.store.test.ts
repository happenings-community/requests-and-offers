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
  getSent,
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
    getSent: vi.fn(),
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
    getSent: () => getSent(),
    sendReceipt: () => Effect.void
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
    getNetworkPeerStatus: () => Promise.resolve({ reachable: 1, known: 1 }),
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
