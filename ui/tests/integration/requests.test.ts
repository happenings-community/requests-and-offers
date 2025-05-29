import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import { runEffect } from '$lib/utils/effect';
import { createRequestsStore } from '$lib/stores/requests.store.svelte';
import {
  createMockEventBusLayer,
  clearEmittedEvents,
  getEmittedEvents
} from '../mocks/eventBus.mock';
import { mockEffectFn, mockEffectFnWithParams } from '../unit/effect';
import { createTestRequest, createMockRecord } from '../unit/test-helpers';
import type { RequestsService } from '$lib/services/zomes/requests.service';
import type { RequestError } from '$lib/services/zomes/requests.service';
import type { Record, ActionHash } from '@holochain/client';
import { StoreEventBusTag } from '$lib/stores/storeEvents';
import type { RequestInDHT } from '$lib/types/holochain';

// Mock the Holochain client service
vi.mock('$lib/services/HolochainClientService.svelte', () => ({
  default: {
    client: {
      callZone: vi.fn(() => Promise.resolve({ Ok: {} }))
    }
  }
}));

// Mock the UsersService
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

describe('Requests Store-Service Integration', () => {
  let mockRequestsService: RequestsService;
  let mockRecord: Record;
  let mockHash: ActionHash;
  let testRequest: RequestInDHT;
  let mockEventBusLayer: ReturnType<typeof createMockEventBusLayer>;

  beforeEach(async () => {
    // Create the event bus layer first so it's available for clearEmittedEvents
    mockEventBusLayer = createMockEventBusLayer();

    // Clear any previous events
    clearEmittedEvents();

    // Create test data
    const testRequestData = await createTestRequest();
    mockRecord = await createMockRecord(testRequestData);
    mockHash = mockRecord.signed_action.hashed.hash;
    testRequest = testRequestData;

    // Create mock service functions
    const createRequestFn = vi.fn(() => Promise.resolve(mockRecord));
    const getAllRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getUserRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getOrganizationRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getLatestRequestRecordFn = vi.fn(() => Promise.resolve(mockRecord));
    const getLatestRequestFn = vi.fn(() => Promise.resolve(testRequest));
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

    // Event bus layer already created above
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a request and emit a creation event', async () => {
    // Create the store with our mock service
    const store = createRequestsStore(mockRequestsService);

    // Create a test effect that wraps the store operation with the mock event bus
    const testEffect = Effect.gen(function* ($) {
      // Create the request using the store
      yield* $(store.createRequest(testRequest));

      return {
        requests: store.requests,
        events: getEmittedEvents()
      };
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(testEffect, mockEventBusLayer);

    // Run the effect
    const { requests, events } = await runEffect(providedEffect);

    // Verify service was called with correct parameters
    const createRequestFn = mockRequestsService.createRequest as ReturnType<
      typeof mockEffectFnWithParams
    >;
    expect(createRequestFn).toHaveBeenCalledWith(testRequest, undefined);

    // Verify store state was updated
    expect(requests.length).toBe(1);

    // Verify event was emitted
    expect(events.length).toBe(1);
    expect(events[0].event).toBe('request:created');
    expect(events[0].payload).toEqual(
      expect.objectContaining({
        request: expect.objectContaining({
          original_action_hash: mockRecord.signed_action.hashed.hash
        })
      })
    );
  });

  it('should get all requests and update the store state', async () => {
    // Create the store with our mock service
    const store = createRequestsStore(mockRequestsService);

    // Get all requests
    const effect = store.getAllRequests();

    // Provide the event bus layer
    const providedEffect = Effect.provide(effect, mockEventBusLayer);

    // Run the effect
    await runEffect(providedEffect);

    // Verify service was called
    const getAllRequestsRecordsFn = mockRequestsService.getAllRequestsRecords as ReturnType<
      typeof mockEffectFn
    >;
    expect(getAllRequestsRecordsFn).toHaveBeenCalledTimes(1);

    // Verify store state was updated
    expect(store.requests.length).toBe(1);
    expect(store.requests[0]).toHaveProperty('original_action_hash');
  });

  it('should update a request and emit an update event', async () => {
    // Create the store with our mock service
    const store = createRequestsStore(mockRequestsService);

    // First add a request to the cache so it can be updated
    store.cache.set({
      ...testRequest,
      original_action_hash: mockHash,
      previous_action_hash: mockHash,
      created_at: Date.now(),
      updated_at: Date.now()
    });

    // Create a test effect that wraps the store operation with the mock event bus
    const testEffect = Effect.gen(function* ($) {
      // Update the request using the store
      const updatedRequest = { ...testRequest, title: 'Updated Title' };
      yield* $(store.updateRequest(mockHash, mockHash, updatedRequest));

      return {
        events: getEmittedEvents()
      };
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(testEffect, mockEventBusLayer);

    // Run the effect
    const { events } = await runEffect(providedEffect);

    // Verify service was called with correct parameters
    const updateRequestFn = mockRequestsService.updateRequest as ReturnType<
      typeof mockEffectFnWithParams
    >;
    const updatedRequest = { ...testRequest, title: 'Updated Title' };
    expect(updateRequestFn).toHaveBeenCalledWith(mockHash, mockHash, updatedRequest);

    // Verify event was emitted
    expect(events.length).toBe(1);
    expect(events[0].event).toBe('request:updated');
    expect(events[0].payload).toEqual(
      expect.objectContaining({
        request: expect.objectContaining({
          original_action_hash: mockHash
        })
      })
    );
  });

  it('should delete a request and emit a deletion event', async () => {
    // Create the store with our mock service
    const store = createRequestsStore(mockRequestsService);

    // First, add a request to the store to delete
    store.cache.set({
      ...testRequest,
      original_action_hash: mockHash,
      previous_action_hash: mockHash,
      created_at: Date.now(),
      updated_at: Date.now()
    });

    // Create a test effect that wraps the store operation with the mock event bus
    const testEffect = Effect.gen(function* ($) {
      // Delete the request using the store
      yield* $(store.deleteRequest(mockHash));

      return {
        events: getEmittedEvents()
      };
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(testEffect, mockEventBusLayer);

    // Run the effect
    const { events } = await runEffect(providedEffect);

    // Verify service was called with correct parameters
    const deleteRequestFn = mockRequestsService.deleteRequest as ReturnType<
      typeof mockEffectFnWithParams
    >;
    expect(deleteRequestFn).toHaveBeenCalledWith(mockHash);

    // Verify event was emitted
    expect(events.length).toBe(1);
    expect(events[0].event).toBe('request:deleted');
    expect(events[0].payload).toEqual({ requestHash: mockHash });
  });

  it('should handle errors gracefully when service fails', async () => {
    // Create a service that fails
    const errorMessage = 'Failed to get all requests: Test error';
    const getAllRequestsRecordsFn = vi.fn(() => Promise.reject(new Error('Test error')));
    mockRequestsService.getAllRequestsRecords = mockEffectFn<never, RequestError>(
      getAllRequestsRecordsFn
    ) as unknown as () => Effect.Effect<Record[], RequestError>;

    // Create the store with our failing service
    const store = createRequestsStore(mockRequestsService);

    // Create a test effect that wraps the store operation
    const testEffect = Effect.gen(function* ($) {
      try {
        // Attempt to get all requests
        yield* $(store.getAllRequests());
        return { success: true, error: null };
      } catch (error) {
        return { success: false, error: error as Error };
      }
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(testEffect, mockEventBusLayer);

    // Run the effect and expect it to fail
    try {
      await runEffect(providedEffect);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Verify error was handled correctly
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(errorMessage);

      // Note: Store error state is not updated in this case because the effect fails
      // before the store can update its error state
    }
  });

  it('should listen for events from other stores and update accordingly', async () => {
    // Create the store with our mock service
    const store = createRequestsStore(mockRequestsService);

    // Setup the store to listen for events
    const setupEffect = Effect.gen(function* ($) {
      const eventBus = yield* $(StoreEventBusTag);

      // Set up a listener for request events
      yield* $(
        eventBus.on('request:created', (payload) => {
          // Add the request to the store cache when the event is received
          store.cache.set(payload.request);
          return Effect.void;
        })
      );

      // Simulate another store emitting a requestCreated event
      yield* $(
        eventBus.emit('request:created', {
          request: {
            original_action_hash: mockHash,
            previous_action_hash: mockHash,
            ...testRequest,
            created_at: Date.now(),
            updated_at: Date.now()
          }
        })
      );

      return store.requests;
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(setupEffect, mockEventBusLayer);

    // Run the effect
    const requests = await runEffect(providedEffect);

    // Verify store state was updated in response to the event
    expect(requests.length).toBe(1);
    expect(requests[0].original_action_hash).toEqual(mockHash);
  });
});
