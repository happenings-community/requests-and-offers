import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createRequestsStore, type RequestsStore } from '@stores/requests.store.svelte';
import { createTestRequest, createMockRecord } from '../unit/test-helpers';
import type { RequestsService } from '@services/zomes/requests.service';
import type { Record, ActionHash } from '@holochain/client';
import type { StoreEvents } from '@stores/storeEvents';
import { createEventBus, type EventBus } from '@utils/eventBus';
import { mockEffectFn, mockEffectFnWithParams } from '../unit/effect';
import { runEffect } from '@utils/effect';

// Mock the organizationsStore
vi.mock('@/stores/organizations.store.svelte', () => ({
  default: {
    getAcceptedOrganizations: vi.fn(() => Promise.resolve([]))
  }
}));

// Mock the usersStore
vi.mock('@/stores/users.store.svelte', () => ({
  default: {
    getUserByAgentPubKey: vi.fn(() => Promise.resolve(null)),
    currentUser: null
  }
}));

describe('Requests Store-Service Integration', () => {
  let requestsStore: RequestsStore;
  let requestsService: RequestsService;
  let eventBus: EventBus<StoreEvents>;
  let mockRecord: Record;
  let mockEventHandler: ReturnType<typeof vi.fn>;
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
    requestsService = {
      createRequest: mockEffectFnWithParams(createRequestFn),
      getAllRequestsRecords: mockEffectFn(getAllRequestsRecordsFn),
      getUserRequestsRecords: mockEffectFnWithParams(getUserRequestsRecordsFn),
      getOrganizationRequestsRecords: mockEffectFnWithParams(getOrganizationRequestsRecordsFn),
      getLatestRequestRecord: mockEffectFnWithParams(getLatestRequestRecordFn),
      getLatestRequest: mockEffectFnWithParams(getLatestRequestFn),
      updateRequest: mockEffectFnWithParams(updateRequestFn),
      deleteRequest: mockEffectFnWithParams(deleteRequestFn)
    } as RequestsService;

    // Create event bus
    eventBus = createEventBus<StoreEvents>();
    mockEventHandler = vi.fn();
    eventBus.on('request:created', mockEventHandler);

    // Create store instance
    requestsStore = createRequestsStore(requestsService, eventBus);
  });

  it('should create a request and update the store', async () => {
    const mockRequest = createTestRequest();

    // Register event handler
    eventBus.on('request:created', mockEventHandler);

    // Call the createRequest method
    await runEffect(requestsStore.createRequest(mockRequest));

    // Verify the service was called
    expect(requestsService.createRequest).toHaveBeenCalledTimes(1);
    expect(requestsService.createRequest).toHaveBeenCalledWith(mockRequest, undefined);

    // Verify the store was updated
    expect(requestsStore.requests.length).toBe(1);

    // Verify the event was emitted
    expect(mockEventHandler).toHaveBeenCalledTimes(1);
    expect(mockEventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          original_action_hash: expect.any(Uint8Array),
          previous_action_hash: expect.any(Uint8Array)
        })
      })
    );
  });

  it('should get all requests and update the store', async () => {
    // Call the getAllRequests method
    const result = await runEffect(requestsStore.getAllRequests());

    // Verify the service was called
    expect(requestsService.getAllRequestsRecords).toHaveBeenCalledTimes(1);

    // Verify the store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
  });

  it('should handle errors when getting all requests', async () => {
    // Given
    const errorMessage = 'Failed to get all requests: Test error';
    const getAllRequestsRecordsFn = vi.fn(() => Promise.reject(new Error('Test error')));
    requestsService.getAllRequestsRecords = mockEffectFn(getAllRequestsRecordsFn);

    try {
      // When
      await runEffect(requestsStore.getAllRequests());
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // Then
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(errorMessage);
    }
  });

  it('should emit request:updated event when a request is updated', async () => {
    // Given
    const testRequest = createTestRequest();
    const originalHash = new Uint8Array([1, 2, 3]); // Simple test hash
    const previousHash = new Uint8Array([4, 5, 6]); // Simple test hash
    const timestamp = Date.now();

    // Add the request to the cache first
    const existingRequest = {
      ...testRequest,
      original_action_hash: originalHash,
      previous_action_hash: previousHash,
      creator: new Uint8Array([7, 8, 9]),
      created_at: timestamp,
      updated_at: timestamp
    };
    requestsStore.cache.set(existingRequest);

    // Register event handler
    eventBus.on('request:updated', mockEventHandler);

    const updateRequestFn = vi.fn(async () => {
      const record = await createMockRecord(testRequest);
      record.signed_action.hashed.content.timestamp = timestamp;
      return record;
    });
    requestsService.updateRequest = mockEffectFnWithParams(updateRequestFn);

    // When
    await runEffect(requestsStore.updateRequest(originalHash, previousHash, testRequest));

    // Then
    expect(mockEventHandler).toHaveBeenCalledWith({
      request: expect.objectContaining({
        title: 'Test Request',
        description: 'Test Description',
        requirements: ['Test Skill 1', 'Test Skill 2'],
        created_at: timestamp,
        updated_at: timestamp,
        creator: expect.any(Uint8Array),
        original_action_hash: originalHash,
        previous_action_hash: expect.any(Uint8Array)
      })
    });
  });

  it('should emit request:created event when a request is created', async () => {
    const testRequest = createTestRequest();
    const createRequestFn = vi.fn(() => Promise.resolve(mockRecord));
    requestsService.createRequest = mockEffectFnWithParams(createRequestFn);

    // When
    await runEffect(requestsStore.createRequest(testRequest));

    // Then
    expect(mockEventHandler).toHaveBeenCalledWith({
      request: expect.objectContaining({
        title: testRequest.title,
        description: testRequest.description,
        requirements: testRequest.requirements,
        original_action_hash: mockHash,
        previous_action_hash: mockHash,
        creator: expect.any(Uint8Array),
        created_at: expect.any(Number),
        updated_at: expect.any(Number)
      })
    });
  });
});
