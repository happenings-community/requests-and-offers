import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createOffersStore, type OffersStore } from '@/stores/offers.store.svelte';
import { createTestOffer, createMockRecord } from '@/tests/utils/test-helpers';
import type { OffersService } from '@/services/zomes/offers.service';
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

describe('Offers Store', () => {
  let offersStore: OffersStore;
  let mockOffersService: OffersService;
  let eventBus: EventBus<StoreEvents>;
  let mockRecord: Record;
  let mockCreatedHandler: ReturnType<typeof vi.fn>;
  let mockUpdatedHandler: ReturnType<typeof vi.fn>;
  let mockDeletedHandler: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockRecord = await createMockRecord();

    // Create mock service
    mockOffersService = {
      createOffer: vi.fn(() => Promise.resolve(mockRecord)),
      getAllOffersRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getUserOffersRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getOrganizationOffersRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getLatestOfferRecord: vi.fn(() => Promise.resolve(mockRecord)),
      getLatestOffer: vi.fn(() => Promise.resolve(createTestOffer())),
      updateOffer: vi.fn(() => Promise.resolve(mockRecord)),
      deleteOffer: vi.fn(() => Promise.resolve()),
      getOfferCreator: vi.fn(() => Promise.resolve(fakeActionHash())),
      getOfferOrganization: vi.fn(() => Promise.resolve(fakeActionHash()))
    };

    // Create real event bus with mock handlers
    eventBus = createEventBus<StoreEvents>();
    mockCreatedHandler = vi.fn();
    mockUpdatedHandler = vi.fn();
    mockDeletedHandler = vi.fn();

    // Create store instance
    offersStore = createOffersStore(mockOffersService, eventBus);
  });

  it('should create an offer', async () => {
    const mockOffer = createTestOffer();

    // Register event handler
    eventBus.on('offer:created', mockCreatedHandler);

    // Call createOffer
    await offersStore.createOffer(mockOffer);

    // Verify service was called
    expect(mockOffersService.createOffer).toHaveBeenCalledTimes(1);
    expect(mockOffersService.createOffer).toHaveBeenCalledWith(mockOffer, undefined);

    // Verify store was updated
    expect(offersStore.offers.length).toBe(1);

    // Verify event was emitted
    expect(mockCreatedHandler).toHaveBeenCalledTimes(1);
    expect(mockCreatedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        offer: expect.objectContaining({
          original_action_hash: expect.any(Uint8Array),
          previous_action_hash: expect.any(Uint8Array)
        })
      })
    );
  });

  it('should get all offers', async () => {
    // Call getAllOffers
    const result = await offersStore.getAllOffers();

    // Verify service was called
    expect(mockOffersService.getAllOffersRecords).toHaveBeenCalledTimes(1);

    // Verify store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
  });

  it('should get user offers', async () => {
    const userHash = await fakeActionHash();

    // Call getUserOffers
    const result = await offersStore.getUserOffers(userHash);

    // Verify service was called
    expect(mockOffersService.getUserOffersRecords).toHaveBeenCalledTimes(1);
    expect(mockOffersService.getUserOffersRecords).toHaveBeenCalledWith(userHash);

    // Verify store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
    expect(result[0].creator).toBeDefined();
  });

  it('should get organization offers', async () => {
    const organizationHash = await fakeActionHash();

    // Call getOrganizationOffers
    const result = await offersStore.getOrganizationOffers(organizationHash);

    // Verify service was called
    expect(mockOffersService.getOrganizationOffersRecords).toHaveBeenCalledTimes(1);
    expect(mockOffersService.getOrganizationOffersRecords).toHaveBeenCalledWith(organizationHash);

    // Verify store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
    expect(result[0].organization).toEqual(organizationHash);
  });

  it('should get latest offer', async () => {
    const originalActionHash = await fakeActionHash();

    // Call getLatestOffer
    const result = await offersStore.getLatestOffer(originalActionHash);

    // Verify service was called
    expect(mockOffersService.getLatestOfferRecord).toHaveBeenCalledTimes(1);
    expect(mockOffersService.getLatestOfferRecord).toHaveBeenCalledWith(originalActionHash);

    // Verify result
    expect(result).toHaveProperty('original_action_hash');
    expect(result).toHaveProperty('previous_action_hash');
  });

  it('should update offer', async () => {
    const mockOffer = createTestOffer();

    // First create an offer to get the original action hash
    await offersStore.createOffer(mockOffer);
    const originalActionHash = offersStore.offers[0].original_action_hash!;
    const previousActionHash = offersStore.offers[0].previous_action_hash!;

    // Register event handler for update
    eventBus.on('offer:updated', mockUpdatedHandler);

    // Then update it
    await offersStore.updateOffer(originalActionHash, previousActionHash, mockOffer);

    // Verify service was called
    expect(mockOffersService.updateOffer).toHaveBeenCalledTimes(1);
    expect(mockOffersService.updateOffer).toHaveBeenCalledWith(
      originalActionHash,
      previousActionHash,
      mockOffer
    );

    // Verify store was updated
    const updatedOffer = offersStore.offers[0];
    expect(updatedOffer).toBeDefined();
    expect(updatedOffer.original_action_hash).toEqual(originalActionHash);
    expect(updatedOffer.previous_action_hash).toBeDefined();

    // Verify event was emitted
    expect(mockUpdatedHandler).toHaveBeenCalledTimes(1);
    expect(mockUpdatedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        offer: expect.objectContaining({
          original_action_hash: originalActionHash,
          previous_action_hash: expect.any(Uint8Array)
        })
      })
    );
  });

  it('should delete offer', async () => {
    const mockOffer = createTestOffer();

    // First create an offer
    await offersStore.createOffer(mockOffer);
    const offerHash = offersStore.offers[0].original_action_hash!;

    // Register event handler for delete
    eventBus.on('offer:deleted', mockDeletedHandler);

    // Then delete it
    await offersStore.deleteOffer(offerHash);

    // Verify service was called
    expect(mockOffersService.deleteOffer).toHaveBeenCalledTimes(1);
    expect(mockOffersService.deleteOffer).toHaveBeenCalledWith(offerHash);

    // Verify store was updated
    expect(offersStore.offers.length).toBe(0);

    // Verify event was emitted
    expect(mockDeletedHandler).toHaveBeenCalledTimes(1);
    expect(mockDeletedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        offerHash
      })
    );
  });

  it('should handle errors gracefully', async () => {
    // Mock service to throw error
    mockOffersService.getAllOffersRecords = vi.fn(() => Promise.reject(new Error('Test error')));

    try {
      await offersStore.getAllOffers();
      // If we reach here, test should fail
      expect(true).toBe(false);
    } catch (error) {
      // Verify error was handled
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Test error');
      expect(offersStore.error).toBe('Test error');
    }
  });

  it('should invalidate cache', () => {
    // Add some data to the cache first
    offersStore.cache.set({
      ...createTestOffer(),
      original_action_hash: new Uint8Array([1, 2, 3])
    });

    // Verify cache has data
    expect(offersStore.cache.getAllValid().length).toBe(1);

    // Invalidate cache
    offersStore.invalidateCache();

    // Verify cache is empty
    expect(offersStore.cache.getAllValid().length).toBe(0);
  });
});
