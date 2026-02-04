import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Effect as E, Layer, pipe } from 'effect';
import type { AppWebsocket } from '@holochain/client';
import { HreaServiceLive, HreaServiceTag, type HreaService } from '@/lib/services/hrea.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { HreaError } from '$lib/errors';
import { ApolloClient, gql } from '@apollo/client/core';
import type { Agent } from '$lib/types/hrea';

const mockMutate = vi.fn();
vi.mock('@apollo/client/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client/core')>();
  return {
    ...actual,
    ApolloClient: vi.fn().mockImplementation(() => ({
      mutate: mockMutate
    }))
  };
});

vi.mock('@valueflows/vf-graphql-holochain', () => ({
  createHolochainSchema: vi.fn().mockReturnValue({})
}));

vi.mock('@apollo/client/link/schema', () => ({
  SchemaLink: vi.fn().mockImplementation(() => ({}))
}));

// Test utilities
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
      roleName: 'requests_and_offers'
    })
  ),
  getNetworkPeers: vi.fn(() => Promise.resolve(['peer1', 'peer2', 'peer3'])),
  isGroupProgenitor: vi.fn(() => Promise.resolve(false))
});

const createServiceTestRunner = (
  mockClient: ReturnType<typeof createMockHolochainClientService>
) => {
  const testLayer = Layer.succeed(HolochainClientServiceTag, mockClient);
  const liveLayer = Layer.provide(HreaServiceLive, testLayer);

  return <T, E>(effect: E.Effect<T, E, HreaServiceTag>) =>
    E.runPromise(pipe(effect, E.provide(liveLayer)));
};

describe('HreaService', () => {
  let mockHolochainClient: ReturnType<typeof createMockHolochainClientService>;
  let runServiceEffect: ReturnType<typeof createServiceTestRunner>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHolochainClient = createMockHolochainClientService();
    runServiceEffect = createServiceTestRunner(mockHolochainClient);
  });

  describe('initialize', () => {
    it('should initialize Apollo Client successfully', async () => {
      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* HreaServiceTag;
          return yield* service.initialize();
        })
      );

      // Assert
      expect(result).toEqual(expect.objectContaining({ mutate: expect.any(Function) }));
      expect(mockHolochainClient.waitForConnection).toHaveBeenCalled();
      expect(ApolloClient).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      // Arrange: make waitForConnection reject so E.tryPromise catches and wraps the error
      mockHolochainClient.waitForConnection.mockRejectedValue(
        new Error('Connection failed')
      );

      const effect = E.gen(function* () {
        const service = yield* HreaServiceTag;
        return yield* service.initialize();
      });

      // The error is wrapped by HreaError.fromError with HREA_CONTEXTS.INITIALIZE context
      // HreaError preserves the original error message
      await expect(runServiceEffect(effect)).rejects.toThrow('Connection failed');
    });
  });

  describe('createPerson', () => {
    const personParams = { name: 'John Doe', note: 'A test person' };
    const mockAgent: Agent = {
      id: 'agent1',
      name: 'John Doe',
      note: 'A test person'
    };

    it('should create a person successfully', async () => {
      // Arrange
      mockMutate.mockResolvedValue({
        data: {
          createPerson: {
            agent: mockAgent
          }
        }
      });

      // Act - createPerson calls initialize() internally, no need to call it separately
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* HreaServiceTag;
          return yield* service.createPerson(personParams);
        })
      );

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            person: {
              name: personParams.name,
              note: personParams.note
            }
          }
        })
      );
      expect(result).toEqual(mockAgent);
    });

    it('should handle GraphQL errors during person creation', async () => {
      // Arrange
      const graphqlError = new Error('Failed to create person agent');
      mockMutate.mockRejectedValue(graphqlError);

      const effect = E.gen(function* () {
        const service = yield* HreaServiceTag;
        return yield* service.createPerson(personParams);
      });

      // Act & Assert
      await expect(runServiceEffect(effect)).rejects.toThrow('Failed to create person agent');
    });

    it('should handle schema decoding errors', async () => {
      // Arrange
      mockMutate.mockResolvedValue({
        data: {
          createPerson: {
            agent: { id: 'agent1' } // Missing 'name' field
          }
        }
      });

      const effect = E.gen(function* () {
        const service = yield* HreaServiceTag;
        return yield* service.createPerson(personParams);
      });

      // Act & Assert
      await expect(runServiceEffect(effect)).rejects.toThrow('is missing');
    });
  });
});
