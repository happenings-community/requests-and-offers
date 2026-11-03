import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Effect as E, Layer, pipe } from 'effect';
import type { AppWebsocket } from '@holochain/client';
import { HreaServiceLive, HreaServiceTag, type HreaService } from '@/lib/services/hrea.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks: ApolloClient + the hREA GraphQL schema adapter.
// The service builds its Apollo client once (memoized) via SchemaLink over a
// createHolochainSchema. We stub the schema + link so the client is inert, and
// route all traffic through the mocked mutate/query fns.
// ─────────────────────────────────────────────────────────────────────────────
const mockMutate = vi.fn();
const mockQuery = vi.fn();

vi.mock('@apollo/client/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client/core')>();
  return {
    ...actual,
    ApolloClient: vi.fn().mockImplementation(() => ({
      mutate: mockMutate,
      query: mockQuery
    }))
  };
});

vi.mock('@valueflows/vf-graphql-holochain', () => ({
  createHolochainSchema: vi.fn().mockReturnValue({})
}));

vi.mock('@apollo/client/link/schema', () => ({
  SchemaLink: vi.fn().mockImplementation(() => ({}))
}));

// ─────────────────────────────────────────────────────────────────────────────
// Test utilities
// ─────────────────────────────────────────────────────────────────────────────
const createMockHolochainClientService = () => ({
  appId: 'test-app',
  client: {} as AppWebsocket,
  isConnected: true,
  isConnecting: false,
  weaveClient: null,
  profilesClient: null,
  isWeaveContext: false,
  connectClient: vi.fn(),
  waitForConnection: vi.fn(() => Promise.resolve()),
  getAppInfo: vi.fn(),
  getPeerMetaInfo: vi.fn(() => Promise.resolve({})),
  callZome: vi.fn(),
  callZomeRawEffect: vi.fn(),
  callZomeEffect: vi.fn(),
  verifyConnection: vi.fn(),
  getNetworkSeed: vi.fn(() => Promise.resolve('test-network-seed')),
  getNetworkInfo: vi.fn(() =>
    Promise.resolve({
      networkSeed: 'test-network-seed',
      dnaHash: 'test-dna-hash',
      roleName: 'requests_and_offers',
      integrityZomeNames: []
    })
  ),
  getNetworkPeers: vi.fn(() => Promise.resolve(['peer1', 'peer2', 'peer3'])),
  isGroupProgenitor: vi.fn(() => Promise.resolve(false)),
  getNetworkPeerStatus: vi.fn()
});

const createServiceTestRunner = (
  mockClient: ReturnType<typeof createMockHolochainClientService>
) => {
  const testLayer = Layer.succeed(HolochainClientServiceTag, mockClient);
  const liveLayer = Layer.provide(HreaServiceLive, testLayer);

  return <T, E>(effect: E.Effect<T, E, HreaServiceTag>) =>
    E.runPromise(pipe(effect, E.provide(liveLayer)));
};

// After a reload the store finds an agreement's hREA mirror by reading hREA
// itself, so the service reads every Agreement and every Commitment.

describe('HreaService agreement and commitment reads', () => {
  let runServiceEffect: ReturnType<typeof createServiceTestRunner>;

  beforeEach(() => {
    vi.clearAllMocks();
    runServiceEffect = createServiceTestRunner(createMockHolochainClientService());
  });

  const call = <T>(fn: (s: HreaService) => E.Effect<T, unknown>) =>
    runServiceEffect(
      E.gen(function* () {
        const service = yield* HreaServiceTag;
        return yield* fn(service);
      })
    );

  it('getAgreements maps edges to normalized agreements, read from the network', async () => {
    mockQuery.mockResolvedValue({
      data: {
        agreements: {
          edges: [
            {
              node: {
                id: 'agr-1',
                revisionId: 'r1',
                name: 'Offer: Bikes',
                note: 'uhCkk',
                created: null
              }
            }
          ]
        }
      }
    });
    expect(await call((s) => s.getAgreements())).toEqual([
      { id: 'agr-1', revisionId: 'r1', name: 'Offer: Bikes', note: 'uhCkk', created: undefined }
    ]);
    expect(mockQuery.mock.calls[0][0].fetchPolicy).toBe('network-only');
  });

  it('getCommitments flattens nested relations, clauseOf included', async () => {
    mockQuery.mockResolvedValue({
      data: {
        commitments: {
          edges: [
            {
              node: {
                id: 'c-1',
                revisionId: 'r1',
                action: { id: 'work' },
                provider: { id: 'a-1' },
                receiver: { id: 'a-2' },
                resourceConformsTo: { id: 'spec-1' },
                resourceQuantity: null,
                due: null,
                finished: false,
                note: null,
                agreedIn: 'uhCkk',
                clauseOf: { id: 'agr-1' }
              }
            }
          ]
        }
      }
    });
    const [c] = await call((s) => s.getCommitments());
    expect(c).toMatchObject({
      id: 'c-1',
      revisionId: 'r1',
      provider: 'a-1',
      receiver: 'a-2',
      clauseOf: 'agr-1'
    });
  });

  it('returns [] when hREA has none, and propagates a real failure', async () => {
    mockQuery.mockResolvedValueOnce({ data: { agreements: { edges: [] } } });
    expect(await call((s) => s.getAgreements())).toEqual([]);
    mockQuery.mockRejectedValueOnce(new Error('commitments failed'));
    await expect(call((s) => s.getCommitments())).rejects.toThrow('commitments failed');
  });
});
