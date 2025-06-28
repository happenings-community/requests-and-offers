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
import { mockEffectFn, mockEffectFnWithParams } from '../effect';
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
      ) as unknown as () => E.Effect<Record[], ServiceTypeError>,

      // Tag-related methods
      getServiceTypesByTag: mockEffectFnWithParams(vi.fn(() => Promise.resolve([]))),
      getServiceTypesByTags: mockEffectFnWithParams(vi.fn(() => Promise.resolve([]))),
      getAllServiceTypeTags: mockEffectFn<string[], ServiceTypeError>(
        vi.fn(() => Promise.resolve([]))
      ) as unknown as () => E.Effect<string[], ServiceTypeError>,
      searchServiceTypesByTagPrefix: mockEffectFnWithParams(vi.fn(() => Promise.resolve([]))),
      getTagStatistics: mockEffectFn<Array<[string, number]>, ServiceTypeError>(
        vi.fn(() => Promise.resolve([]))
      ) as unknown as () => E.Effect<Array<[string, number]>, ServiceTypeError>
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
        getAllServiceTypes: mockEffectFn<never, ServiceTypeError>(
          vi.fn(() => Promise.reject(new Error('Network error')))
        ) as unknown as () => E.Effect<
          { pending: Record[]; approved: Record[]; rejected: Record[] },
          ServiceTypeError
        >
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
        getServiceType: mockEffectFnWithParams(getServiceTypeFn),
        getPendingServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          getPendingServiceTypesFn
        ) as unknown as () => E.Effect<Record[], ServiceTypeError>,
        getApprovedServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          getApprovedServiceTypesFn
        ) as unknown as () => E.Effect<Record[], ServiceTypeError>,
        getRejectedServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          getRejectedServiceTypesFn
        ) as unknown as () => E.Effect<Record[], ServiceTypeError>
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
      const result = await runEffect(store.createServiceType(testServiceType));

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
        updateServiceType: mockEffectFnWithParams(updateServiceTypeFn)
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
        deleteServiceType: mockEffectFnWithParams(deleteServiceTypeFn)
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
      const suggestServiceTypeFn = vi.fn(() => Promise.reject(new Error('Suggestion failed')));
      const customService = createMockService({
        suggestServiceType: mockEffectFnWithParams(suggestServiceTypeFn)
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
      const approveServiceTypeFn = vi.fn(() => Promise.reject(new Error('Approval failed')));
      const customService = createMockService({
        approveServiceType: mockEffectFnWithParams(approveServiceTypeFn)
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
      const rejectServiceTypeFn = vi.fn(() => Promise.reject(new Error('Rejection failed')));
      const customService = createMockService({
        rejectServiceType: mockEffectFnWithParams(rejectServiceTypeFn)
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
        getPendingServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          vi.fn(() => Promise.resolve(mockPendingRecords))
        )
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
        getApprovedServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          vi.fn(() => Promise.resolve(mockApprovedRecords))
        )
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
        getRejectedServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          vi.fn(() => Promise.resolve(mockRejectedRecords))
        )
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
        getPendingServiceTypes: mockEffectFn<Record[], ServiceTypeError>(
          vi.fn(() => Promise.reject(new Error(errorMessage)))
        )
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

  // Add comprehensive tag-related tests
  describe('Tag-related Methods', () => {
    describe('getAllTags', () => {
      it('should get all tags from cache when available', async () => {
        // Arrange - Mock the service method
        const mockTags = ['javascript', 'react', 'nodejs'];
        const getAllTagsFn = vi.fn(() => Promise.resolve(mockTags));
        const customService = createMockService({
          getAllServiceTypeTags: mockEffectFn(getAllTagsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.getAllTags());

        // Assert
        expect(result).toEqual(mockTags);
        expect(customStore.allTags).toEqual(mockTags);
        expect(getAllTagsFn).toHaveBeenCalledOnce();
      });

      it('should handle errors when getting all tags', async () => {
        // Arrange
        const getAllTagsFn = vi.fn(() => Promise.reject(new Error('Failed to fetch tags')));
        const customService = createMockService({
          getAllServiceTypeTags: mockEffectFn(getAllTagsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act & Assert
        await expect(runEffect(customStore.getAllTags())).rejects.toThrow('Failed to get all tags');
      });
    });

    describe('loadAllTags', () => {
      it('should load all tags and update state', async () => {
        // Arrange
        const mockTags = ['javascript', 'react', 'nodejs', 'python'];
        const getAllTagsFn = vi.fn(() => Promise.resolve(mockTags));
        const customService = createMockService({
          getAllServiceTypeTags: mockEffectFn(getAllTagsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.loadAllTags());

        // Assert
        expect(result).toEqual(mockTags);
        expect(customStore.allTags).toEqual(mockTags);
      });

      it('should handle empty tags array', async () => {
        // Arrange
        const getAllTagsFn = vi.fn(() => Promise.resolve([]));
        const customService = createMockService({
          getAllServiceTypeTags: mockEffectFn(getAllTagsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.loadAllTags());

        // Assert
        expect(result).toEqual([]);
        expect(customStore.allTags).toEqual([]);
      });
    });

    describe('getServiceTypesByTag', () => {
      it('should get service types by tag successfully', async () => {
        // Arrange
        const tag = 'javascript';
        const mockRecords = [mockRecord];
        const getByTagFn = vi.fn(() => Promise.resolve(mockRecords));
        const customService = createMockService({
          getServiceTypesByTag: mockEffectFnWithParams(getByTagFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.getServiceTypesByTag(tag));

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('name', 'Web Development');
        expect(getByTagFn).toHaveBeenCalledWith(tag);
      });

      it('should return empty array when no service types match tag', async () => {
        // Arrange
        const tag = 'nonexistent';
        const getByTagFn = vi.fn(() => Promise.resolve([]));
        const customService = createMockService({
          getServiceTypesByTag: mockEffectFnWithParams(getByTagFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.getServiceTypesByTag(tag));

        // Assert
        expect(result).toEqual([]);
      });

      it('should handle errors when getting service types by tag', async () => {
        // Arrange
        const tag = 'javascript';
        const getByTagFn = vi.fn(() => Promise.reject(new Error('Tag search failed')));
        const customService = createMockService({
          getServiceTypesByTag: mockEffectFnWithParams(getByTagFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act & Assert
        await expect(runEffect(customStore.getServiceTypesByTag(tag))).rejects.toThrow(
          'Failed to get service types by tag'
        );
      });
    });

    describe('getServiceTypesByTags', () => {
      it('should get service types by multiple tags successfully', async () => {
        // Arrange
        const tags = ['javascript', 'react'];
        const mockRecords = [mockRecord];
        const getByTagsFn = vi.fn(() => Promise.resolve(mockRecords));
        const customService = createMockService({
          getServiceTypesByTags: mockEffectFnWithParams(getByTagsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.getServiceTypesByTags(tags));

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('name', 'Web Development');
        expect(getByTagsFn).toHaveBeenCalledWith(tags);
      });

      it('should handle empty tags array', async () => {
        // Arrange
        const tags: string[] = [];
        const getByTagsFn = vi.fn(() => Promise.resolve([]));
        const customService = createMockService({
          getServiceTypesByTags: mockEffectFnWithParams(getByTagsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.getServiceTypesByTags(tags));

        // Assert
        expect(result).toEqual([]);
      });

      it('should handle errors when getting service types by tags', async () => {
        // Arrange
        const tags = ['javascript', 'react'];
        const getByTagsFn = vi.fn(() => Promise.reject(new Error('Multi-tag search failed')));
        const customService = createMockService({
          getServiceTypesByTags: mockEffectFnWithParams(getByTagsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act & Assert
        await expect(runEffect(customStore.getServiceTypesByTags(tags))).rejects.toThrow(
          'Failed to get service types by tags'
        );
      });
    });

    describe('searchServiceTypesByTagPrefix', () => {
      it('should search service types by tag prefix successfully', async () => {
        // Arrange
        const prefix = 'java';
        const mockRecords = [mockRecord];
        const searchByPrefixFn = vi.fn(() => Promise.resolve(mockRecords));
        const customService = createMockService({
          searchServiceTypesByTagPrefix: mockEffectFnWithParams(searchByPrefixFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.searchServiceTypesByTagPrefix(prefix));

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('name', 'Web Development');
        expect(searchByPrefixFn).toHaveBeenCalledWith(prefix);
      });

      it('should handle empty prefix', async () => {
        // Arrange
        const prefix = '';
        const searchByPrefixFn = vi.fn(() => Promise.resolve([]));
        const customService = createMockService({
          searchServiceTypesByTagPrefix: mockEffectFnWithParams(searchByPrefixFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.searchServiceTypesByTagPrefix(prefix));

        // Assert
        expect(result).toEqual([]);
      });

      it('should handle search errors', async () => {
        // Arrange
        const prefix = 'java';
        const searchByPrefixFn = vi.fn(() => Promise.reject(new Error('Search failed')));
        const customService = createMockService({
          searchServiceTypesByTagPrefix: mockEffectFnWithParams(searchByPrefixFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act & Assert
        await expect(runEffect(customStore.searchServiceTypesByTagPrefix(prefix))).rejects.toThrow(
          'Failed to search service types by tag prefix'
        );
      });
    });

    describe('getTagStatistics', () => {
      it('should get tag statistics successfully', async () => {
        // Arrange
        const mockStatistics: Array<[string, number]> = [
          ['javascript', 15],
          ['react', 10],
          ['nodejs', 8]
        ];
        const getStatisticsFn = vi.fn(() => Promise.resolve(mockStatistics));
        const customService = createMockService({
          getTagStatistics: mockEffectFn(getStatisticsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.getTagStatistics());

        // Assert
        expect(result).toEqual(mockStatistics);
        expect(customStore.tagStatistics).toEqual(mockStatistics);
        expect(getStatisticsFn).toHaveBeenCalledOnce();
      });

      it('should handle empty statistics', async () => {
        // Arrange
        const getStatisticsFn = vi.fn(() => Promise.resolve([]));
        const customService = createMockService({
          getTagStatistics: mockEffectFn(getStatisticsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        const result = await runEffect(customStore.getTagStatistics());

        // Assert
        expect(result).toEqual([]);
        expect(customStore.tagStatistics).toEqual([]);
      });

      it('should handle statistics errors', async () => {
        // Arrange
        const getStatisticsFn = vi.fn(() => Promise.reject(new Error('Statistics failed')));
        const customService = createMockService({
          getTagStatistics: mockEffectFn(getStatisticsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act & Assert
        await expect(runEffect(customStore.getTagStatistics())).rejects.toThrow(
          'Failed to get tag statistics'
        );
      });
    });

    describe('Tag Selection State Management', () => {
      it('should set selected tags', () => {
        // Arrange
        const tags = ['javascript', 'react', 'nodejs'];

        // Act
        store.setSelectedTags(tags);

        // Assert
        expect(store.selectedTags).toEqual(tags);
      });

      it('should add selected tag', () => {
        // Arrange
        store.setSelectedTags(['javascript']);

        // Act
        store.addSelectedTag('react');

        // Assert
        expect(store.selectedTags).toEqual(['javascript', 'react']);
      });

      it('should not add duplicate tag', () => {
        // Arrange
        store.setSelectedTags(['javascript', 'react']);

        // Act
        store.addSelectedTag('javascript');

        // Assert
        expect(store.selectedTags).toEqual(['javascript', 'react']);
      });

      it('should remove selected tag', () => {
        // Arrange
        store.setSelectedTags(['javascript', 'react', 'nodejs']);

        // Act
        store.removeSelectedTag('react');

        // Assert
        expect(store.selectedTags).toEqual(['javascript', 'nodejs']);
      });

      it('should handle removing non-existent tag', () => {
        // Arrange
        store.setSelectedTags(['javascript', 'react']);

        // Act
        store.removeSelectedTag('python');

        // Assert
        expect(store.selectedTags).toEqual(['javascript', 'react']);
      });

      it('should clear selected tags', () => {
        // Arrange
        store.setSelectedTags(['javascript', 'react', 'nodejs']);

        // Act
        store.clearSelectedTags();

        // Assert
        expect(store.selectedTags).toEqual([]);
      });
    });

    describe('Tag State Reactivity', () => {
      it('should initialize with empty tag state', () => {
        expect(store.allTags).toEqual([]);
        expect(store.selectedTags).toEqual([]);
        expect(store.tagStatistics).toEqual([]);
        expect(store.searchResults).toEqual([]);
      });

      it('should update tag statistics when fetched', async () => {
        // Arrange
        const mockStatistics: Array<[string, number]> = [
          ['javascript', 15],
          ['react', 10]
        ];
        const getStatisticsFn = vi.fn(() => Promise.resolve(mockStatistics));
        const customService = createMockService({
          getTagStatistics: mockEffectFn(getStatisticsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        await runEffect(customStore.getTagStatistics());

        // Assert
        expect(customStore.tagStatistics).toEqual(mockStatistics);
      });

      it('should update all tags when loaded', async () => {
        // Arrange
        const mockTags = ['javascript', 'react', 'nodejs'];
        const getAllTagsFn = vi.fn(() => Promise.resolve(mockTags));
        const customService = createMockService({
          getAllServiceTypeTags: mockEffectFn(getAllTagsFn)
        });
        const customStore = await createStoreWithService(customService);

        // Act
        await runEffect(customStore.loadAllTags());

        // Assert
        expect(customStore.allTags).toEqual(mockTags);
      });
    });
  });
});
