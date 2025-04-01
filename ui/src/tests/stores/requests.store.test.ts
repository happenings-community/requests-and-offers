import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createRequestsStore, type RequestsStore } from '@/stores/requests.store.svelte';
import { createTestRequest, createMockRecord } from '@/tests/utils/test-helpers';
import type { RequestsService } from '@/services/zomes/requests.service';
import type { Record, ActionHash } from '@holochain/client';
import type { StoreEvents } from '@/stores/storeEvents';
import { createEventBus, type EventBus } from '@/utils/eventBus';
import { mockEffectFn, mockEffectFnWithParams } from '@/tests/utils/effect';
import { runEffect } from '@/utils/effect';

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

describe('RequestsStore', () => {
  let store: RequestsStore;
  let mockRequestsService: RequestsService;
  let mockRecord: Record;
  let mockHash: ActionHash;
  let eventBus: EventBus<StoreEvents>;

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

    // Create store instance
    store = createRequestsStore(mockRequestsService, eventBus);
  });

  it('should initialize with empty state', () => {
    expect(store.requests).toEqual([]);
    expect(store.error).toBeNull();
  });

  it('should get all requests', async () => {
    const effect = store.getAllRequests();
    const result = await runEffect(effect);
    expect(mockRequestsService.getAllRequestsRecords).toHaveBeenCalled();
    expect(result).toEqual(expect.any(Array));
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
    const result = await runEffect(effect);
    expect(mockRequestsService.createRequest).toHaveBeenCalledWith(newRequest, undefined);
    expect(result).toEqual(mockRecord);
  });

  it('should update a request', async () => {
    const updatedRequest = createTestRequest();
    const effect = store.updateRequest(mockHash, mockHash, updatedRequest);
    const result = await runEffect(effect);
    expect(mockRequestsService.updateRequest).toHaveBeenCalledWith(
      mockHash,
      mockHash,
      updatedRequest
    );
    expect(result).toEqual(mockRecord);
  });

  it('should delete a request', async () => {
    const effect = store.deleteRequest(mockHash);
    await runEffect(effect);
    expect(mockRequestsService.deleteRequest).toHaveBeenCalledWith(mockHash);
  });

  it('should handle errors', async () => {
    // Given
    const errorMessage = 'Failed to get all requests: Test error';
    const getAllRequestsRecordsFn = vi.fn(() => Promise.reject(new Error('Test error')));
    mockRequestsService.getAllRequestsRecords = mockEffectFn(getAllRequestsRecordsFn);

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
});
