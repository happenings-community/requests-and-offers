import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createRequestsStore, type RequestsStore } from '@/stores/requests.store.svelte';
import { createTestRequest, createMockRecord } from '@/tests/utils/test-helpers';
import type { RequestsService } from '@/services/zomes/requests.service';
import { fakeActionHash, type Record } from '@holochain/client';
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

describe('Requests Store', () => {
  let requestsStore: RequestsStore;
  let mockRequestsService: RequestsService;
  let eventBus: EventBus<StoreEvents>;
  let mockRecord: Record;
  let mockCreatedHandler: ReturnType<typeof vi.fn>;
  let mockUpdatedHandler: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockRecord = await createMockRecord();

    // Create mock service
    mockRequestsService = {
      createRequest: vi.fn(() => Promise.resolve(mockRecord)),
      getAllRequestsRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getUserRequestsRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getOrganizationRequestsRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getLatestRequestRecord: vi.fn(() => Promise.resolve(mockRecord)),
      getLatestRequest: vi.fn(() => Promise.resolve(createTestRequest())),
      updateRequest: vi.fn(() => Promise.resolve(mockRecord)),
      deleteRequest: vi.fn(() => Promise.resolve())
    };

    // Create real event bus with mock handlers
    eventBus = createEventBus<StoreEvents>();
    mockCreatedHandler = vi.fn();
    mockUpdatedHandler = vi.fn();

    // Create store instance
    requestsStore = createRequestsStore(mockRequestsService, eventBus);
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
    expect(result[0].creator).toBeDefined();
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
    mockRequestsService.getAllRequestsRecords = vi.fn(() =>
      Promise.reject(new Error('Test error'))
    );

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
