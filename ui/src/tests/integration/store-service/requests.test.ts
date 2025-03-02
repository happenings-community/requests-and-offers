import { mock } from 'bun:test';
import { expect, describe, it, beforeEach } from 'bun:test';
import type { RequestsStore } from '@/stores/requests.store.svelte';
import { createRequestsStore } from '@/stores/requests.store.svelte';
import { createTestRequest, createMockRecord } from '@/tests/utils/test-helpers';
import { createEventBus, type AppEvents } from '@/stores/eventBus';
import type { RequestsService } from '@/services/zomes/requests.service';
import type { Record } from '@holochain/client';

describe('Requests Store-Service Integration', () => {
  let requestsStore: RequestsStore;
  let requestsService: RequestsService;
  let eventBus: ReturnType<typeof createEventBus<AppEvents>>;
  let mockRecord: Record;
  let mockEventHandler: ReturnType<typeof mock>;

  beforeEach(async () => {
    mockRecord = await createMockRecord();

    // Create a mock requests service
    requestsService = {
      createRequest: mock(() => Promise.resolve(mockRecord)),
      getAllRequestsRecords: mock(() => Promise.resolve([mockRecord])),
      getUserRequestsRecords: mock(() => Promise.resolve([mockRecord])),
      getOrganizationRequestsRecords: mock(() => Promise.resolve([mockRecord])),
      getLatestRequestRecord: mock(() => Promise.resolve(mockRecord)),
      getLatestRequest: mock(() => Promise.resolve(createTestRequest())),
      updateRequest: mock(() => Promise.resolve(mockRecord)),
      deleteRequest: mock(() => Promise.resolve())
    };

    // Create a real event bus instance
    eventBus = createEventBus<AppEvents>();
    mockEventHandler = mock(() => {});

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
    requestsService.getAllRequestsRecords = mock(() => Promise.reject(new Error('Test error')));

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
