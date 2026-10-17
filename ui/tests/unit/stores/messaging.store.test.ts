import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect as E } from 'effect';
import { encodeHashToBase64 } from '@holochain/client';
import { localKey } from '$lib/utils/messaging-local';
import type { MessagingStore } from '$lib/stores/messaging.store.svelte';

/**
 * The messaging store around the outbox and the local state, with the zome stood in for.
 *
 * Each test takes a fresh copy of the store, because the thing under test is what the
 * store does before and between loads: a setting changed on a cold page, a message that
 * waits with nothing else on screen.
 */

const { hashes, sendMessage, findSent } = vi.hoisted(() => {
  const hash = (n: number) => new Uint8Array(Array(39).fill(n));
  return {
    hashes: { ME: hash(1), MY_AGENT: hash(2), ANITA: hash(3), LISTING: hash(4) },
    sendMessage: vi.fn(),
    findSent: vi.fn()
  };
});
const { MY_AGENT, ANITA, LISTING } = hashes;

vi.mock('$lib/services/zomes/messaging.service', async () => {
  const { Context, Effect, Layer } = await import('effect');
  const MessagingServiceTag = Context.GenericTag<unknown>('MessagingService');
  const service = {
    sendMessage: (...a: unknown[]) => sendMessage(...a),
    findSent: (...a: unknown[]) => findSent(...a),
    getInbox: () => Effect.succeed([]),
    getSent: () => Effect.succeed([]),
    sendReceipt: () => Effect.void
  };
  return { MessagingServiceTag, MessagingServiceLive: Layer.succeed(MessagingServiceTag, service) };
});

vi.mock('$lib/services/HolochainClientService.svelte', async () => {
  const { Context, Layer } = await import('effect');
  const HolochainClientServiceTag = Context.GenericTag<unknown>('HolochainClientService');
  const client = {
    isConnected: true,
    getNetworkPeerStatus: () => Promise.resolve({ reachable: 1, known: 1 }),
    onZomeSignal: () => () => {}
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
      currentUser: { original_action_hash: hashes.ME, agents: [hashes.MY_AGENT] },
      getUserByAgentPubKey: () => Effect.succeed(null),
      getUserByActionHash: () => Effect.succeed(null)
    }
  };
});

vi.mock('$lib/stores/exchanges.store.svelte', async () => {
  const { Effect } = await import('effect');
  return {
    default: {
      getMyInterests: () => Effect.succeed([]),
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
  vi.resetModules();
  return (await import('$lib/stores/messaging.store.svelte')).default;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  findSent.mockReturnValue(E.succeed(null));
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
    expect(sendMessage.mock.calls[1][0]).toMatchObject({ toUser: ANITA, content: 'see you at ten' });
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
