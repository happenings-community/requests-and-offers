import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import { encodeHashToBase64 } from '@holochain/client';
import { localKey } from '$lib/utils/messaging-local';
import { setPage } from '../../mocks/app-stores';
import BlockedPage from '../../../src/routes/(public)/messages/blocked/+page.svelte';
import ConversationPage from '../../../src/routes/(public)/messages/[user]/+page.svelte';

/**
 * **A block, and an unblock, show on the screen the member did it on.**
 *
 * Blocks live in local storage, which no Svelte signal watches. The store is the one
 * place that reads and writes them, so it is the store that has to say when they change;
 * otherwise a page computes who is blocked once at mount and never again, and Unblock
 * leaves the row where it was while the block itself is lifted (review of 16 October,
 * F6 and F7). These mount the real pages on the real store, with only the zome stood in
 * for.
 */

const { hashes } = vi.hoisted(() => {
  const hash = (n: number) => new Uint8Array(Array(39).fill(n));
  return { hashes: { ME: hash(1), MY_AGENT: hash(2), ANITA: hash(3) } };
});
const { MY_AGENT, ANITA } = hashes;

vi.mock('$lib/services/zomes/messaging.service', async () => {
  const { Context, Effect, Layer } = await import('effect');
  const MessagingServiceTag = Context.GenericTag<unknown>('MessagingService');
  const service = {
    sendMessage: () => Effect.succeed([]),
    findSent: () => Effect.succeed(null),
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
      getUserByActionHash: () => Effect.succeed({ name: 'Anita Rossi', original_action_hash: hashes.ANITA })
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

vi.mock('@skeletonlabs/skeleton', () => ({
  getModalStore: () => ({ trigger: vi.fn() }),
  getToastStore: () => ({ trigger: vi.fn() })
}));

const KEY = localKey(encodeHashToBase64(MY_AGENT));
const anita = encodeHashToBase64(ANITA);

beforeEach(() => {
  cleanup();
  localStorage.clear();
  setPage({ user: anita });
});

describe('the blocked members page', () => {
  it('takes the row away when Unblock is pressed', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        schemaVersion: 2,
        blocked: [anita],
        blockHistory: [{ user: anita, blocked: true, at: 1_760_000_000_000 }]
      })
    );
    render(BlockedPage);

    await fireEvent.click(await screen.findByRole('button', { name: 'Unblock' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Unblock' })).toBeNull());
    expect(screen.getByText("You haven't blocked anyone.")).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { blocked: string[] };
    expect(stored.blocked, 'and the block really is lifted').toEqual([]);
  });
});

describe('the conversation page', () => {
  it('shows the block as soon as it is confirmed, and the unblock likewise', async () => {
    render(ConversationPage);

    await fireEvent.click(await screen.findByRole('button', { name: 'Block' }));
    await fireEvent.click(await screen.findByRole('button', { name: 'Block Anita Rossi' }));

    expect(await screen.findByText("You've blocked Anita Rossi.")).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    expect(await screen.findByRole('button', { name: 'Block' })).toBeTruthy();
    expect(screen.queryByText("You've blocked Anita Rossi.")).toBeNull();
  });
});
