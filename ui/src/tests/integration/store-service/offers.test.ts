import { expect, describe, it, beforeEach, vi } from 'vitest';
import { createOffersStore, type OffersStore } from '@/stores/offers.store.svelte';
import { createTestOffer, createMockRecord } from '@/tests/utils/test-helpers';
import type { OffersService } from '@/services/zomes/offers.service';
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

describe('Offers Store-Service Integration', () => {
  let offersStore: OffersStore;
  let offersService: OffersService;
  let eventBus: EventBus<StoreEvents>;
  let mockRecord: Record;
  let mockEventHandler: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockRecord = await createMockRecord();

    // Create a mock offers service
    offersService = {
      createOffer: vi.fn(() => Promise.resolve(mockRecord)),
      getAllOffersRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getUserOffersRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getOrganizationOffersRecords: vi.fn(() => Promise.resolve([mockRecord])),
      getLatestOfferRecord: vi.fn(() => Promise.resolve(mockRecord)),
      getLatestOffer: vi.fn(() => Promise.resolve(createTestOffer())),
      updateOffer: vi.fn(() => Promise.resolve(mockRecord)),
      deleteOffer: vi.fn(() => Promise.resolve()),
      getOfferCreator: vi.fn(() => Promise.resolve(null)),
      getOfferOrganization: vi.fn(() => Promise.resolve(null))
    };

    // Create a real event bus instance
    eventBus = createEventBus<StoreEvents>();
    mockEventHandler = vi.fn();

    // Create a new offers store instance for each test
    offersStore = createOffersStore(offersService, eventBus);
  });

  it('should create an offer and update the store', async () => {
    const mockOffer = createTestOffer();

    // Register event handler
    eventBus.on('offer:created', mockEventHandler);

    // Call the createOffer method
    await offersStore.createOffer(mockOffer);

    // Verify the service was called
    expect(offersService.createOffer).toHaveBeenCalledTimes(1);
    expect(offersService.createOffer).toHaveBeenCalledWith(mockOffer, undefined);

    // Verify the store was updated
    expect(offersStore.offers.length).toBe(1);

    // Verify the event was emitted
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

  it('should get all offers and update the store', async () => {
    // Call the getAllOffers method
    const result = await offersStore.getAllOffers();

    // Verify the service was called
    expect(offersService.getAllOffersRecords).toHaveBeenCalledTimes(1);

    // Verify the store was updated
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('original_action_hash');
    expect(result[0]).toHaveProperty('previous_action_hash');
  });

  it('should handle errors when getting all offers', async () => {
    // Mock the service to throw an error
    offersService.getAllOffersRecords = vi.fn(() => Promise.reject(new Error('Test error')));

    try {
      await offersStore.getAllOffers();
      // If we reach here, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      // Verify the error was handled
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Test error');
      expect(offersStore.error).toBe('Test error');
    }
  });

  it('should handle cache invalidation', async () => {
    // First get all offers to populate cache
    await offersStore.getAllOffers();

    // Verify cache has data
    expect(offersStore.cache.getAllValid().length).toBe(1);

    // Invalidate cache
    offersStore.invalidateCache();

    // Verify cache is empty
    expect(offersStore.cache.getAllValid().length).toBe(0);

    // Getting offers again should call service
    await offersStore.getAllOffers();
    expect(offersService.getAllOffersRecords).toHaveBeenCalledTimes(2);
  });
});
