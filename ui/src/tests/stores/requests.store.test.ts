import { mock } from 'bun:test';
import { expect, describe, it, beforeEach } from 'bun:test';
import { RequestsStore } from '@/stores/requests.store.svelte';
import { createTestRequest, createMockRecord } from '@/tests/utils/test-helpers';
import { createEventBus, type AppEvents } from '@/stores/eventBus';
import type { RequestsService } from '@/services/zomes/requests.service';
import { fakeActionHash, type Record } from '@holochain/client';

describe('Requests Store', () => {
  let requestsStore: ReturnType<typeof RequestsStore>;
  let mockRequestsService: RequestsService;
  let eventBus: ReturnType<typeof createEventBus<AppEvents>>;
  let mockRecord: Record;
  let mockCreatedHandler: ReturnType<typeof mock>;
  let mockUpdatedHandler: ReturnType<typeof mock>;

  beforeEach(async () => {
    mockRecord = await createMockRecord();

    // Create mock service
    mockRequestsService = {
      createRequest: mock(() => Promise.resolve(mockRecord)),
      getAllRequestsRecords: mock(() => Promise.resolve([mockRecord])),
      getUserRequestsRecords: mock(() => Promise.resolve([mockRecord])),
      getOrganizationRequestsRecords: mock(() => Promise.resolve([mockRecord])),
      getLatestRequestRecord: mock(() => Promise.resolve(mockRecord)),
      getLatestRequest: mock(() => Promise.resolve(createTestRequest())),
      updateRequest: mock(() => Promise.resolve(mockRecord)),
      deleteRequest: mock(() => Promise.resolve())
    };

    // Create real event bus with mock handlers
    eventBus = createEventBus<AppEvents>();
    mockCreatedHandler = mock(() => {});
    mockUpdatedHandler = mock(() => {});

    // Create store instance
    requestsStore = RequestsStore(mockRequestsService, eventBus);
  });

  it('should create a request', async () => {
    const mockRequest = createTestRequest();

    // Register event handler
    eventBus.on('request:created', mockCreatedHandler);

    // Call createRequest
    await requestsStore.createRequest(mockRequest);

    // Verify service was called
    expect(mockRequestsService.createRequest).toHaveBeenCalledTimes(1);
    expect(mockRequestsService.createRequest).toHaveBeenCalledWith(mockRequest, undefined);

    // Verify store was updated
    expect(requestsStore.requests.length).toBe(1);

    // Verify event was emitted
    expect(mockCreatedHandler).toHaveBeenCalledTimes(1);
    expect(mockCreatedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          original_action_hash: expect.any(Uint8Array),
          previous_action_hash: expect.any(Uint8Array)
        })
      })
    );
  });

  it('should get all requests', async () => {
    // Call getAllRequests
    const result = await requestsStore.getAllRequests();

    // Verify service was called
    expect(mockRequestsService.getAllRequestsRecords).toHaveBeenCalledTimes(1);

    // Verify store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
  });

  it('should get user requests', async () => {
    const userHash = await fakeActionHash();

    // Call getUserRequests
    const result = await requestsStore.getUserRequests(userHash);

    // Verify service was called
    expect(mockRequestsService.getUserRequestsRecords).toHaveBeenCalledTimes(1);
    expect(mockRequestsService.getUserRequestsRecords).toHaveBeenCalledWith(userHash);

    // Verify store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
    expect(result[0].creator).toEqual(userHash);
  });

  it('should get organization requests', async () => {
    const organizationHash = await fakeActionHash();

    // Call getOrganizationRequests
    const result = await requestsStore.getOrganizationRequests(organizationHash);

    // Verify service was called
    expect(mockRequestsService.getOrganizationRequestsRecords).toHaveBeenCalledTimes(1);
    expect(mockRequestsService.getOrganizationRequestsRecords).toHaveBeenCalledWith(
      organizationHash
    );

    // Verify store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
    expect(result[0].organization).toEqual(organizationHash);
  });

  it('should get latest request', async () => {
    const originalActionHash = new Uint8Array([1, 2, 3]);

    // Call getLatestRequest
    const result = await requestsStore.getLatestRequest(originalActionHash);

    // Verify service was called
    expect(mockRequestsService.getLatestRequestRecord).toHaveBeenCalledTimes(1);
    expect(mockRequestsService.getLatestRequestRecord).toHaveBeenCalledWith(originalActionHash);

    // Verify result
    expect(result).toHaveProperty('original_action_hash');
    expect(result).toHaveProperty('previous_action_hash');
  });

  it('should update request', async () => {
    const mockRequest = createTestRequest();

    // First create a request to get the original action hash
    await requestsStore.createRequest(mockRequest);
    const originalActionHash = requestsStore.requests[0].original_action_hash!;
    const previousActionHash = requestsStore.requests[0].previous_action_hash!;

    // Register event handler for update
    eventBus.on('request:updated', mockUpdatedHandler);

    // Then update it
    await requestsStore.updateRequest(originalActionHash, previousActionHash, mockRequest);

    // Verify service was called
    expect(mockRequestsService.updateRequest).toHaveBeenCalledTimes(1);
    expect(mockRequestsService.updateRequest).toHaveBeenCalledWith(
      originalActionHash,
      previousActionHash,
      mockRequest
    );

    // Verify store was updated
    const updatedRequest = requestsStore.requests[0];
    expect(updatedRequest).toBeDefined();
    expect(updatedRequest.original_action_hash).toEqual(originalActionHash);
    expect(updatedRequest.previous_action_hash).toBeDefined();

    // Verify event was emitted
    expect(mockUpdatedHandler).toHaveBeenCalledTimes(1);
    expect(mockUpdatedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          original_action_hash: originalActionHash,
          previous_action_hash: expect.any(Uint8Array)
        })
      })
    );
  });

  it('should handle errors gracefully', async () => {
    // Mock service to throw error
    mockRequestsService.getAllRequestsRecords = mock(() => Promise.reject(new Error('Test error')));

    try {
      await requestsStore.getAllRequests();
      // If we reach here, test should fail
      expect(true).toBe(false);
    } catch (error) {
      // Verify error was handled
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Test error');
    }
  });
});
