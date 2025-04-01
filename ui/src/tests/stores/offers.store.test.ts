import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createOffersStore, type OffersStore } from '@/stores/offers.store.svelte';
import { createTestOffer, createMockRecord } from '@/tests/utils/test-helpers';
import type { OffersService } from '@/services/zomes/offers.service';
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

describe('Offers Store', () => {
  let store: OffersStore;
  let mockOffersService: OffersService;
  let mockRecord: Record;
  let mockHash: ActionHash;
  let eventBus: EventBus<StoreEvents>;
  let mockEventHandler: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockRecord = await createMockRecord();
    mockHash = mockRecord.signed_action.hashed.hash;

    // Create mock functions with spies
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
    mockOffersService = {
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

    // Create event bus and mock event handler
    eventBus = createEventBus<StoreEvents>();
    mockEventHandler = vi.fn();

    // Create store instance
    store = createOffersStore(mockOffersService, eventBus);
  });

  it('should initialize with empty state', () => {
    expect(store.offers).toEqual([]);
    expect(store.error).toBeNull();
  });

  it('should create an offer', async () => {
    const mockOffer = createTestOffer();

    // Register event handler
    eventBus.on('offer:created', mockEventHandler);

    // Call createOffer
    await runEffect(store.createOffer(mockOffer));

    // Verify service was called
    expect(mockOffersService.createOffer).toHaveBeenCalledTimes(1);
    expect(mockOffersService.createOffer).toHaveBeenCalledWith(mockOffer, undefined);

    // Verify store was updated
    expect(store.offers.length).toBe(1);

    // Verify event was emitted
    expect(mockEventHandler).toHaveBeenCalledTimes(1);
    expect(mockEventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        offer: expect.objectContaining({
          original_action_hash: expect.any(Uint8Array),
          previous_action_hash: expect.any(Uint8Array)
        })
      })
    );
  });

  it('should get all offers', async () => {
    await runEffect(store.getAllOffers());

    // Verify service was called
    expect(mockOffersService.getAllOffersRecords).toHaveBeenCalledTimes(1);

    // Verify store was updated
    expect(store.offers.length).toBe(1);
    expect(store.offers[0]).toHaveProperty('original_action_hash');
    expect(store.offers[0]).toHaveProperty('previous_action_hash');
  });

  it('should get user offers', async () => {
    await runEffect(store.getUserOffers(mockHash));

    // Verify service was called
    expect(mockOffersService.getUserOffersRecords).toHaveBeenCalledTimes(1);
    expect(mockOffersService.getUserOffersRecords).toHaveBeenCalledWith(mockHash);

    // Verify store was updated
    expect(store.offers.length).toBe(1);
  });

  it('should get organization offers', async () => {
    await runEffect(store.getOrganizationOffers(mockHash));

    // Verify service was called
    expect(mockOffersService.getOrganizationOffersRecords).toHaveBeenCalledTimes(1);
    expect(mockOffersService.getOrganizationOffersRecords).toHaveBeenCalledWith(mockHash);

    // Verify store was updated
    expect(store.offers.length).toBe(1);
  });

  it('should get latest offer', async () => {
    await runEffect(store.getLatestOffer(mockHash));

    // Verify service was called
    expect(mockOffersService.getLatestOfferRecord).toHaveBeenCalledTimes(1);
    expect(mockOffersService.getLatestOfferRecord).toHaveBeenCalledWith(mockHash);
  });

  it('should update offer', async () => {
    const mockOffer = createTestOffer();

    // First create an offer to get the original action hash
    await runEffect(store.createOffer(mockOffer));
    const originalActionHash = store.offers[0].original_action_hash!;
    const previousActionHash = store.offers[0].previous_action_hash!;

    // Register event handler for update
    eventBus.on('offer:updated', mockEventHandler);

    // Update the offer
    const updatedOffer = { ...mockOffer, title: 'Updated Title' };
    await runEffect(store.updateOffer(originalActionHash, previousActionHash, updatedOffer));

    // Verify service was called
    expect(mockOffersService.updateOffer).toHaveBeenCalledTimes(1);
    expect(mockOffersService.updateOffer).toHaveBeenCalledWith(
      originalActionHash,
      previousActionHash,
      updatedOffer
    );

    // Verify event was emitted
    expect(mockEventHandler).toHaveBeenCalledTimes(1);
    expect(mockEventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        offer: expect.objectContaining({
          original_action_hash: expect.any(Uint8Array),
          previous_action_hash: expect.any(Uint8Array)
        })
      })
    );
  });

  it('should delete offer', async () => {
    const mockOffer = createTestOffer();

    // First create an offer
    await runEffect(store.createOffer(mockOffer));
    const offerHash = store.offers[0].original_action_hash!;

    // Register event handler for delete
    eventBus.on('offer:deleted', mockEventHandler);

    // Delete the offer
    await runEffect(store.deleteOffer(offerHash));

    // Verify service was called
    expect(mockOffersService.deleteOffer).toHaveBeenCalledTimes(1);
    expect(mockOffersService.deleteOffer).toHaveBeenCalledWith(offerHash);

    // Verify event was emitted
    expect(mockEventHandler).toHaveBeenCalledTimes(1);
    expect(mockEventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        offerHash: expect.any(Uint8Array)
      })
    );
  });

  it('should handle errors gracefully', async () => {
    // Given
    const errorMessage = 'Failed to get all offers: Test error';
    const getAllOffersRecordsFn = vi.fn(() => Promise.reject(new Error('Test error')));
    mockOffersService.getAllOffersRecords = mockEffectFn(getAllOffersRecordsFn);

    try {
      // When
      await runEffect(store.getAllOffers());
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // Then
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(errorMessage);
    }
  });

  it('should invalidate cache', async () => {
    const getAllOffersRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
    mockOffersService.getAllOffersRecords = mockEffectFn(getAllOffersRecordsFn);

    // First call should call service
    await runEffect(store.getAllOffers());
    expect(getAllOffersRecordsFn).toHaveBeenCalledTimes(1);

    // Second call should use cache
    await runEffect(store.getAllOffers());
    expect(getAllOffersRecordsFn).toHaveBeenCalledTimes(1);

    // Invalidate cache
    store.invalidateCache();

    // Getting offers again should call service
    await runEffect(store.getAllOffers());
    expect(getAllOffersRecordsFn).toHaveBeenCalledTimes(2);
  });
});
