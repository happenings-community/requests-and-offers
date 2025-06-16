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
import { mockEffectFn, mockEffectFnWithParams } from '../unit/effect';
import { createTestOffer, createTestRequest, createMockRecord } from '../unit/test-helpers';
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
    connectClient: vi.fn(() => Promise.resolve()),
    getAppInfo: vi.fn(() => Promise.resolve({})),
    callZome: vi.fn(() => Promise.resolve({ Ok: {} }))
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

  // Create mock functions with spies
  const createOfferFn = vi.fn(() => Promise.resolve(mockRecord));
  const getAllOffersRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
  const getUserOffersRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
  const getOrganizationOffersRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
  const getLatestOfferRecordFn = vi.fn(() => Promise.resolve(mockRecord));
  const getLatestOfferFn = vi.fn(() => Promise.resolve(testOffer));
  const updateOfferFn = vi.fn(() => Promise.resolve(mockRecord));
  const deleteOfferFn = vi.fn(() => Promise.resolve(true));
  const getOfferCreatorFn = vi.fn(() => Promise.resolve(mockRecord.signed_action.hashed.hash));
  const getOfferOrganizationFn = vi.fn(() => Promise.resolve(mockRecord.signed_action.hashed.hash));
  const getOffersByTagFn = vi.fn(() => Promise.resolve([mockRecord]));

  const mockOffersService: OffersService = {
    createOffer: mockEffectFnWithParams(createOfferFn),
    getAllOffersRecords: mockEffectFn(getAllOffersRecordsFn),
    getUserOffersRecords: mockEffectFnWithParams(getUserOffersRecordsFn),
    getOrganizationOffersRecords: mockEffectFnWithParams(getOrganizationOffersRecordsFn),
    getLatestOfferRecord: mockEffectFnWithParams(getLatestOfferRecordFn),
    getLatestOffer: mockEffectFnWithParams(getLatestOfferFn),
    updateOffer: mockEffectFnWithParams(updateOfferFn),
    deleteOffer: mockEffectFnWithParams(deleteOfferFn),
    getOfferCreator: mockEffectFnWithParams(getOfferCreatorFn),
    getOfferOrganization: mockEffectFnWithParams(getOfferOrganizationFn),
    getOffersByTag: mockEffectFnWithParams(getOffersByTagFn)
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

  // Create mock functions with spies
  const createRequestFn = vi.fn(() => Promise.resolve(mockRecord));
  const getAllRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
  const getUserRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
  const getOrganizationRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRecord]));
  const getLatestRequestRecordFn = vi.fn(() => Promise.resolve(mockRecord));
  const getLatestRequestFn = vi.fn(() => Promise.resolve(testRequest));
  const updateRequestFn = vi.fn(() => Promise.resolve(mockRecord));
  const deleteRequestFn = vi.fn(() => Promise.resolve(true));
  const getRequestsByTagFn = vi.fn(() => Promise.resolve([mockRecord]));

  const mockRequestsService: RequestsService = {
    createRequest: mockEffectFnWithParams(createRequestFn),
    getAllRequestsRecords: mockEffectFn(getAllRequestsRecordsFn),
    getUserRequestsRecords: mockEffectFnWithParams(getUserRequestsRecordsFn),
    getOrganizationRequestsRecords: mockEffectFnWithParams(getOrganizationRequestsRecordsFn),
    getLatestRequestRecord: mockEffectFnWithParams(getLatestRequestRecordFn),
    getLatestRequest: mockEffectFnWithParams(getLatestRequestFn),
    updateRequest: mockEffectFnWithParams(updateRequestFn),
    deleteRequest: mockEffectFnWithParams(deleteRequestFn),
    getRequestsByTag: mockEffectFnWithParams(getRequestsByTagFn)
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

/**
 * Helper to get the mock OffersService from a layer for testing
 */
export const getMockOffersService = async (): Promise<OffersService> => {
  const layer = await createMockOffersServiceLayer();
  return await E.runPromise(E.provide(OffersServiceTag, layer));
};

/**
 * Helper to get the mock RequestsService from a layer for testing
 */
export const getMockRequestsService = async (): Promise<RequestsService> => {
  const layer = await createMockRequestsServiceLayer();
  return await E.runPromise(E.provide(RequestsServiceTag, layer));
};

/**
 * Helper to get the mock ServiceTypesService from a layer for testing
 */
export const getMockServiceTypesService = async (): Promise<ServiceTypesService> => {
  const layer = createMockServiceTypesServiceLayer();
  return await E.runPromise(E.provide(ServiceTypesServiceTag, layer));
};
