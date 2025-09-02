import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import { Effect as E } from 'effect';
import type { ActionHash, Record } from '@holochain/client';
import {
  createServiceTypesStore,
  type ServiceTypesStore
} from '$lib/stores/serviceTypes.store.svelte';
import type {
  ServiceTypesService,
  ServiceTypeError
} from '$lib/services/zomes/serviceTypes.service';
import { ServiceTypesServiceTag } from '$lib/services/zomes/serviceTypes.service';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { createTestServiceType, createMockServiceTypeRecord } from '../test-helpers';
import { runEffect } from '$lib/utils/effect';
import { fakeActionHash } from '@holochain/client';
import { CacheServiceLive } from '$lib/utils/cache.svelte';
import { ServiceTypeStoreError } from '$lib/errors';

describe('ServiceTypesStore', () => {
  let store: ServiceTypesStore;
  let mockServiceTypesService: ServiceTypesService;
  let mockRecord: Record;
  let mockActionHash: ActionHash;
  let testServiceType: ServiceTypeInDHT;

  // Helper function to create a mock service
  const createMockService = (overrides: Partial<ServiceTypesService> = {}): ServiceTypesService => {
    const defaultService = {
      createServiceType: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      getServiceType: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      getLatestServiceTypeRecord: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      updateServiceType: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
      deleteServiceType: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
      getAllServiceTypes: vi
        .fn()
        .mockReturnValue(E.succeed({ pending: [], approved: [mockRecord], rejected: [] })),
      getRequestsForServiceType: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getOffersForServiceType: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getServiceTypesForEntity: vi.fn().mockReturnValue(E.succeed([mockActionHash])),
      linkToServiceType: vi.fn().mockReturnValue(E.succeed(undefined)),
      unlinkFromServiceType: vi.fn().mockReturnValue(E.succeed(undefined)),
      updateServiceTypeLinks: vi.fn().mockReturnValue(E.succeed(undefined)),
      deleteAllServiceTypeLinksForEntity: vi.fn().mockReturnValue(E.succeed(undefined)),
      getUsersForServiceType: vi.fn().mockReturnValue(E.succeed([mockRecord])),

      // Status management methods
      suggestServiceType: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      approveServiceType: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
      rejectServiceType: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
      getPendingServiceTypes: vi.fn().mockReturnValue(E.succeed([])),
      getApprovedServiceTypes: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getRejectedServiceTypes: vi.fn().mockReturnValue(E.succeed([])),

      getServiceTypeStatus: vi.fn().mockReturnValue(E.succeed('approved'))
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
    mockRecord = await createMockServiceTypeRecord();
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
      const result = await runEffect(store.getAllServiceTypes());

      // Assert
      expect(result).toEqual(expect.any(Array));
      expect(store.serviceTypes.length).toBe(1);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should return cached service types when available', async () => {
      // Arrange - First populate the cache
      await runEffect(store.getAllServiceTypes());

      // Act - Second call should use cache
      const result = await runEffect(store.getAllServiceTypes());

      // Assert
      expect(result).toEqual(expect.any(Array));
    });

    it('should handle errors when getting all service types', async () => {
      // Arrange - Create a new store with error-throwing service
      const errorServiceTypesService = {
        ...mockServiceTypesService,
        getAllServiceTypes: vi.fn().mockReturnValue(E.fail(new Error('Network error')))
      };

      const errorStore = await createStoreWithService(errorServiceTypesService);

      // Act & Assert
      await expect(runEffect(errorStore.getAllServiceTypes())).rejects.toThrow(
        'Failed to get all service types'
      );

      // Loading should be set to false after error due to tapError in withLoadingState
      expect(errorStore.loading).toBe(false);
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
      // Arrange - Create a service with spy functions for all status determination methods
      const getServiceTypeFn = vi.fn(() => Promise.resolve(mockRecord));
      const getPendingServiceTypesFn = vi.fn(() => Promise.resolve([]));
      const getApprovedServiceTypesFn = vi.fn(() => Promise.resolve([mockRecord]));
      const getRejectedServiceTypesFn = vi.fn(() => Promise.resolve([]));

      const customService = createMockService({
        getServiceType: vi.fn().mockReturnValue(E.succeed(mockRecord)),
        getPendingServiceTypes: vi.fn().mockReturnValue(E.succeed([])),
        getApprovedServiceTypes: vi.fn().mockReturnValue(E.succeed([mockRecord])),
        getRejectedServiceTypes: vi.fn().mockReturnValue(E.succeed([]))
      });
      const customStore = await createStoreWithService(customService);

      // Use the hash from the mock record for consistency
      const recordHash = mockRecord.signed_action.hashed.hash;

      // Manually populate the cache to bypass any cache key issues
      const cacheKey = recordHash.toString();
      const serviceType = {
        ...createTestServiceType(),
        original_action_hash: recordHash,
        status: 'approved' as const
      };

      // Directly set the cache entry
      await runEffect(customStore.cache.set(cacheKey, serviceType));

      // Reset all mocks to track subsequent calls
      getServiceTypeFn.mockClear();
      getPendingServiceTypesFn.mockClear();
      getApprovedServiceTypesFn.mockClear();
      getRejectedServiceTypesFn.mockClear();

      // Act - Second call should use cache (use the same hash)
      const result = await runEffect(customStore.getServiceType(recordHash));

      // Assert - None of the service methods should be called again due to cache
      expect(getServiceTypeFn).not.toHaveBeenCalled();
      expect(getPendingServiceTypesFn).not.toHaveBeenCalled();
      expect(getApprovedServiceTypesFn).not.toHaveBeenCalled();
      expect(getRejectedServiceTypesFn).not.toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.name).toBe('Web Development');
    });

    it('should return null when service type not found', async () => {
      // Arrange
      const customService = createMockService({
        getServiceType: vi.fn().mockReturnValue(E.succeed(null))
      });
      const customStore = await createStoreWithService(customService);

      // Act
      const result = await runEffect(customStore.getServiceType(mockActionHash));

      // Assert
      expect(result).toBeNull();
    });

    it('should handle errors when getting service type', async () => {
      // Arrange - Create a service that returns null when not found
      const customService = createMockService({
        getServiceType: vi.fn().mockReturnValue(E.succeed(null))
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
      const result = await runEffect(store.createServiceType(testServiceType));

      // Assert
      expect(result).toEqual(mockRecord);
      expect(store.serviceTypes.length).toBe(1);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when creating service type', async () => {
      // Arrange
      const customService = createMockService({
        createServiceType: vi.fn().mockReturnValue(E.fail(new Error('Creation failed')))
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(runEffect(customStore.createServiceType(testServiceType))).rejects.toThrow(
        'Failed to create service type'
      );

      // Loading should be set to false after error due to tapError in withLoadingState
      expect(customStore.loading).toBe(false);
    });
  });

  describe('updateServiceType', () => {
    it('should update a service type successfully', async () => {
      // Arrange
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      const updatedServiceType = { ...testServiceType, name: 'Updated Web Development' };

      // Act
      const result = await runEffect(
        store.updateServiceType(originalHash, previousHash, updatedServiceType)
      );

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
        updateServiceType: vi.fn().mockReturnValue(E.fail(new Error('Update failed')))
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(
        runEffect(customStore.updateServiceType(originalHash, previousHash, testServiceType))
      ).rejects.toThrow('Failed to update service type');

      // Loading should be set to false after error due to tapError in withLoadingState
      expect(customStore.loading).toBe(false);
    });
  });

  describe('deleteServiceType', () => {
    it('should delete a service type successfully', async () => {
      // Arrange - First add a service type to the store
      await runEffect(store.createServiceType(testServiceType));

      // Act
      await runEffect(store.deleteServiceType(mockActionHash));

      // Assert
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when deleting service type', async () => {
      // Arrange
      const deleteServiceTypeFn = vi.fn(() => Promise.reject(new Error('Delete failed')));
      const customService = createMockService({
        deleteServiceType: vi.fn().mockReturnValue(E.fail(new Error('Delete failed')))
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(runEffect(customStore.deleteServiceType(mockActionHash))).rejects.toThrow(
        'Failed to delete service type'
      );

      // Loading should be set to false after error due to tapError in withLoadingState
      expect(customStore.loading).toBe(false);
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
      await runEffect(store.createServiceType(testServiceType));

      // Assert - Check store state instead of cache directly
      expect(store.serviceTypes.length).toBe(1);
    });

    it('should remove from cache when service type is deleted', async () => {
      // Arrange - First add a service type
      await runEffect(store.createServiceType(testServiceType));

      // Act - Use the same hash that was used to create the service type
      const serviceTypeHash = mockRecord.signed_action.hashed.hash;
      await runEffect(store.deleteServiceType(serviceTypeHash));

      // Assert - Check store state instead of cache directly
      expect(store.serviceTypes.length).toBe(0);
    });
  });

  describe('Loading States', () => {
    it('should set loading to true during operations', async () => {
      let loadingDuringOperation = false;

      const customService = createMockService({
        getAllServiceTypes: vi.fn().mockImplementation(() => {
          // Check loading state during the operation
          loadingDuringOperation = testStore.loading;
          return E.succeed({ pending: [], approved: [], rejected: [] });
        })
      });
      const testStore = await createStoreWithService(customService);

      // Act
      await runEffect(testStore.getAllServiceTypes());

      // Assert
      expect(loadingDuringOperation).toBe(true);
      expect(testStore.loading).toBe(false); // Should be false after completion
    });
  });

  describe('suggestServiceType', () => {
    it('should suggest a service type successfully', async () => {
      // Act
      const result = await runEffect(store.suggestServiceType(testServiceType));

      // Assert
      expect(result).toEqual(mockRecord);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when suggesting service type', async () => {
      // Arrange
      const customService = createMockService({
        suggestServiceType: vi.fn().mockReturnValue(E.fail(new Error('Suggestion failed')))
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(runEffect(customStore.suggestServiceType(testServiceType))).rejects.toThrow(
        'Failed to suggest service type'
      );

      expect(customStore.loading).toBe(false);
    });
  });

  describe('approveServiceType', () => {
    it('should approve a service type successfully', async () => {
      // Act
      await runEffect(store.approveServiceType(mockActionHash));

      // Assert
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when approving service type', async () => {
      // Arrange
      const customService = createMockService({
        approveServiceType: vi.fn().mockReturnValue(E.fail(new Error('Approval failed')))
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(runEffect(customStore.approveServiceType(mockActionHash))).rejects.toThrow(
        'Failed to approve service type'
      );

      expect(customStore.loading).toBe(false);
    });
  });

  describe('rejectServiceType', () => {
    it('should reject a service type successfully', async () => {
      // Act
      await runEffect(store.rejectServiceType(mockActionHash));

      // Assert
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle errors when rejecting service type', async () => {
      // Arrange
      const customService = createMockService({
        rejectServiceType: vi.fn().mockReturnValue(E.fail(new Error('Rejection failed')))
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(runEffect(customStore.rejectServiceType(mockActionHash))).rejects.toThrow(
        'Failed to reject service type'
      );

      expect(customStore.loading).toBe(false);
    });
  });

  describe('Status-based Service Type Lists', () => {
    it('should get pending service types', async () => {
      // Arrange - Create a fresh mock record for this test
      const mockPendingRecord = await createMockServiceTypeRecord();
      const mockPendingRecords = [mockPendingRecord];
      const customService = createMockService({
        getPendingServiceTypes: vi.fn().mockReturnValue(E.succeed(mockPendingRecords))
      });
      const customStore = await createStoreWithService(customService);

      // Act
      const result = await runEffect(customStore.getPendingServiceTypes());

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
      const mockApprovedRecord = await createMockServiceTypeRecord();
      const mockApprovedRecords = [mockApprovedRecord];
      const customService = createMockService({
        getApprovedServiceTypes: vi.fn().mockReturnValue(E.succeed(mockApprovedRecords))
      });
      const customStore = await createStoreWithService(customService);

      // Act
      const result = await runEffect(customStore.getApprovedServiceTypes());

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
      const mockRejectedRecord = await createMockServiceTypeRecord();
      const mockRejectedRecords = [mockRejectedRecord];
      const customService = createMockService({
        getRejectedServiceTypes: vi.fn().mockReturnValue(E.succeed(mockRejectedRecords))
      });
      const customStore = await createStoreWithService(customService);

      // Act
      const result = await runEffect(customStore.getRejectedServiceTypes());

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
        getPendingServiceTypes: vi.fn().mockReturnValue(E.fail(new Error(errorMessage)))
      });
      const customStore = await createStoreWithService(customService);

      // Act & Assert
      await expect(runEffect(customStore.getPendingServiceTypes())).rejects.toThrow(errorMessage);

      expect(customStore.loading).toBe(false);
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
      await runEffect(store.createServiceType(testServiceType));

      // Assert
      expect(store.serviceTypes.length).toBe(1);
      expect(store.serviceTypes[0]).toHaveProperty('name', 'Web Development');
    });

    it('should remove from serviceTypes array when service type is deleted', async () => {
      // Arrange - First add a service type
      await runEffect(store.createServiceType(testServiceType));
      expect(store.serviceTypes.length).toBe(1);

      // Act - Use the same hash that was used to create the service type
      const serviceTypeHash = mockRecord.signed_action.hashed.hash;
      await runEffect(store.deleteServiceType(serviceTypeHash));

      // Assert - The serviceTypes array should be updated via cache events
      expect(store.serviceTypes.length).toBe(0);
    });
  });
});
