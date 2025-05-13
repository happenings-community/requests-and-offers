import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createOffersStore, type OffersStore } from '$lib/stores/offers.store.svelte';
import { createTestOffer, createMockRecord } from '../unit/test-helpers';
import type { OffersService } from '$lib/services/zomes/offers.service';
import type { Record, ActionHash } from '@holochain/client';
import type { StoreEvents } from '$lib/stores/storeEvents';
import { createEventBus, type EventBus } from '$lib/utils/eventBus';
import { mockEffectFn, mockEffectFnWithParams } from '../unit/effect';
import { runEffect } from '$lib/utils/effect';

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

describe('Offers Store-Service Integration', () => {
  let offersStore: OffersStore;
  let offersService: OffersService;
  let eventBus: EventBus<StoreEvents>;
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

    // Create event bus
    eventBus = createEventBus<StoreEvents>();
    mockEventHandler = vi.fn();
    eventBus.on('offer:created', mockEventHandler);

    // Create store instance
    offersStore = createOffersStore(offersService);
  });

  it('should create an offer and update the store', async () => {
    const mockOffer = createTestOffer();

    // Call the createOffer method
    await runEffect(offersStore.createOffer(mockOffer));

    // Verify the service was called
    expect(offersService.createOffer).toHaveBeenCalledTimes(1);
    expect(offersService.createOffer).toHaveBeenCalledWith(mockOffer, undefined);

    // Verify the store was updated
    expect(offersStore.offers.length).toBe(1);
  });

  it('should get all offers and update the store', async () => {
    // Call the getAllOffers method
    const result = await runEffect(offersStore.getAllOffers());

    // Verify the service was called
    expect(offersService.getAllOffersRecords).toHaveBeenCalledTimes(1);

    // Verify the store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
  });

  it('should handle errors when getting all offers', async () => {
    // Given
    const errorMessage = 'Failed to get all offers: Test error';
    const getAllOffersRecordsFn = vi.fn(() => Promise.reject(new Error('Test error')));
    offersService.getAllOffersRecords = mockEffectFn(getAllOffersRecordsFn);

    try {
      // When
      await runEffect(offersStore.getAllOffers());
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // Then
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(errorMessage);
    }
  });

  it('should handle cache invalidation', async () => {
    // First get all offers to populate cache
    await runEffect(offersStore.getAllOffers());

    // Verify cache has data
    expect(offersStore.cache.getAllValid().length).toBe(1);

    // Invalidate cache
    offersStore.invalidateCache();

    // Verify cache is empty
    expect(offersStore.cache.getAllValid().length).toBe(0);

    // Getting offers again should call service
    await runEffect(offersStore.getAllOffers());
    expect(offersService.getAllOffersRecords).toHaveBeenCalledTimes(2);
  });

  it('should emit offer:created event when an offer is created', async () => {
    // Given
    const testOffer = createTestOffer();
    const createOfferFn = vi.fn(async () => createMockRecord(testOffer));
    offersService.createOffer = mockEffectFnWithParams(createOfferFn);

    // When
    await runEffect(offersStore.createOffer(testOffer));

    // Then
    expect(mockEventHandler).toHaveBeenCalledWith({
      offer: expect.objectContaining({
        title: 'Test Offer',
        description: 'Test offer description',
        capabilities: ['test-capability-1', 'test-capability-2'],
        availability: 'Full time',
        created_at: expect.any(Number),
        updated_at: expect.any(Number),
        creator: expect.any(Uint8Array),
        original_action_hash: expect.any(Uint8Array),
        previous_action_hash: expect.any(Uint8Array)
      })
    });
  });
});
