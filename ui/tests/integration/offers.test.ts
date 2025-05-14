import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createOffersStore, type OffersStore } from '$lib/stores/offers.store.svelte';
import { createTestOffer, createMockRecord } from '../unit/test-helpers';
import type { OffersService } from '$lib/services/zomes/offers.service';
import type { Record, ActionHash } from '@holochain/client';
import type { StoreEvents } from '$lib/stores/storeEvents';
import { createEventBusTag, createEventBusLiveLayer } from '$lib/utils/eventBus.effect';
import { Effect as E } from 'effect';
import { StoreEventBusTag } from '$lib/stores/storeEvents';
import type { EventBusService } from '$lib/utils/eventBus.effect';
import type { Layer } from 'effect/Layer';
import { mockEffectFn, mockEffectFnWithParams } from '../unit/effect';
import { runEffect } from '$lib/utils/effect';

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

describe('Offers Store-Service Integration', () => {
  let offersStore: OffersStore;
  let offersService: OffersService;

  let eventBusTag: typeof StoreEventBusTag;
  let eventBusLayer: Layer<EventBusService<StoreEvents>>;
  let mockRecord: Record;
  let mockEventHandler: ReturnType<typeof vi.fn>;
  let mockHash: ActionHash;

  beforeEach(async () => {
    mockRecord = await createMockRecord();
    mockHash = mockRecord.signed_action.hashed.hash;

    // Create mock functions
    const createOfferFn = vi.fn(() => Promise.resolve(mockRecord));
    const getAllOffersRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getUserOffersRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getOrganizationOffersRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    const getLatestOfferRecordFn = vi.fn(() => Promise.resolve(mockRecord));
    const getLatestOfferFn = vi.fn(() => Promise.resolve(createTestOffer()));
    const updateOfferFn = vi.fn(() => Promise.resolve(mockRecord));
    const deleteOfferFn = vi.fn(() => Promise.resolve(true));
    const getOfferCreatorFn = vi.fn(() => Promise.resolve(mockHash));
    const getOfferOrganizationFn = vi.fn(() => Promise.resolve(mockHash));

    // Create mock service
    offersService = {
      createOffer: mockEffectFnWithParams(createOfferFn),
      getAllOffersRecords: mockEffectFn(getAllOffersRecordsFn),
      getUserOffersRecords: mockEffectFnWithParams(getUserOffersRecordsFn),
      getOrganizationOffersRecords: mockEffectFnWithParams(getOrganizationOffersRecordsFn),
      getLatestOfferRecord: mockEffectFnWithParams(getLatestOfferRecordFn),
      getLatestOffer: mockEffectFnWithParams(getLatestOfferFn),
      updateOffer: mockEffectFnWithParams(updateOfferFn),
      deleteOffer: mockEffectFnWithParams(deleteOfferFn),
      getOfferCreator: mockEffectFnWithParams(getOfferCreatorFn),
      getOfferOrganization: mockEffectFnWithParams(getOfferOrganizationFn)
    } as OffersService;

    // Create custom Effect TS event bus layer for this test
    eventBusTag = createEventBusTag<StoreEvents>('TestBus');
    eventBusLayer = createEventBusLiveLayer(eventBusTag);
    // Extract the event bus service from the layer for direct handler registration
    // Instead of .service, we launch the layer and get the service
    // For tests, we can use a simple in-memory event bus for handler registration, or register handler via Effect.runPromise
    // Here, we register the handler after providing the layer in the test body
    mockEventHandler = vi.fn();

    // Create store instance
    offersStore = createOffersStore(offersService);
  });

  it('should create an offer and update the store', async () => {
    const mockOffer = createTestOffer();

    // Act: create an offer
    // Inject test event bus so event emission can be asserted
    // Register handler via Effect context
    await runEffect(
      E.gen(function* ($) {
        // Register event handler in Effect context
        const bus = yield* $(eventBusTag);
        yield* $(bus.on('offer:created', mockEventHandler));
        yield* $(offersStore.createOffer(mockOffer));
      }).pipe(E.provide(eventBusLayer))
    );

    // Assert: service call and store update
    expect(offersService.createOffer).toHaveBeenCalledTimes(1);
    expect(offersService.createOffer).toHaveBeenCalledWith(mockOffer, undefined);
    expect(offersStore.offers.length).toBe(1);
  });

  it('should get all offers and update the store', async () => {
    // Act: get all offers
    const result = await runEffect(
      E.gen(function* ($) {
        return yield* $(offersStore.getAllOffers());
      }).pipe(E.provide(eventBusLayer))
    );

    // Assert: service call and result shape
    expect(offersService.getAllOffersRecords).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
  });

  it('should handle errors when getting all offers', async () => {
    // Arrange: set up service to throw
    const getAllOffersRecordsFn = vi.fn(() => Promise.reject(new Error('Test error')));
    offersService.getAllOffersRecords = mockEffectFn(getAllOffersRecordsFn);

    // Act & Assert: error is thrown and message is correct
    await expect(
      runEffect(
        E.gen(function* ($) {
          return yield* $(offersStore.getAllOffers());
        }).pipe(E.provide(eventBusLayer))
      )
    ).rejects.toThrow('Test error');
  });

  it('should handle cache invalidation', async () => {
    // Arrange: populate cache
    await runEffect(offersStore.getAllOffers());
    expect(offersStore.cache.getAllValid().length).toBe(1);

    // Act: invalidate cache
    offersStore.invalidateCache();
    expect(offersStore.cache.getAllValid().length).toBe(0);

    // Assert: service is called again after invalidation
    await runEffect(offersStore.getAllOffers());
    expect(offersService.getAllOffersRecords).toHaveBeenCalledTimes(2);
  });

  it('should emit offer:created event when an offer is created', async () => {
    // Arrange: set up event handler and service mock
    const testOffer = createTestOffer();
    const createOfferFn = vi.fn(async () => createMockRecord(testOffer));
    offersService.createOffer = mockEffectFnWithParams(createOfferFn);

    // Act & Assert
    await runEffect(
      E.gen(function* ($) {
        const bus = yield* $(eventBusTag);
        yield* $(bus.on('offer:created', mockEventHandler));
        yield* $(offersStore.createOffer(testOffer));
        // Assert: event handler called with correct payload
        expect(mockEventHandler).toHaveBeenCalledWith({
          offer: expect.objectContaining({
            title: testOffer.title,
            description: testOffer.description,
            capabilities: testOffer.capabilities,
            created_at: expect.any(Number),
            updated_at: expect.any(Number),
            creator: expect.any(Uint8Array),
            original_action_hash: expect.any(Uint8Array),
            previous_action_hash: expect.any(Uint8Array)
          })
        });
      }).pipe(E.provide(eventBusLayer))
    );
  });
});
