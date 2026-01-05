import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, pipe } from 'effect';
import { runEffect } from '$lib/utils/effect';
import { createOffersStore } from '$lib/stores/offers.store.svelte';
import type { OffersStore } from '$lib/stores/offers.store.svelte';
import { createTestOffer, createMockRecord } from '../test-helpers';
import { createTestContext } from '../../mocks/services.mock';
import type { OffersService } from '$lib/services/zomes/offers.service';
import { OffersServiceTag } from '$lib/services/zomes/offers.service';
import { CacheServiceLive } from '$lib/utils/cache.svelte';
import { Effect as E } from 'effect';

// Mock the organizationsStore with a more comprehensive mock that won't try to call Holochain
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: {
    getAcceptedOrganizations: vi.fn(() => E.succeed([])),
    // Add any other methods used by the offers.store
    organizations: []
  }
}));

// Mock the usersStore
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    getUserByAgentPubKey: vi.fn(() =>
      E.succeed({
        original_action_hash: new Uint8Array([1, 2, 3]),
        agent_pub_key: new Uint8Array([4, 5, 6]),
        resource: { name: 'Test User' }
      })
    ),
    currentUser: {
      original_action_hash: new Uint8Array([1, 2, 3]),
      agent_pub_key: new Uint8Array([4, 5, 6]),
      resource: { name: 'Test User' }
    }
  }
}));

vi.mock('$lib/stores/serviceTypes.store.svelte', () => ({
  default: {
    getServiceTypesForEntity: vi.fn(() => E.succeed([]))
  }
}));

describe('Offers Store', () => {
  let store: OffersStore;
  let mockOffersService: OffersService;
  let testContext: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    testContext = await createTestContext();

    // Get the mock service from the context
    mockOffersService = await Effect.runPromise(
      Effect.provide(OffersServiceTag, testContext.offersLayer)
    );

    // Create mock AppServices for testing
    const mockAppServices = {
      holochainClient: {} as any,
      holochainClientEffect: {} as any,
      hrea: {} as any,
      users: {} as any,
      administration: {} as any,
      offers: mockOffersService,
      requests: {} as any,
      serviceTypes: {} as any,
      organizations: {} as any,
      mediumsOfExchange: {} as any
    };

    // Create store instance using the Effect pattern with correct service dependencies
    store = await Effect.runPromise(
      createOffersStore().pipe(
        E.provideService(OffersServiceTag, mockOffersService),
        E.provide(CacheServiceLive)
      )
    );
  });

  it('should initialize with empty state', () => {
    expect(store.offers).toEqual([]);
    expect(store.error).toBeNull();
  });

  it('should create a offer', async () => {
    const newOffer = await createTestOffer();

    const effect = pipe(store.createOffer(newOffer));

    const result = await runEffect(effect);
    expect(mockOffersService.createOffer).toHaveBeenCalledWith(newOffer, undefined);
    expect(result).toBeDefined();
  });

  it('should update a offer', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;
    const updatedOffer = await createTestOffer();

    const effect = pipe(store.updateOffer(mockHash, mockHash, updatedOffer));

    const result = await runEffect(effect);
    expect(mockOffersService.updateOffer).toHaveBeenCalledWith(mockHash, mockHash, updatedOffer);
    expect(result).toBeDefined();
  });

  it('should delete a offer', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;

    const effect = pipe(store.deleteOffer(mockHash));

    await runEffect(effect);
    expect(mockOffersService.deleteOffer).toHaveBeenCalledWith(mockHash);
  });

  it('should get all offers and update the store state', async () => {
    await runEffect(store.getActiveOffers());

    // Verify service was called
    expect(mockOffersService.getActiveOffersRecords).toHaveBeenCalledTimes(1);

    // Verify store was updated
    expect(store.activeOffers.length).toBe(1);
  });

  it('should get user offers', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;

    await runEffect(store.getUserOffers(mockHash));

    // Verify service was called
    expect(mockOffersService.getUserOffersRecords).toHaveBeenCalledTimes(1);
    expect(mockOffersService.getUserOffersRecords).toHaveBeenCalledWith(mockHash);

    // Verify store was updated
    expect(store.offers.length).toBe(1);
  });

  it('should get organization offers', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;

    await runEffect(store.getOrganizationOffers(mockHash));

    // Verify service was called
    expect(mockOffersService.getOrganizationOffersRecords).toHaveBeenCalledTimes(1);
    expect(mockOffersService.getOrganizationOffersRecords).toHaveBeenCalledWith(mockHash);

    // Verify store was updated
    expect(store.offers.length).toBe(1);
  });

  it('should get latest offer', async () => {
    const mockRecord = await createMockRecord();
    const mockHash = mockRecord.signed_action.hashed.hash;

    await runEffect(store.getLatestOffer(mockHash));

    // Note: This will use the cache lookup, which in our mock returns a CacheNotFoundError
    // but the store handles this gracefully by returning null
  });

  it('should handle errors gracefully', async () => {
    // Mock the service to throw an error - need to import and use the correct error type
    const { OfferError } = await import('$lib/services/zomes/offers.service');
    vi.spyOn(mockOffersService, 'getActiveOffersRecords').mockReturnValue(
      Effect.fail(new OfferError({ message: 'Test error' }))
    );

    try {
      // When
      await runEffect(store.getActiveOffers());
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // Then
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Test error');
    }
  });

  it('should invalidate cache', async () => {
    // Just check that invalidateCache is a function and can be called
    expect(typeof store.invalidateCache).toBe('function');

    // Create a spy on cache.clear to ensure it's called
    const cacheClearSpy = vi.spyOn(store.cache, 'clear');

    // Call the invalidateCache method
    store.invalidateCache();

    // Verify the cache clear was called
    expect(cacheClearSpy).toHaveBeenCalledTimes(1);
  });

  describe('Tag-based Discovery', () => {
    it('should get offers by tag', async () => {
      const tag = 'design';

      await runEffect(store.getOffersByTag(tag));

      // Verify service was called
      expect(mockOffersService.getOffersByTag).toHaveBeenCalledWith(tag);

      // Verify store was updated (assuming mock returns 1 offer)
      expect(store.offers.length).toBe(1);
    });

    it('should handle empty results for tag search', async () => {
      const tag = 'nonexistent';

      // Mock the service to return empty array
      vi.spyOn(mockOffersService, 'getOffersByTag').mockReturnValue(Effect.succeed([]));

      await runEffect(store.getOffersByTag(tag));

      // Verify service was called
      expect(mockOffersService.getOffersByTag).toHaveBeenCalledWith(tag);

      // Verify store reflects empty results
      expect(store.offers.length).toBe(0);
    });

    it('should handle errors in tag-based search', async () => {
      const tag = 'design';
      const { OfferError } = await import('$lib/services/zomes/offers.service');

      // Mock the service to throw an error
      vi.spyOn(mockOffersService, 'getOffersByTag').mockReturnValue(
        Effect.fail(new OfferError({ message: 'Tag search failed' }))
      );

      try {
        await runEffect(store.getOffersByTag(tag));
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Tag search failed');
      }
    });

    it('should process tag search results correctly', async () => {
      const tag = 'javascript';
      const mockRecord = await createMockRecord();

      // Mock the service to return specific records
      vi.spyOn(mockOffersService, 'getOffersByTag').mockReturnValue(Effect.succeed([mockRecord]));

      await runEffect(store.getOffersByTag(tag));

      // Verify service was called with correct tag
      expect(mockOffersService.getOffersByTag).toHaveBeenCalledWith(tag);

      // Verify the returned data is processed through the same pipeline
      expect(store.offers.length).toBeGreaterThan(0);
    });
  });
});
