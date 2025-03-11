import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createRequestsStore, type RequestsStore } from '@/stores/requests.store.svelte';
import { createTestRequest, createMockRecord } from '@/tests/utils/test-helpers';
import type { RequestsService } from '@/services/zomes/requests.service';
import type { Record } from '@holochain/client';
import type { StoreEvents } from '@/stores/storeEvents';
import { createEventBus, type EventBus } from '@/utils/eventBus';

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

  beforeEach(async () => {
    mockRecord = await createMockRecord();

    // Create a mock requests service
    requestsService = {
      createRequest: vi.fn(() => Promise.resolve(mockRecord)),
      getAllRequestsRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getUserRequestsRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getOrganizationRequestsRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getLatestRequestRecord: vi.fn(() => Promise.resolve(mockRecord)),
      getLatestRequest: vi.fn(() => Promise.resolve(createTestRequest())),
      updateRequest: vi.fn(() => Promise.resolve(mockRecord)),
      deleteRequest: vi.fn(() => Promise.resolve())
    };

    // Create a real event bus instance
    eventBus = createEventBus<StoreEvents>();
    mockEventHandler = vi.fn();

    // Create a new requests store instance for each test
    requestsStore = createRequestsStore(requestsService, eventBus);
  });

  it('should create a request and update the store', async () => {
    const mockRequest = createTestRequest();

    // Register event handler
    eventBus.on('request:created', mockEventHandler);

    // Call the createRequest method
    await requestsStore.createRequest(mockRequest);

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
    const result = await requestsStore.getAllRequests();

    // Verify the service was called
    expect(requestsService.getAllRequestsRecords).toHaveBeenCalledTimes(1);

    // Verify the store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
  });

  it('should handle errors when getting all requests', async () => {
    // Mock the service to throw an error
    requestsService.getAllRequestsRecords = vi.fn(() => Promise.reject(new Error('Test error')));

    try {
      await requestsStore.getAllRequests();
      // If we reach here, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      // Verify the error was handled
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Test error');
    }
  });
});
