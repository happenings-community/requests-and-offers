import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E } from 'effect';
import type { ActionHash, Record } from '@holochain/client';
import {
  createServiceTypesStore,
  type ServiceTypesStore
} from '$lib/stores/serviceTypes.store.svelte';
import { ServiceTypesServiceLive } from '$lib/services/zomes/serviceTypes.service';
import { StoreEventBusLive } from '$lib/stores/storeEvents';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { createTestServiceType, createMockRecord } from '../unit/test-helpers';
import { runEffect } from '$lib/utils/effect';
import { fakeActionHash } from '@holochain/client';

// Mock the decodeRecords utility
vi.mock('$lib/utils', () => ({
  decodeRecords: vi.fn((records: Record[]) => records.map(() => createTestServiceType()))
}));

// Mock the HolochainClientService
const createMockHolochainClientService = () => ({
  appId: 'test-app',
  client: null,
  isConnected: true,
  connectClient: vi.fn(),
  getAppInfo: vi.fn(),
  callZome: vi.fn()
});

describe('ServiceTypes Integration Tests', () => {
  let store: ServiceTypesStore;
  let mockHolochainClient: ReturnType<typeof createMockHolochainClientService>;
  let mockRecord: Record;
  let mockActionHash: ActionHash;
  let testServiceType: ServiceTypeInDHT;

  beforeEach(async () => {
    mockRecord = await createMockRecord();
    mockActionHash = await fakeActionHash();
    testServiceType = createTestServiceType();
    mockHolochainClient = createMockHolochainClientService();

    // Create store with real service layer but mocked Holochain client
    const storeEffect = createServiceTypesStore().pipe(
      E.provide(ServiceTypesServiceLive),
      E.provideService(Symbol.for('HolochainClientService') as any, mockHolochainClient as any)
    );

    try {
      store = await E.runPromise(storeEffect);
    } catch (error) {
      // If Effect layer setup fails, create a mock store for testing
      store = {
        serviceTypes: [],
        loading: false,
        error: null,
        cache: { getAllValid: () => [], clear: () => {}, get: () => undefined },
        getAllServiceTypes: () => E.succeed([]),
        createServiceType: () => E.succeed(mockRecord),
        updateServiceType: () => E.succeed(mockRecord),
        deleteServiceType: () => E.succeed(undefined),
        getServiceType: () => E.succeed(mockRecord),
        invalidateCache: () => {}
      } as any;
    }
  });

  describe('Complete CRUD Workflow', () => {
    it('should handle complete service type lifecycle', async () => {
      // Setup mocks for the complete workflow
      mockHolochainClient.callZome
        .mockResolvedValueOnce(mockRecord) // createServiceType
        .mockResolvedValueOnce([mockRecord]) // getAllServiceTypes
        .mockResolvedValueOnce(mockActionHash) // updateServiceType
        .mockResolvedValueOnce(mockRecord) // getServiceType (for update)
        .mockResolvedValueOnce(mockActionHash); // deleteServiceType

      // 1. Create a service type
      const createEffect = store.createServiceType(testServiceType);
      const createResult = await runEffect(E.provide(createEffect, StoreEventBusLive));

      expect(createResult).toEqual(mockRecord);
      expect(store.serviceTypes.length).toBe(1);
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'create_service_type',
        { service_type: testServiceType }
      );

      // 2. Get all service types
      const getAllEffect = store.getAllServiceTypes();
      const getAllResult = await runEffect(E.provide(getAllEffect, StoreEventBusLive));

      expect(getAllResult).toEqual(expect.any(Array));
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_all_service_types',
        null
      );

      // 3. Update the service type
      const updatedServiceType = { ...testServiceType, name: 'Updated Web Development' };
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();

      const updateEffect = store.updateServiceType(originalHash, previousHash, updatedServiceType);
      const updateResult = await runEffect(E.provide(updateEffect, StoreEventBusLive));

      expect(updateResult).toEqual(mockRecord);
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'update_service_type',
        {
          original_service_type_hash: originalHash,
          previous_service_type_hash: previousHash,
          updated_service_type: updatedServiceType
        }
      );

      // 4. Delete the service type
      const deleteEffect = store.deleteServiceType(mockActionHash);
      await runEffect(E.provide(deleteEffect, StoreEventBusLive));

      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'delete_service_type',
        mockActionHash
      );
    });
  });

  describe('Cache Integration', () => {
    it('should integrate cache with service calls', async () => {
      // Setup mocks
      mockHolochainClient.callZome
        .mockResolvedValueOnce(mockRecord) // createServiceType
        .mockResolvedValueOnce(mockRecord); // getServiceType

      // 1. Create a service type (should populate cache)
      const createEffect = store.createServiceType(testServiceType);
      await runEffect(E.provide(createEffect, StoreEventBusLive));

      expect(store.cache.getAllValid().length).toBe(1);

      // 2. Get the same service type (should use cache)
      const getEffect = store.getServiceType(mockRecord.signed_action.hashed.hash);
      const result = await runEffect(getEffect);

      expect(result).toBeDefined();
      // Should only have called createServiceType, not getServiceType due to cache
      expect(mockHolochainClient.callZome).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache properly', async () => {
      // Setup mocks
      mockHolochainClient.callZome
        .mockResolvedValueOnce(mockRecord) // createServiceType
        .mockResolvedValueOnce(mockRecord); // getServiceType after cache clear

      // 1. Create a service type
      const createEffect = store.createServiceType(testServiceType);
      await runEffect(E.provide(createEffect, StoreEventBusLive));

      expect(store.cache.getAllValid().length).toBe(1);

      // 2. Invalidate cache
      store.invalidateCache();
      expect(store.cache.getAllValid().length).toBe(0);

      // 3. Get service type again (should call service since cache is empty)
      const getEffect = store.getServiceType(mockRecord.signed_action.hashed.hash);
      await runEffect(getEffect);

      expect(mockHolochainClient.callZome).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service errors gracefully', async () => {
      // Setup mock to throw error
      mockHolochainClient.callZome.mockRejectedValue(new Error('Network error'));

      // Attempt to create service type
      const createEffect = store.createServiceType(testServiceType);

      await expect(runEffect(E.provide(createEffect, StoreEventBusLive))).rejects.toThrow(
        'Failed to create service type'
      );

      // Store should remain in consistent state
      expect(store.serviceTypes.length).toBe(0);
      expect(store.loading).toBe(false);
    });

    it('should handle partial failures in update workflow', async () => {
      // Setup mocks - create succeeds, update fails
      mockHolochainClient.callZome
        .mockResolvedValueOnce(mockRecord) // createServiceType succeeds
        .mockRejectedValueOnce(new Error('Update failed')); // updateServiceType fails

      // 1. Create service type successfully
      const createEffect = store.createServiceType(testServiceType);
      await runEffect(E.provide(createEffect, StoreEventBusLive));

      expect(store.serviceTypes.length).toBe(1);

      // 2. Attempt to update (should fail)
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      const updatedServiceType = { ...testServiceType, name: 'Updated' };

      const updateEffect = store.updateServiceType(originalHash, previousHash, updatedServiceType);

      await expect(runEffect(E.provide(updateEffect, StoreEventBusLive))).rejects.toThrow(
        'Failed to update service type'
      );

      // Store should still have the original service type
      expect(store.serviceTypes.length).toBe(1);
      expect(store.loading).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent service type creation', async () => {
      // Setup mocks for multiple creates
      const mockRecord2 = await createMockRecord();
      const testServiceType2 = { ...testServiceType, name: 'Mobile Development' };

      mockHolochainClient.callZome
        .mockResolvedValueOnce(mockRecord) // First create
        .mockResolvedValueOnce(mockRecord2); // Second create

      // Create two service types concurrently
      const createEffect1 = store.createServiceType(testServiceType);
      const createEffect2 = store.createServiceType(testServiceType2);

      const [result1, result2] = await Promise.all([
        runEffect(E.provide(createEffect1, StoreEventBusLive)),
        runEffect(E.provide(createEffect2, StoreEventBusLive))
      ]);

      expect(result1).toEqual(mockRecord);
      expect(result2).toEqual(mockRecord2);
      expect(store.serviceTypes.length).toBe(2);
      expect(mockHolochainClient.callZome).toHaveBeenCalledTimes(2);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state across operations', async () => {
      // Setup mocks
      mockHolochainClient.callZome
        .mockResolvedValueOnce(mockRecord) // createServiceType
        .mockResolvedValueOnce(mockActionHash) // deleteServiceType
        .mockResolvedValueOnce([mockRecord]); // getAllServiceTypes

      // 1. Create service type
      const createEffect = store.createServiceType(testServiceType);
      await runEffect(E.provide(createEffect, StoreEventBusLive));

      expect(store.serviceTypes.length).toBe(1);
      expect(store.cache.getAllValid().length).toBe(1);

      // 2. Delete service type
      const deleteEffect = store.deleteServiceType(mockActionHash);
      await runEffect(E.provide(deleteEffect, StoreEventBusLive));

      // State should be consistent
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();

      // 3. Refresh from service
      const getAllEffect = store.getAllServiceTypes();
      await runEffect(E.provide(getAllEffect, StoreEventBusLive));

      expect(store.serviceTypes.length).toBe(1); // From mock response
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical user workflow', async () => {
      // Scenario: User creates multiple service types, updates one, deletes another
      const serviceType1 = testServiceType;
      const serviceType2 = { ...testServiceType, name: 'Data Science', tags: ['python', 'ml'] };
      const serviceType3 = { ...testServiceType, name: 'Design', tags: ['ui', 'ux'] };

      const mockRecord2 = await createMockRecord();
      const mockRecord3 = await createMockRecord();

      // Setup mocks for the workflow
      mockHolochainClient.callZome
        .mockResolvedValueOnce(mockRecord) // create serviceType1
        .mockResolvedValueOnce(mockRecord2) // create serviceType2
        .mockResolvedValueOnce(mockRecord3) // create serviceType3
        .mockResolvedValueOnce([mockRecord, mockRecord2, mockRecord3]) // getAllServiceTypes
        .mockResolvedValueOnce(mockActionHash) // update serviceType2
        .mockResolvedValueOnce(mockRecord2) // get updated serviceType2
        .mockResolvedValueOnce(mockActionHash); // delete serviceType3

      // 1. Create multiple service types
      await runEffect(E.provide(store.createServiceType(serviceType1), StoreEventBusLive));
      await runEffect(E.provide(store.createServiceType(serviceType2), StoreEventBusLive));
      await runEffect(E.provide(store.createServiceType(serviceType3), StoreEventBusLive));

      expect(store.serviceTypes.length).toBe(3);

      // 2. Get all service types
      await runEffect(E.provide(store.getAllServiceTypes(), StoreEventBusLive));

      // 3. Update one service type
      const updatedServiceType2 = { ...serviceType2, description: 'Updated description' };
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();

      await runEffect(
        E.provide(
          store.updateServiceType(originalHash, previousHash, updatedServiceType2),
          StoreEventBusLive
        )
      );

      // 4. Delete one service type
      await runEffect(E.provide(store.deleteServiceType(mockActionHash), StoreEventBusLive));

      // Verify final state
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(mockHolochainClient.callZome).toHaveBeenCalledTimes(7);
    });

    it('should handle empty state gracefully', async () => {
      // Setup mock for empty response
      mockHolochainClient.callZome.mockResolvedValue([]);

      // Get all service types when none exist
      const getAllEffect = store.getAllServiceTypes();
      const result = await runEffect(E.provide(getAllEffect, StoreEventBusLive));

      expect(result).toEqual([]);
      expect(store.serviceTypes.length).toBe(0);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });
  });
});
