import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createRequestsStore, type RequestsStore } from '$lib/stores/requests.store.svelte';
import { Effect } from 'effect';
import { createTestRequest, createMockRecord } from '../test-helpers';
import type { RequestsService } from '$lib/services/zomes/requests.service';
import type { RequestError } from '$lib/services/zomes/requests.service';
import type { Record, ActionHash } from '@holochain/client';
import { StoreEventBusLive } from '$lib/stores/storeEvents';
import { mockEffectFn, mockEffectFnWithParams } from '../effect';
import { runEffect } from '$lib/utils/effect';

// Mock the Holochain client service
vi.mock('$lib/services/HolochainClientService.svelte', () => ({
  default: {
    client: {
      callZome: vi.fn(() => Promise.resolve({ Ok: {} }))
    }
  }
}));

// Mock the UsersService to handle dependencies correctly
vi.mock('$lib/services/zomes/users.service', () => ({
  UsersService: {
    getAgentUser: vi.fn(() =>
      Effect.succeed({
        original_action_hash: new Uint8Array([1, 2, 3]),
        agent_pub_key: new Uint8Array([4, 5, 6]),
        resource: { name: 'Test User' }
      })
    )
  }
}));

// Mock the organizationsStore
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: {
    getAcceptedOrganizations: vi.fn(() => Promise.resolve([])),
    organizations: []
  }
}));

// Mock the usersStore
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    getUserByAgentPubKey: vi.fn(() =>
      Promise.resolve({
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

describe('RequestsStore', () => {
  let store: RequestsStore;
  let mockRequestsService: RequestsService;
  let mockRecord: Record;
  let mockHash: ActionHash;

  beforeEach(async () => {
    mockRecord = await createMockRecord();
    mockHash = mockRecord.signed_action.hashed.hash;

    // Create mock functions
    const createRequestFn = vi.fn(() => Promise.resolve(mockRecord));
    const getAllRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getUserRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getOrganizationRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getLatestRequestRecordFn = vi.fn(() => Promise.resolve(mockRecord));
    const getLatestRequestFn = vi.fn(() => Promise.resolve(createTestRequest()));
    const updateRequestFn = vi.fn(() => Promise.resolve(mockRecord));
    const deleteRequestFn = vi.fn(() => Promise.resolve(true));

    // Create mock service
    mockRequestsService = {
      createRequest: mockEffectFnWithParams(createRequestFn),
      getAllRequestsRecords: mockEffectFn<Record[], RequestError>(
        getAllRequestsRecordsFn
      ) as unknown as () => Effect.Effect<Record[], RequestError>,
      getUserRequestsRecords: mockEffectFnWithParams(getUserRequestsRecordsFn),
      getOrganizationRequestsRecords: mockEffectFnWithParams(getOrganizationRequestsRecordsFn),
      getLatestRequestRecord: mockEffectFnWithParams(getLatestRequestRecordFn),
      getLatestRequest: mockEffectFnWithParams(getLatestRequestFn),
      updateRequest: mockEffectFnWithParams(updateRequestFn),
      deleteRequest: mockEffectFnWithParams(deleteRequestFn)
    } as unknown as RequestsService;

    // Create store instance
    store = createRequestsStore(mockRequestsService);
  });

  it('should initialize with empty state', () => {
    expect(store.requests).toEqual([]);
    expect(store.error).toBeNull();
  });

  it('should get all requests', async () => {
    // Mock the getAllRequestsRecords method to return predictable data
    const getAllRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    mockRequestsService.getAllRequestsRecords = mockEffectFn<Record[], RequestError>(
      getAllRequestsRecordsFn
    ) as unknown as () => Effect.Effect<Record[], RequestError>;

    // Create the effect and provide the layer
    const getAllEffect = store.getAllRequests();
    const providedEffect = Effect.provide(getAllEffect, StoreEventBusLive);

    // Run the effect
    await runEffect(providedEffect);

    // Verify service was called
    expect(mockRequestsService.getAllRequestsRecords).toHaveBeenCalledTimes(1);

    // Verify store was updated
    expect(store.requests.length).toBe(1);
    expect(store.requests[0]).toHaveProperty('original_action_hash');
  });

  it('should get user requests', async () => {
    const effect = store.getUserRequests(mockHash);
    const result = await runEffect(effect);
    expect(mockRequestsService.getUserRequestsRecords).toHaveBeenCalledWith(mockHash);
    expect(result).toEqual(expect.any(Array));
  });

  it('should get organization requests', async () => {
    const effect = store.getOrganizationRequests(mockHash);
    const result = await runEffect(effect);
    expect(mockRequestsService.getOrganizationRequestsRecords).toHaveBeenCalledWith(mockHash);
    expect(result).toEqual(expect.any(Array));
  });

  it('should create a request', async () => {
    const newRequest = createTestRequest();
    const effect = store.createRequest(newRequest);
    const providedEffect = Effect.provide(effect, StoreEventBusLive);
    const result = await runEffect(providedEffect);
    expect(mockRequestsService.createRequest).toHaveBeenCalledWith(newRequest, undefined);
    expect(result).toEqual(mockRecord);
  });

  it('should update a request', async () => {
    const updatedRequest = createTestRequest();
    const effect = store.updateRequest(mockHash, mockHash, updatedRequest);
    const providedEffect = Effect.provide(effect, StoreEventBusLive);
    const result = await runEffect(providedEffect);
    expect(mockRequestsService.updateRequest).toHaveBeenCalledWith(
      mockHash,
      mockHash,
      updatedRequest
    );
    expect(result).toEqual(mockRecord);
  });

  it('should delete a request', async () => {
    const effect = store.deleteRequest(mockHash);
    const providedEffect = Effect.provide(effect, StoreEventBusLive);
    await runEffect(providedEffect);
    expect(mockRequestsService.deleteRequest).toHaveBeenCalledWith(mockHash);
  });

  it('should handle errors', async () => {
    // Given
    const errorMessage = 'Failed to get all requests: Test error';
    const getAllRequestsRecordsFn = vi.fn(() => Promise.reject(new Error('Test error')));
    mockRequestsService.getAllRequestsRecords = mockEffectFn<never, RequestError>(
      getAllRequestsRecordsFn
    ) as unknown as () => Effect.Effect<Record[], RequestError>;

    try {
      // When
      await runEffect(store.getAllRequests());
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // Then
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(errorMessage);
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
});
