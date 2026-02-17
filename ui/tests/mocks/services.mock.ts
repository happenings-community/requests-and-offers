import { vi } from 'vitest';
import { Layer, Effect as E } from 'effect';
import type { OffersService } from '$lib/services/zomes/offers.service';
import type { RequestsService } from '$lib/services/zomes/requests.service';
import type { ServiceTypesService } from '$lib/services/zomes/serviceTypes.service';
import { OffersServiceTag } from '$lib/services/zomes/offers.service';
import { RequestsServiceTag } from '$lib/services/zomes/requests.service';
import { ServiceTypesServiceTag } from '$lib/services/zomes/serviceTypes.service';
import { CacheServiceTag, CacheNotFoundError } from '$lib/utils/cache.svelte';
import type { CacheService, CacheableEntity, EntityCacheService } from '$lib/utils/cache.svelte';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import {
  createTestOffer,
  createTestRequest,
  createMockRecord,
  createMockActionHash
} from '../unit/test-helpers';
import { createMockServiceTypesServiceLayer } from './serviceTypes.mock';

/**
 * Creates a mock CacheService layer for testing
 */
export const createMockCacheServiceLayer = (): Layer.Layer<CacheServiceTag> => {
  const mockCacheService: CacheService = {
    createEntityCache: <T extends CacheableEntity>() => {
      // Create a new Map for each cache instance to ensure isolation
      const storage = new Map<string, T>();

      const mockCache: EntityCacheService<T> = {
        config: { capacity: 1000, expiryMs: 300000, debug: false },
        get: vi.fn((key: string) => {
          const item = storage.get(key);
          if (item) {
            return E.succeed(item);
          }
          return E.fail(new CacheNotFoundError({ key }));
        }),
        set: vi.fn((key: string, value: T) => {
          storage.set(key, value);
          return E.succeed(undefined);
        }),
        contains: vi.fn((key: string) => E.succeed(storage.has(key))),
        delete: vi.fn((key: string) => {
          const existed = storage.has(key);
          storage.delete(key);
          return E.succeed(existed);
        }),
        clear: vi.fn(() => {
          storage.clear();
          return E.succeed(undefined);
        }),
        stats: vi.fn(() => E.succeed({ size: storage.size, hits: 0, misses: 0 })),
        invalidate: vi.fn((key: string) => {
          storage.delete(key);
          return E.succeed(undefined);
        }),
        refresh: vi.fn(() => E.succeed(undefined))
      };
      return E.succeed(mockCache);
    }
  };

  return Layer.succeed(CacheServiceTag, mockCacheService);
};

/**
 * Creates a mock HolochainClientService layer for testing
 */
export const createMockHolochainClientServiceLayer = (): Layer.Layer<HolochainClientServiceTag> => {
  // Create a minimal mock that satisfies the Layer requirements
  const mockService = {
    appId: 'test-app',
    client: null,
    isConnected: true,
    isConnecting: false,
    connectClient: vi.fn(() => Promise.resolve()),
    waitForConnection: vi.fn(() => Promise.resolve()),
    verifyConnection: vi.fn(() => Promise.resolve(true)),
    getAppInfo: vi.fn(() => Promise.resolve({})),
    getPeerMetaInfo: vi.fn(() => Promise.resolve({})),
    callZome: vi.fn(() => Promise.resolve({ Ok: {} })),
    getNetworkSeed: vi.fn(() => Promise.resolve('test-network-seed')),
    getNetworkInfo: vi.fn(() =>
      Promise.resolve({
        networkSeed: 'test-network-seed',
        dnaHash: 'test-dna-hash',
        roleName: 'requests_and_offers'
      })
    ),
    getNetworkPeers: vi.fn(() => Promise.resolve(['peer1', 'peer2', 'peer3'])),
    isGroupProgenitor: vi.fn(() => Promise.resolve(false))
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Layer.succeed(HolochainClientServiceTag, mockService as any);
};

/**
 * Creates a mock OffersService layer for testing
 */
export const createMockOffersServiceLayer = async (): Promise<Layer.Layer<OffersServiceTag>> => {
  const mockRecord = await createMockRecord();
  const testOffer = await createTestOffer();
  const mockActionHash = createMockActionHash('test');

  const mockOffersService: OffersService = {
    createOffer: vi.fn().mockReturnValue(E.succeed(mockRecord)),
    getActiveOffersRecords: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getArchivedOffersRecords: vi.fn().mockReturnValue(E.succeed([])),
    getUserOffersRecords: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getUserActiveOffersRecords: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getUserArchivedOffersRecords: vi.fn().mockReturnValue(E.succeed([])),
    getOrganizationOffersRecords: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getLatestOfferRecord: vi.fn().mockReturnValue(E.succeed(mockRecord)),
    getLatestOffer: vi.fn().mockReturnValue(E.succeed(testOffer)),
    updateOffer: vi.fn().mockReturnValue(E.succeed(mockRecord)),
    deleteOffer: vi.fn().mockReturnValue(E.succeed(true)),
    archiveOffer: vi.fn().mockReturnValue(E.succeed(true)),
    getMyListings: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getOfferCreator: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
    getOfferOrganization: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
    getOffersByTag: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getServiceTypesForOffer: vi.fn().mockReturnValue(E.succeed([])),
    getMediumsOfExchangeForOffer: vi.fn().mockReturnValue(E.succeed([]))
  };

  return Layer.succeed(OffersServiceTag, mockOffersService);
};

/**
 * Creates a mock RequestsService layer for testing
 */
export const createMockRequestsServiceLayer = async (): Promise<
  Layer.Layer<RequestsServiceTag>
> => {
  const mockRecord = await createMockRecord();
  const testRequest = await createTestRequest();

  const mockRequestsService: RequestsService = {
    createRequest: vi.fn().mockReturnValue(E.succeed(mockRecord)),
    getActiveRequestsRecords: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getArchivedRequestsRecords: vi.fn().mockReturnValue(E.succeed([])),
    getUserRequestsRecords: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getUserActiveRequestsRecords: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getUserArchivedRequestsRecords: vi.fn().mockReturnValue(E.succeed([])),
    getOrganizationRequestsRecords: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getLatestRequestRecord: vi.fn().mockReturnValue(E.succeed(mockRecord)),
    getLatestRequest: vi.fn().mockReturnValue(E.succeed(testRequest)),
    updateRequest: vi.fn().mockReturnValue(E.succeed(mockRecord)),
    deleteRequest: vi.fn().mockReturnValue(E.succeed(true)),
    archiveRequest: vi.fn().mockReturnValue(E.succeed(true)),
    getMyListings: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getRequestsByTag: vi.fn().mockReturnValue(E.succeed([mockRecord])),
    getServiceTypesForRequest: vi.fn().mockReturnValue(E.succeed([])),
    getMediumsOfExchangeForRequest: vi.fn().mockReturnValue(E.succeed([]))
  };

  return Layer.succeed(RequestsServiceTag, mockRequestsService);
};

/**
 * Helper to create a test context with all required service layers
 */
export const createTestContext = async () => {
  const cacheLayer = createMockCacheServiceLayer();
  const holochainClientLayer = createMockHolochainClientServiceLayer();
  const offersLayer = await createMockOffersServiceLayer();
  const requestsLayer = await createMockRequestsServiceLayer();
  const serviceTypesLayer = createMockServiceTypesServiceLayer();

  return {
    cacheLayer,
    holochainClientLayer,
    offersLayer,
    requestsLayer,
    serviceTypesLayer,
    // Combined layer for convenience
    combinedLayer: Layer.merge(
      cacheLayer,
      Layer.merge(
        holochainClientLayer,
        Layer.merge(offersLayer, Layer.merge(requestsLayer, serviceTypesLayer))
      )
    )
  };
};

