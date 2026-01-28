import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect, pipe } from 'effect';
import { runEffect } from '$lib/utils/effect';
import { createRequestsStore, type RequestsStore } from '$lib/stores/requests.store.svelte';
import { createTestRequest, createMockRecord, actionHashToString } from '../test-helpers';
import { createTestContext } from '../../mocks/services.mock';
import type { RequestsService } from '$lib/services/zomes/requests.service';
import { RequestsServiceTag } from '$lib/services/zomes/requests.service';
import { CacheServiceTag, CacheServiceLive } from '$lib/utils/cache.svelte';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';

// Mock the holochain client service
const createMockHolochainClientService = () => ({
  appId: 'test-app-id',
  client: null,
  isConnected: false,
  isConnecting: false,
  weaveClient: null,
  profilesClient: null,
  isWeaveContext: false,
  connectClient: vi.fn(),
  waitForConnection: vi.fn(() => Promise.resolve()),
  getAppInfo: vi.fn(),
  getPeerMetaInfo: vi.fn(() => Promise.resolve({})),
  callZome: vi.fn(),
  verifyConnection: vi.fn(),
  getNetworkSeed: vi.fn(() => Promise.resolve('test-network-seed')),
  getNetworkInfo: vi.fn(() => Promise.resolve({
    networkSeed: 'test-network-seed',
    dnaHash: 'test-dna-hash',
    roleName: 'requests_and_offers'
  })),
  getNetworkPeers: vi.fn(() => Promise.resolve(['peer1', 'peer2', 'peer3']))
});
import { actionHashToSchemaType } from '$lib/utils/type-bridges';
import { Effect as E } from 'effect';

// Mock the organizationsStore
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: {
    getAcceptedOrganizations: vi.fn(() => E.succeed([])),
    organizations: []
  }
}));

// Mock the usersStore
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    getUserByAgentPubKey: vi.fn(() =>
      E.succeed({
        original_action_hash: new Uint8Array([1, 2, 3]),
        agent_pub_key: new Uint8Array([4, 5, 6]),
        resource: { name: 'Test User' }
      })
    ),
    currentUser: {
      original_action_hash: new Uint8Array([1, 2, 3]),
      agent_pub_key: new Uint8Array([4, 5, 6]),
      resource: { name: 'Test User' }
    }
  }
}));

vi.mock('$lib/stores/serviceTypes.store.svelte', () => ({
  default: {
    getServiceTypesForEntity: vi.fn(() => E.succeed([]))
  }
}));

describe('Requests Store', () => {
  let store: RequestsStore;
  let mockRequestsService: RequestsService;
  let testContext: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    testContext = await createTestContext();

    // Get the mock service from the context
    mockRequestsService = await Effect.runPromise(
      Effect.provide(RequestsServiceTag, testContext.requestsLayer)
    );

    // Create mock AppServices for testing
    const mockAppServices = {
      holochainClient: {} as any,
      holochainClientEffect: {} as any,
      hrea: {} as any,
      users: {} as any,
      administration: {} as any,
      offers: {} as any,
      requests: mockRequestsService,
      serviceTypes: {} as any,
      organizations: {} as any,
      mediumsOfExchange: {} as any
    };

    // Create store instance using the Effect pattern with correct service dependencies
    store = await Effect.runPromise(
      createRequestsStore().pipe(
        E.provideService(RequestsServiceTag, mockRequestsService),
        E.provide(CacheServiceLive),
        E.provideService(HolochainClientServiceTag, createMockHolochainClientService())
      )
    );
  });

  it('should initialize with empty state', () => {
    expect(store.requests).toEqual([]);
    expect(store.error).toBeNull();
  });

  it('should create a request', async () => {
    const newRequest = await createTestRequest();

    const effect = pipe(store.createRequest(newRequest));

    const result = await runEffect(effect);

    // The store converts Uint8Array service_type_hashes to base64 strings using actionHashToString
    const expectedRequest = {
      ...newRequest,
      service_type_hashes: newRequest.service_type_hashes.map((hash: any) =>
        typeof hash === 'string' ? hash : actionHashToSchemaType(hash)
      )
    };

    expect(mockRequestsService.createRequest).toHaveBeenCalledWith(expectedRequest, undefined);
    expect(result).toBeDefined();
  });

  it('should update a request', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;
    const updatedRequest = await createTestRequest();

    const effect = pipe(store.updateRequest(mockHash, mockHash, updatedRequest));

    const result = await runEffect(effect);
    expect(mockRequestsService.updateRequest).toHaveBeenCalledWith(
      mockHash,
      mockHash,
      updatedRequest
    );
    expect(result).toBeDefined();
  });

  it('should delete a request', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;

    const effect = pipe(store.deleteRequest(mockHash));

    await runEffect(effect);
    expect(mockRequestsService.deleteRequest).toHaveBeenCalledWith(mockHash);
  });

  it('should get all requests and update the store state', async () => {
    await runEffect(store.getActiveRequests());

    // Verify service was called
    expect(mockRequestsService.getActiveRequestsRecords).toHaveBeenCalledTimes(1);

    // Verify store was updated
    expect(store.activeRequests.length).toBe(1);
  });

  it('should get user requests', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;

    await runEffect(store.getUserRequests(mockHash));

    // Verify service was called
    expect(mockRequestsService.getUserRequestsRecords).toHaveBeenCalledTimes(1);
    expect(mockRequestsService.getUserRequestsRecords).toHaveBeenCalledWith(mockHash);

    // Verify store was updated
    expect(store.requests.length).toBe(1);
  });

  it('should get organization requests', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;

    await runEffect(store.getOrganizationRequests(mockHash));

    // Verify service was called
    expect(mockRequestsService.getOrganizationRequestsRecords).toHaveBeenCalledTimes(1);
    expect(mockRequestsService.getOrganizationRequestsRecords).toHaveBeenCalledWith(mockHash);

    // Verify store was updated
    expect(store.requests.length).toBe(1);
  });

  it('should get latest request', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;

    await runEffect(store.getLatestRequest(mockHash));

    // Note: This will use the cache lookup, which in our mock returns a CacheNotFoundError
    // but the store handles this gracefully by returning null
  });

  it('should handle errors gracefully', async () => {
    // Mock the service to throw an error
    const { RequestError } = await import('$lib/services/zomes/requests.service');
    vi.spyOn(mockRequestsService, 'getActiveRequestsRecords').mockReturnValue(
      Effect.fail(new RequestError({ message: 'Test error' }))
    );

    try {
      // When
      await runEffect(store.getActiveRequests());
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // Then
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Test error');
    }
  });

  it('should invalidate cache', async () => {
    // Just check that invalidateCache is a function and can be called
    expect(typeof store.invalidateCache).toBe('function');

    // Create a spy on cache.clear to ensure it's called
    const cacheClearSpy = vi.spyOn(store.cache, 'clear');

    // Call the invalidateCache method
    store.invalidateCache();

    // Verify the cache clear was called
    expect(cacheClearSpy).toHaveBeenCalledTimes(1);
  });

  describe('Tag-based Discovery', () => {
    it('should get requests by tag', async () => {
      const tag = 'javascript';

      await runEffect(store.getRequestsByTag(tag));

      // Verify service was called
      expect(mockRequestsService.getRequestsByTag).toHaveBeenCalledWith(tag);

      // Verify store was updated (assuming mock returns 1 request)
      expect(store.requests.length).toBe(1);
    });

    it('should handle empty results for tag search', async () => {
      const tag = 'nonexistent';

      // Mock the service to return empty array
      vi.spyOn(mockRequestsService, 'getRequestsByTag').mockReturnValue(Effect.succeed([]));

      await runEffect(store.getRequestsByTag(tag));

      // Verify service was called
      expect(mockRequestsService.getRequestsByTag).toHaveBeenCalledWith(tag);

      // Verify store reflects empty results
      expect(store.requests.length).toBe(0);
    });

    it('should handle errors in tag-based search', async () => {
      const tag = 'javascript';
      const { RequestError } = await import('$lib/services/zomes/requests.service');

      // Mock the service to throw an error
      vi.spyOn(mockRequestsService, 'getRequestsByTag').mockReturnValue(
        Effect.fail(new RequestError({ message: 'Tag search failed' }))
      );

      try {
        await runEffect(store.getRequestsByTag(tag));
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Tag search failed');
      }
    });

    it('should process tag search results correctly', async () => {
      const tag = 'react';
      const mockRecord = await createMockRecord();

      // Mock the service to return specific records
      vi.spyOn(mockRequestsService, 'getRequestsByTag').mockReturnValue(
        Effect.succeed([mockRecord])
      );

      await runEffect(store.getRequestsByTag(tag));

      // Verify service was called with correct tag
      expect(mockRequestsService.getRequestsByTag).toHaveBeenCalledWith(tag);

      // Verify the returned data is processed through the same pipeline
      expect(store.requests.length).toBeGreaterThan(0);
    });
  });
});
