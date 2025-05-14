import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createRequestsStore, type RequestsStore } from '$lib/stores/requests.store.svelte';
import { createTestRequest, createMockRecord } from '../unit/test-helpers';
import type { RequestsService } from '$lib/services/zomes/requests.service';
import type { Record, ActionHash } from '@holochain/client';
import type { StoreEvents } from '$lib/stores/storeEvents';
import { createEventBusTag, createEventBusLiveLayer } from '$lib/utils/eventBus.effect';
import { Effect as E } from 'effect';
import { StoreEventBusTag } from '$lib/stores/storeEvents';
import type { EventBusService } from '$lib/utils/eventBus.effect';
import { mockEffectFn, mockEffectFnWithParams } from '../unit/effect';
import { runEffect } from '$lib/utils/effect';
import type { Layer } from 'effect/Layer';

// Mock the organizationsStore
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: {
    getAcceptedOrganizations: vi.fn(() => Promise.resolve([]))
  }
}));

// Mock the usersStore
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    getUserByAgentPubKey: vi.fn(() => Promise.resolve(null)),
    currentUser: null
  }
}));

describe('Requests Store-Service Integration', () => {
  let requestsStore: RequestsStore;
  let requestsService: RequestsService;
  let eventBusTag: typeof StoreEventBusTag;
  let eventBusLayer: Layer<EventBusService<StoreEvents>>;
  let mockRecord: Record;
  let mockEventHandler: ReturnType<typeof vi.fn>;
  let mockHash: ActionHash;

  beforeEach(async () => {
    mockRecord = await createMockRecord();
    mockHash = mockRecord.signed_action.hashed.hash;

    const createRequestFn = vi.fn(() => Promise.resolve(mockRecord));
    const getAllRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getUserRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getOrganizationRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getLatestRequestRecordFn = vi.fn(() => Promise.resolve(mockRecord));
    const getLatestRequestFn = vi.fn(() => Promise.resolve(createTestRequest()));
    const updateRequestFn = vi.fn(() => Promise.resolve(mockRecord));
    const deleteRequestFn = vi.fn(() => Promise.resolve(true));

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

    eventBusTag = createEventBusTag<StoreEvents>('TestBus');
    eventBusLayer = createEventBusLiveLayer(eventBusTag);
    mockEventHandler = vi.fn();

    requestsStore = createRequestsStore(requestsService);
  });

  it('should create a request and update the store', async () => {
    const mockRequest = createTestRequest();

    await runEffect(
      E.gen(function* ($) {
        const bus = yield* $(eventBusTag);
        yield* $(bus.on('request:created', mockEventHandler));
        yield* $(requestsStore.createRequest(mockRequest));
      }).pipe(E.provide(eventBusLayer))
    );

    expect(requestsService.createRequest).toHaveBeenCalledTimes(1);
    expect(requestsService.createRequest).toHaveBeenCalledWith(mockRequest, undefined);
    expect(requestsStore.requests.length).toBe(1);
  });

  it('should get all requests and update the store', async () => {
    const result = await runEffect(
      E.gen(function* ($) {
        return yield* $(requestsStore.getAllRequests());
      }).pipe(E.provide(eventBusLayer))
    );

    expect(requestsService.getAllRequestsRecords).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
  });

  it('should handle errors when getting all requests', async () => {
    const getAllRequestsRecordsFn = vi.fn(() => Promise.reject(new Error('Test error')));
    requestsService.getAllRequestsRecords = mockEffectFn(getAllRequestsRecordsFn);

    await expect(
      runEffect(
        E.gen(function* ($) {
          return yield* $(requestsStore.getAllRequests());
        }).pipe(E.provide(eventBusLayer))
      )
    ).rejects.toThrow('Test error');
  });

  it('should emit request:updated event when a request is updated', async () => {
    const testRequest = createTestRequest();
    const originalHash = new Uint8Array([1, 2, 3]);
    const previousHash = new Uint8Array([4, 5, 6]);
    const timestamp = Date.now();

    const existingRequest = {
      ...testRequest,
      original_action_hash: originalHash,
      previous_action_hash: previousHash,
      creator: new Uint8Array([7, 8, 9]),
      created_at: timestamp,
      updated_at: timestamp
    };
    requestsStore.cache.set(existingRequest);

    const updateRequestFn = vi.fn(async () => {
      const record = await createMockRecord(testRequest);
      record.signed_action.hashed.content.timestamp = timestamp;
      return record;
    });
    requestsService.updateRequest = mockEffectFnWithParams(updateRequestFn);

    await runEffect(
      E.gen(function* ($) {
        const bus = yield* $(eventBusTag);
        yield* $(bus.on('request:updated', mockEventHandler));
        yield* $(requestsStore.updateRequest(originalHash, previousHash, testRequest));

        expect(mockEventHandler).toHaveBeenCalledWith({
          request: expect.objectContaining({
            title: 'Test Request',
            description: 'Test Description',
            requirements: testRequest.requirements,
            created_at: timestamp,
            updated_at: timestamp,
            creator: expect.any(Uint8Array),
            original_action_hash: expect.any(Uint8Array),
            previous_action_hash: expect.any(Uint8Array)
          })
        });
      }).pipe(E.provide(eventBusLayer))
    );
  });

  it('should emit request:created event when a request is created', async () => {
    const testRequest = createTestRequest();
    const createRequestFn = vi.fn(() => Promise.resolve(mockRecord));
    requestsService.createRequest = mockEffectFnWithParams(createRequestFn);

    await runEffect(
      E.gen(function* ($) {
        const bus = yield* $(eventBusTag);
        yield* $(bus.on('request:created', mockEventHandler));
        yield* $(requestsStore.createRequest(testRequest));

        expect(mockEventHandler).toHaveBeenCalledWith({
          request: expect.objectContaining({
            title: testRequest.title,
            description: testRequest.description,
            requirements: testRequest.requirements,
            status: 'open',
            created_at: expect.any(Number),
            updated_at: expect.any(Number),
            creator: expect.any(Uint8Array),
            original_action_hash: mockHash,
            previous_action_hash: mockHash
          })
        });
      }).pipe(E.provide(eventBusLayer))
    );
  });
});
