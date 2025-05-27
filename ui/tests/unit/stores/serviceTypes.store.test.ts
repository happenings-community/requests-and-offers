import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import { Effect as E } from 'effect';
import type { ActionHash, Record } from '@holochain/client';
import {
  createServiceTypesStore,
  type ServiceTypesStore,
  ServiceTypeStoreError
} from '$lib/stores/serviceTypes.store.svelte';
import type {
  ServiceTypesService,
  ServiceTypeError
} from '$lib/services/zomes/serviceTypes.service';
import { ServiceTypesServiceTag } from '$lib/services/zomes/serviceTypes.service';
import { StoreEventBusLive } from '$lib/stores/storeEvents';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { createTestServiceType, createMockRecord } from '../test-helpers';
import { mockEffectFn, mockEffectFnWithParams } from '../effect';
import { runEffect } from '$lib/utils/effect';
import { fakeActionHash } from '@holochain/client';

// Mock the decodeRecords utility
vi.mock('$lib/utils', () => ({
  decodeRecords: vi.fn((records: Record[]) => records.map(() => createTestServiceType()))
}));

describe('ServiceTypesStore', () => {
  let store: ServiceTypesStore;
  let mockServiceTypesService: ServiceTypesService;
  let mockRecord: Record;
  let mockActionHash: ActionHash;
  let testServiceType: ServiceTypeInDHT;

  beforeEach(async () => {
    mockRecord = await createMockRecord();
    mockActionHash = await fakeActionHash();
    testServiceType = createTestServiceType();

    // Create mock service as mutable object to avoid readonly property errors
    mockServiceTypesService = {} as ServiceTypesService;
    Object.assign(mockServiceTypesService, {
      createServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockRecord))),
      getServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockRecord))),
      getLatestServiceTypeRecord: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockRecord))),
      updateServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockActionHash))),
      deleteServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockActionHash))),
      getAllServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
        vi.fn(() => Promise.resolve([mockRecord]))
      ) as unknown as () => E.Effect<Record[], ServiceTypeError>,
      getRequestsForServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve([mockRecord]))),
      getOffersForServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve([mockRecord]))),
      getServiceTypesForEntity: mockEffectFnWithParams(
        vi.fn(() => Promise.resolve([mockActionHash]))
      ),
      linkToServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(undefined))),
      unlinkFromServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(undefined))),
      updateServiceTypeLinks: mockEffectFnWithParams(vi.fn(() => Promise.resolve(undefined))),
      deleteAllServiceTypeLinksForEntity: mockEffectFnWithParams(
        vi.fn(() => Promise.resolve(undefined))
      )
    });

    // Create store instance with mocked service
    const storeEffect = createServiceTypesStore().pipe(
      E.provideService(ServiceTypesServiceTag, mockServiceTypesService)
    );

    store = await E.runPromise(storeEffect);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      expect(store.serviceTypes).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.cache).toBeDefined();
    });
  });

  describe('getAllServiceTypes', () => {
    it('should get all service types successfully', async () => {
      // Act
      const effect = store.getAllServiceTypes();
      const providedEffect = E.provide(effect, StoreEventBusLive);
      const result = await runEffect(providedEffect);

      // Assert
      expect(result).toEqual(expect.any(Array));
      expect(store.serviceTypes.length).toBe(1);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should return cached service types when available', async () => {
      // Arrange - First populate the cache
      await runEffect(E.provide(store.getAllServiceTypes(), StoreEventBusLive));

      // Act - Second call should use cache
      const result = await runEffect(E.provide(store.getAllServiceTypes(), StoreEventBusLive));

      // Assert
      expect(result).toEqual(expect.any(Array));
    });

    it('should handle errors when getting all service types', async () => {
      // Arrange - Create a new store with error-throwing service
      const errorServiceTypesService = {
        ...mockServiceTypesService,
        getAllServiceTypes: mockEffectFn<never, ServiceTypeError>(
          vi.fn(() => Promise.reject(new Error('Network error')))
        ) as unknown as () => E.Effect<Record[], ServiceTypeError>
      };

      const errorStoreEffect = createServiceTypesStore().pipe(
        E.provideService(ServiceTypesServiceTag, errorServiceTypesService)
      );
      const errorStore = await E.runPromise(errorStoreEffect);

      // Act & Assert
      await expect(
        runEffect(E.provide(errorStore.getAllServiceTypes(), StoreEventBusLive))
      ).rejects.toThrow('Failed to get all service types');

      expect(errorStore.loading).toBe(false);
    });
  });

  describe('getServiceType', () => {
    it('should get a service type successfully', async () => {
      // Arrange
      const getServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      mockServiceTypesService.getServiceType = mockEffectFnWithParams(getServiceTypeFn);

      // Act
      const result = await runEffect(store.getServiceType(mockActionHash));

      // Assert
      expect(mockServiceTypesService.getServiceType).toHaveBeenCalledWith(mockActionHash);
      expect(result).toBeDefined();
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should return cached service type when available', async () => {
      // Arrange - First populate the cache
      const getServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      mockServiceTypesService.getServiceType = mockEffectFnWithParams(getServiceTypeFn);

      // First call to populate cache
      await runEffect(store.getServiceType(mockActionHash));

      // Reset the mock
      getServiceTypeFn.mockClear();

      // Act - Second call should use cache
      const result = await runEffect(store.getServiceType(mockActionHash));

      // Assert
      expect(getServiceTypeFn).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when service type not found', async () => {
      // Arrange
      const getServiceTypeFn = vi.fn(() => Promise.resolve(null));
      mockServiceTypesService.getServiceType = mockEffectFnWithParams(getServiceTypeFn);

      // Act
      const result = await runEffect(store.getServiceType(mockActionHash));

      // Assert
      expect(result).toBeNull();
    });

    it('should handle errors when getting service type', async () => {
      // Arrange
      const getServiceTypeFn = vi.fn(() => Promise.reject(new Error('Network error')));
      mockServiceTypesService.getServiceType = mockEffectFnWithParams(getServiceTypeFn);

      // Act & Assert
      await expect(runEffect(store.getServiceType(mockActionHash))).rejects.toThrow(
        'Failed to get service type'
      );
    });
  });

  describe('createServiceType', () => {
    it('should create a service type successfully', async () => {
      // Arrange
      const createServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      mockServiceTypesService.createServiceType = mockEffectFnWithParams(createServiceTypeFn);

      // Act
      const effect = store.createServiceType(testServiceType);
      const providedEffect = E.provide(effect, StoreEventBusLive);
      const result = await runEffect(providedEffect);

      // Assert
      expect(mockServiceTypesService.createServiceType).toHaveBeenCalledWith(testServiceType);
      expect(result).toEqual(mockRecord);
      expect(store.serviceTypes.length).toBe(1);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when creating service type', async () => {
      // Arrange
      const createServiceTypeFn = vi.fn(() => Promise.reject(new Error('Creation failed')));
      mockServiceTypesService.createServiceType = mockEffectFnWithParams(createServiceTypeFn);

      // Act & Assert
      await expect(
        runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive))
      ).rejects.toThrow('Failed to create service type');

      expect(store.loading).toBe(false);
    });
  });

  describe('updateServiceType', () => {
    it('should update a service type successfully', async () => {
      // Arrange
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      const updatedServiceType = { ...testServiceType, name: 'Updated Web Development' };

      const updateServiceTypeFn = vi.fn(() => Promise.resolve(mockActionHash));
      const getServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));

      mockServiceTypesService.updateServiceType = mockEffectFnWithParams(updateServiceTypeFn);
      mockServiceTypesService.getServiceType = mockEffectFnWithParams(getServiceTypeFn);

      // Act
      const effect = store.updateServiceType(originalHash, previousHash, updatedServiceType);
      const providedEffect = E.provide(effect, StoreEventBusLive);
      const result = await runEffect(providedEffect);

      // Assert
      expect(mockServiceTypesService.updateServiceType).toHaveBeenCalledWith(
        originalHash,
        previousHash,
        updatedServiceType
      );
      expect(mockServiceTypesService.getServiceType).toHaveBeenCalledWith(mockActionHash);
      expect(result).toEqual(mockRecord);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when updating service type', async () => {
      // Arrange
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      const updateServiceTypeFn = vi.fn(() => Promise.reject(new Error('Update failed')));
      mockServiceTypesService.updateServiceType = mockEffectFnWithParams(updateServiceTypeFn);

      // Act & Assert
      await expect(
        runEffect(
          E.provide(
            store.updateServiceType(originalHash, previousHash, testServiceType),
            StoreEventBusLive
          )
        )
      ).rejects.toThrow('Failed to update service type');

      expect(store.loading).toBe(false);
    });
  });

  describe('deleteServiceType', () => {
    it('should delete a service type successfully', async () => {
      // Arrange - First add a service type to the store
      const createServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      mockServiceTypesService.createServiceType = mockEffectFnWithParams(createServiceTypeFn);

      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));

      const deleteServiceTypeFn = vi.fn(() => Promise.resolve(mockActionHash));
      mockServiceTypesService.deleteServiceType = mockEffectFnWithParams(deleteServiceTypeFn);

      // Act
      const effect = store.deleteServiceType(mockActionHash);
      const providedEffect = E.provide(effect, StoreEventBusLive);
      await runEffect(providedEffect);

      // Assert
      expect(mockServiceTypesService.deleteServiceType).toHaveBeenCalledWith(mockActionHash);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when deleting service type', async () => {
      // Arrange
      const deleteServiceTypeFn = vi.fn(() => Promise.reject(new Error('Delete failed')));
      mockServiceTypesService.deleteServiceType = mockEffectFnWithParams(deleteServiceTypeFn);

      // Act & Assert
      await expect(
        runEffect(E.provide(store.deleteServiceType(mockActionHash), StoreEventBusLive))
      ).rejects.toThrow('Failed to delete service type');

      expect(store.loading).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache', () => {
      // Arrange
      const cacheClearSpy = vi.spyOn(store.cache, 'clear');

      // Act
      store.invalidateCache();

      // Assert
      expect(cacheClearSpy).toHaveBeenCalledTimes(1);
    });

    it('should update cache when service type is created', async () => {
      // Arrange
      const createServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      mockServiceTypesService.createServiceType = mockEffectFnWithParams(createServiceTypeFn);

      // Act
      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));

      // Assert
      expect(store.cache.getAllValid().length).toBe(1);
    });

    it('should remove from cache when service type is deleted', async () => {
      // Arrange - First add a service type
      const createServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      mockServiceTypesService.createServiceType = mockEffectFnWithParams(createServiceTypeFn);

      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));

      const deleteServiceTypeFn = vi.fn(() => Promise.resolve(mockActionHash));
      mockServiceTypesService.deleteServiceType = mockEffectFnWithParams(deleteServiceTypeFn);

      // Act
      await runEffect(E.provide(store.deleteServiceType(mockActionHash), StoreEventBusLive));

      // Assert - Cache should be updated
      expect(store.cache.get(mockActionHash)).toBeUndefined();
    });
  });

  describe('Loading States', () => {
    it('should set loading to true during operations', async () => {
      // Arrange
      let loadingDuringOperation = false;
      const getAllServiceTypesFn = vi.fn(() => {
        loadingDuringOperation = store.loading;
        return Promise.resolve([mockRecord]);
      });
      mockServiceTypesService.getAllServiceTypes = mockEffectFn<Record[], ServiceTypeError>(
        getAllServiceTypesFn
      ) as unknown as () => E.Effect<Record[], ServiceTypeError>;

      // Act
      await runEffect(E.provide(store.getAllServiceTypes(), StoreEventBusLive));

      // Assert
      expect(loadingDuringOperation).toBe(true);
      expect(store.loading).toBe(false); // Should be false after completion
    });
  });

  describe('ServiceTypeStoreError', () => {
    it('should create error from Error instance', () => {
      const originalError = new Error('Original error message');
      const storeError = ServiceTypeStoreError.fromError(originalError, 'Test context');

      expect(storeError.message).toBe('Test context: Original error message');
      expect(storeError.cause).toBe(originalError);
    });

    it('should create error from non-Error value', () => {
      const originalError = 'String error';
      const storeError = ServiceTypeStoreError.fromError(originalError, 'Test context');

      expect(storeError.message).toBe('Test context: String error');
      expect(storeError.cause).toBe(originalError);
    });
  });

  describe('Reactive State', () => {
    it('should update serviceTypes array when cache is updated', async () => {
      // Arrange
      const createServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      mockServiceTypesService.createServiceType = mockEffectFnWithParams(createServiceTypeFn);

      // Act
      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));

      // Assert
      expect(store.serviceTypes.length).toBe(1);
      expect(store.serviceTypes[0]).toHaveProperty('name', 'Web Development');
    });

    it('should remove from serviceTypes array when service type is deleted', async () => {
      // Arrange - First add a service type
      const createServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      mockServiceTypesService.createServiceType = mockEffectFnWithParams(createServiceTypeFn);

      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));
      expect(store.serviceTypes.length).toBe(1);

      const deleteServiceTypeFn = vi.fn(() => Promise.resolve(mockActionHash));
      mockServiceTypesService.deleteServiceType = mockEffectFnWithParams(deleteServiceTypeFn);

      // Act
      await runEffect(E.provide(store.deleteServiceType(mockActionHash), StoreEventBusLive));

      // Assert
      expect(store.serviceTypes.length).toBe(0);
    });
  });
});
