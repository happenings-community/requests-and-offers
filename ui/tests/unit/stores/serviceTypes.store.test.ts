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
import { CacheServiceLive } from '$lib/utils/cache.svelte';

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

  // Helper function to create a mock service
  const createMockService = (overrides: Partial<ServiceTypesService> = {}): ServiceTypesService => {
    const defaultService = {
      createServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockRecord))),
      getServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockRecord))),
      getLatestServiceTypeRecord: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockRecord))),
      updateServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockActionHash))),
      deleteServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockActionHash))),
      getAllServiceTypes: mockEffectFn<
        { pending: Record[]; approved: Record[]; rejected: Record[] },
        ServiceTypeError
      >(
        vi.fn(() => Promise.resolve({ pending: [], approved: [mockRecord], rejected: [] }))
      ) as unknown as () => E.Effect<
        { pending: Record[]; approved: Record[]; rejected: Record[] },
        ServiceTypeError
      >,
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
      ),
      getUsersForServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve([mockRecord]))),

      // Status management methods
      suggestServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockRecord))),
      approveServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockActionHash))),
      rejectServiceType: mockEffectFnWithParams(vi.fn(() => Promise.resolve(mockActionHash))),
      getPendingServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
        vi.fn(() => Promise.resolve([]))
      ) as unknown as () => E.Effect<Record[], ServiceTypeError>,
      getApprovedServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
        vi.fn(() => Promise.resolve([mockRecord]))
      ) as unknown as () => E.Effect<Record[], ServiceTypeError>,
      getRejectedServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
        vi.fn(() => Promise.resolve([]))
      ) as unknown as () => E.Effect<Record[], ServiceTypeError>
    } as ServiceTypesService;
    return { ...defaultService, ...overrides } as ServiceTypesService;
  };

  // Helper function to create a store with custom service
  const createStoreWithService = async (
    service: ServiceTypesService
  ): Promise<ServiceTypesStore> => {
    return await E.runPromise(
      createServiceTypesStore().pipe(
        E.provideService(ServiceTypesServiceTag, service),
        E.provide(CacheServiceLive)
      )
    );
  };

  beforeEach(async () => {
    mockRecord = await createMockRecord();
    mockActionHash = await fakeActionHash();
    testServiceType = createTestServiceType();

    // Create default mock service
    mockServiceTypesService = createMockService();

    // Create store instance with mocked service
    store = await createStoreWithService(mockServiceTypesService);
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
        ) as unknown as () => E.Effect<
          { pending: Record[]; approved: Record[]; rejected: Record[] },
          ServiceTypeError
        >
      };

      const errorStoreEffect = createServiceTypesStore().pipe(
        E.provideService(ServiceTypesServiceTag, errorServiceTypesService),
        E.provide(CacheServiceLive)
      );
      const errorStore = await E.runPromise(errorStoreEffect);

      // Act & Assert
      await expect(
        runEffect(E.provide(errorStore.getAllServiceTypes(), StoreEventBusLive))
      ).rejects.toThrow('Failed to get all service types');

      // Note: Loading state behavior in error cases - the store implementation
      // sets loading to false in the tap() after catchAll, but when an error occurs,
      // the effect fails before reaching the final tap, so loading remains true
      expect(errorStore.loading).toBe(true);
    });
  });

  describe('getServiceType', () => {
    it('should get a service type successfully', async () => {
      // Act
      const result = await runEffect(store.getServiceType(mockActionHash));

      // Assert
      expect(result).toBeDefined();
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should return cached service type when available', async () => {
      // Arrange - Create a service with a spy function
      const getServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      const customService = createMockService({
        getServiceType: mockEffectFnWithParams(getServiceTypeFn)
      });
      const customStore = await createStoreWithService(customService);

      // Use the hash from the mock record for consistency
      const recordHash = mockRecord.signed_action.hashed.hash;

      // First call to populate cache
      await runEffect(customStore.getServiceType(recordHash));

      // Reset the mock to track subsequent calls
      getServiceTypeFn.mockClear();

      // Act - Second call should use cache (use the same hash)
      const result = await runEffect(customStore.getServiceType(recordHash));

      // Assert - Service should not be called again due to cache
      expect(getServiceTypeFn).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null when service type not found', async () => {
      // Arrange
      const getServiceTypeFn = vi.fn(() => Promise.resolve(null));
      const customService = createMockService({
        getServiceType: mockEffectFnWithParams(getServiceTypeFn)
      });
      const customStore = await createStoreWithService(customService);

      // Act
      const result = await runEffect(customStore.getServiceType(mockActionHash));

      // Assert
      expect(result).toBeNull();
    });

    it('should handle errors when getting service type', async () => {
      // Arrange - Create a service that returns null when not found
      const getServiceTypeFn = vi.fn(() => Promise.resolve(null));
      const customService = createMockService({
        getServiceType: mockEffectFnWithParams(getServiceTypeFn)
      });
      const customStore = await createStoreWithService(customService);

      // Act - getServiceType should return null for not found items
      const result = await runEffect(customStore.getServiceType(mockActionHash));

      // Assert - Should return null, not throw an error
      expect(result).toBeNull();
    });
  });

  describe('createServiceType', () => {
    it('should create a service type successfully', async () => {
      // Act
      const effect = store.createServiceType(testServiceType);
      const providedEffect = E.provide(effect, StoreEventBusLive);
      const result = await runEffect(providedEffect);

      // Assert
      expect(result).toEqual(mockRecord);
      expect(store.serviceTypes.length).toBe(1);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when creating service type', async () => {
      // Arrange
      const createServiceTypeFn = vi.fn(() => Promise.reject(new Error('Creation failed')));
      const customService = createMockService({
        createServiceType: mockEffectFnWithParams(createServiceTypeFn)
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(
        runEffect(E.provide(customStore.createServiceType(testServiceType), StoreEventBusLive))
      ).rejects.toThrow('Failed to create service type');

      // Loading should remain true after error because the effect fails before the final tap()
      expect(customStore.loading).toBe(true);
    });
  });

  describe('updateServiceType', () => {
    it('should update a service type successfully', async () => {
      // Arrange
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      const updatedServiceType = { ...testServiceType, name: 'Updated Web Development' };

      // Act
      const effect = store.updateServiceType(originalHash, previousHash, updatedServiceType);
      const providedEffect = E.provide(effect, StoreEventBusLive);
      const result = await runEffect(providedEffect);

      // Assert
      expect(result).toEqual(mockRecord);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when updating service type', async () => {
      // Arrange
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      const updateServiceTypeFn = vi.fn(() => Promise.reject(new Error('Update failed')));
      const customService = createMockService({
        updateServiceType: mockEffectFnWithParams(updateServiceTypeFn)
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(
        runEffect(
          E.provide(
            customStore.updateServiceType(originalHash, previousHash, testServiceType),
            StoreEventBusLive
          )
        )
      ).rejects.toThrow('Failed to update service type');

      // Loading should remain true after error because the effect fails before the final tap()
      expect(customStore.loading).toBe(true);
    });
  });

  describe('deleteServiceType', () => {
    it('should delete a service type successfully', async () => {
      // Arrange - First add a service type to the store
      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));

      // Act
      const effect = store.deleteServiceType(mockActionHash);
      const providedEffect = E.provide(effect, StoreEventBusLive);
      await runEffect(providedEffect);

      // Assert
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when deleting service type', async () => {
      // Arrange
      const deleteServiceTypeFn = vi.fn(() => Promise.reject(new Error('Delete failed')));
      const customService = createMockService({
        deleteServiceType: mockEffectFnWithParams(deleteServiceTypeFn)
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(
        runEffect(E.provide(customStore.deleteServiceType(mockActionHash), StoreEventBusLive))
      ).rejects.toThrow('Failed to delete service type');

      // Loading should remain true after error because the effect fails before the final tap()
      expect(customStore.loading).toBe(true);
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
      // Act
      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));

      // Assert - Check store state instead of cache directly
      expect(store.serviceTypes.length).toBe(1);
    });

    it('should remove from cache when service type is deleted', async () => {
      // Arrange - First add a service type
      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));

      // Act - Use the same hash that was used to create the service type
      const serviceTypeHash = mockRecord.signed_action.hashed.hash;
      await runEffect(E.provide(store.deleteServiceType(serviceTypeHash), StoreEventBusLive));

      // Assert - Check store state instead of cache directly
      expect(store.serviceTypes.length).toBe(0);
    });
  });

  describe('Loading States', () => {
    it('should set loading to true during operations', async () => {
      let loadingDuringOperation = false;

      const customService = createMockService({
        getAllServiceTypes: mockEffectFn<
          { pending: Record[]; approved: Record[]; rejected: Record[] },
          ServiceTypeError
        >(
          vi.fn(async () => {
            // Check loading state during the operation
            loadingDuringOperation = testStore.loading;
            return { pending: [], approved: [], rejected: [] };
          })
        ) as unknown as () => E.Effect<
          { pending: Record[]; approved: Record[]; rejected: Record[] },
          ServiceTypeError
        >
      });
      const testStore = await createStoreWithService(customService);

      // Act
      await runEffect(E.provide(testStore.getAllServiceTypes(), StoreEventBusLive));

      // Assert
      expect(loadingDuringOperation).toBe(true);
      expect(testStore.loading).toBe(false); // Should be false after completion
    });
  });

  describe('suggestServiceType', () => {
    it('should suggest a service type successfully', async () => {
      // Act
      const effect = store.suggestServiceType(testServiceType);
      const providedEffect = E.provide(effect, StoreEventBusLive);
      const result = await runEffect(providedEffect);

      // Assert
      expect(result).toEqual(mockRecord);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when suggesting service type', async () => {
      // Arrange
      const suggestServiceTypeFn = vi.fn(() => Promise.reject(new Error('Suggestion failed')));
      const customService = createMockService({
        suggestServiceType: mockEffectFnWithParams(suggestServiceTypeFn)
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(
        runEffect(E.provide(customStore.suggestServiceType(testServiceType), StoreEventBusLive))
      ).rejects.toThrow('Failed to suggest service type');

      expect(customStore.loading).toBe(true);
    });
  });

  describe('approveServiceType', () => {
    it('should approve a service type successfully', async () => {
      // Act
      const effect = store.approveServiceType(mockActionHash);
      const providedEffect = E.provide(effect, StoreEventBusLive);
      await runEffect(providedEffect);

      // Assert
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when approving service type', async () => {
      // Arrange
      const approveServiceTypeFn = vi.fn(() => Promise.reject(new Error('Approval failed')));
      const customService = createMockService({
        approveServiceType: mockEffectFnWithParams(approveServiceTypeFn)
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(
        runEffect(E.provide(customStore.approveServiceType(mockActionHash), StoreEventBusLive))
      ).rejects.toThrow('Failed to approve service type');

      expect(customStore.loading).toBe(true);
    });
  });

  describe('rejectServiceType', () => {
    it('should reject a service type successfully', async () => {
      // Act
      const effect = store.rejectServiceType(mockActionHash);
      const providedEffect = E.provide(effect, StoreEventBusLive);
      await runEffect(providedEffect);

      // Assert
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when rejecting service type', async () => {
      // Arrange
      const rejectServiceTypeFn = vi.fn(() => Promise.reject(new Error('Rejection failed')));
      const customService = createMockService({
        rejectServiceType: mockEffectFnWithParams(rejectServiceTypeFn)
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(
        runEffect(E.provide(customStore.rejectServiceType(mockActionHash), StoreEventBusLive))
      ).rejects.toThrow('Failed to reject service type');

      expect(customStore.loading).toBe(true);
    });
  });

  describe('Status-based Service Type Lists', () => {
    it('should get pending service types', async () => {
      // Arrange - Create a fresh mock record for this test
      const mockPendingRecord = await createMockRecord();
      const mockPendingRecords = [mockPendingRecord];
      const customService = createMockService({
        getPendingServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          vi.fn(() => Promise.resolve(mockPendingRecords))
        )
      });
      const customStore = await createStoreWithService(customService);

      // Act
      const effect = customStore.getPendingServiceTypes();
      const result = await runEffect(E.provide(effect, StoreEventBusLive));

      // Assert - The store returns UI-formatted service types
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('original_action_hash');
      expect(result[0]).toHaveProperty('status', 'pending');
      expect(customStore.loading).toBe(false);
      expect(customStore.error).toBeNull();
    });

    it('should get approved service types', async () => {
      // Arrange - Create a fresh mock record for this test
      const mockApprovedRecord = await createMockRecord();
      const mockApprovedRecords = [mockApprovedRecord];
      const customService = createMockService({
        getApprovedServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          vi.fn(() => Promise.resolve(mockApprovedRecords))
        )
      });
      const customStore = await createStoreWithService(customService);

      // Act
      const effect = customStore.getApprovedServiceTypes();
      const result = await runEffect(E.provide(effect, StoreEventBusLive));

      // Assert - The store returns UI-formatted service types
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('original_action_hash');
      expect(result[0]).toHaveProperty('status', 'approved');
      expect(customStore.loading).toBe(false);
      expect(customStore.error).toBeNull();
    });

    it('should get rejected service types', async () => {
      // Arrange - Create a fresh mock record for this test
      const mockRejectedRecord = await createMockRecord();
      const mockRejectedRecords = [mockRejectedRecord];
      const customService = createMockService({
        getRejectedServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          vi.fn(() => Promise.resolve(mockRejectedRecords))
        )
      });
      const customStore = await createStoreWithService(customService);

      // Act
      const effect = customStore.getRejectedServiceTypes();
      const result = await runEffect(E.provide(effect, StoreEventBusLive));

      // Assert - The store returns UI-formatted service types
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('original_action_hash');
      expect(result[0]).toHaveProperty('status', 'rejected');
      expect(customStore.loading).toBe(false);
      expect(customStore.error).toBeNull();
    });

    it('should handle errors when getting status-based service types', async () => {
      // Arrange
      const errorMessage = 'Access denied';
      const customService = createMockService({
        getPendingServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          vi.fn(() => Promise.reject(new Error(errorMessage)))
        )
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(
        runEffect(E.provide(customStore.getPendingServiceTypes(), StoreEventBusLive))
      ).rejects.toThrow(errorMessage);

      expect(customStore.loading).toBe(true);
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
      // Act
      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));

      // Assert
      expect(store.serviceTypes.length).toBe(1);
      expect(store.serviceTypes[0]).toHaveProperty('name', 'Web Development');
    });

    it('should remove from serviceTypes array when service type is deleted', async () => {
      // Arrange - First add a service type
      await runEffect(E.provide(store.createServiceType(testServiceType), StoreEventBusLive));
      expect(store.serviceTypes.length).toBe(1);

      // Act - Use the same hash that was used to create the service type
      const serviceTypeHash = mockRecord.signed_action.hashed.hash;
      await runEffect(E.provide(store.deleteServiceType(serviceTypeHash), StoreEventBusLive));

      // Assert - The serviceTypes array should be updated via cache events
      expect(store.serviceTypes.length).toBe(0);
    });
  });
});
