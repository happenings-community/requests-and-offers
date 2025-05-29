import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E } from 'effect';
import type { ActionHash, Record } from '@holochain/client';
import {
  createServiceTypesStore,
  type ServiceTypesStore
} from '$lib/stores/serviceTypes.store.svelte';
import {
  ServiceTypesServiceTag,
  type ServiceTypesService,
  ServiceTypeError
} from '$lib/services/zomes/serviceTypes.service';
import { StoreEventBusLive } from '$lib/stores/storeEvents';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { createTestServiceType, createMockRecord } from '../unit/test-helpers';
import { runEffect } from '$lib/utils/effect';
import { fakeActionHash } from '@holochain/client';

// Mock the decodeRecords utility
vi.mock('$lib/utils', () => ({
  decodeRecords: vi.fn(async (records: Record[]) => {
    const results = await Promise.all(
      records.map(async () => await createTestServiceType())
    );
    return results;
  })
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

// Create a mock service types service
const createMockServiceTypesService = (
  mockHolochainClient: ReturnType<typeof createMockHolochainClientService>
): ServiceTypesService => ({
  createServiceType: (serviceType: ServiceTypeInDHT) =>
    E.tryPromise({
      try: () =>
        mockHolochainClient.callZome('service_types', 'create_service_type', {
          service_type: serviceType
        }),
      catch: (error: unknown) => ServiceTypeError.fromError(error, 'Failed to create service type')
    }).pipe(E.map((record: unknown) => record as Record)),

  getServiceType: (hash: ActionHash) =>
    E.tryPromise({
      try: () => mockHolochainClient.callZome('service_types', 'get_service_type', hash),
      catch: (error: unknown) => ServiceTypeError.fromError(error, 'Failed to get service type')
    }).pipe(E.map((record: unknown) => record as Record | null)),

  getLatestServiceTypeRecord: (hash: ActionHash) =>
    E.tryPromise({
      try: () =>
        mockHolochainClient.callZome('service_types', 'get_latest_service_type_record', hash),
      catch: (error: unknown) =>
        ServiceTypeError.fromError(error, 'Failed to get latest service type record')
    }).pipe(E.map((record: unknown) => record as Record | null)),

  updateServiceType: (
    originalHash: ActionHash,
    previousHash: ActionHash,
    updatedServiceType: ServiceTypeInDHT
  ) =>
    E.tryPromise({
      try: () =>
        mockHolochainClient.callZome('service_types', 'update_service_type', {
          original_service_type_hash: originalHash,
          previous_service_type_hash: previousHash,
          updated_service_type: updatedServiceType
        }),
      catch: (error: unknown) => ServiceTypeError.fromError(error, 'Failed to update service type')
    }).pipe(E.map((actionHash: unknown) => actionHash as ActionHash)),

  deleteServiceType: (hash: ActionHash) =>
    E.tryPromise({
      try: () => mockHolochainClient.callZome('service_types', 'delete_service_type', hash),
      catch: (error: unknown) => ServiceTypeError.fromError(error, 'Failed to delete service type')
    }).pipe(E.map((actionHash: unknown) => actionHash as ActionHash)),

  getAllServiceTypes: () =>
    E.tryPromise({
      try: () => mockHolochainClient.callZome('service_types', 'get_all_service_types', null),
      catch: (error: unknown) =>
        ServiceTypeError.fromError(error, 'Failed to get all service types')
    }).pipe(E.map((records: unknown) => records as Record[])),

  getRequestsForServiceType: (hash: ActionHash) =>
    E.tryPromise({
      try: () =>
        mockHolochainClient.callZome('service_types', 'get_requests_for_service_type', hash),
      catch: (error: unknown) =>
        ServiceTypeError.fromError(error, 'Failed to get requests for service type')
    }).pipe(E.map((records: unknown) => records as Record[])),

  getOffersForServiceType: (hash: ActionHash) =>
    E.tryPromise({
      try: () => mockHolochainClient.callZome('service_types', 'get_offers_for_service_type', hash),
      catch: (error: unknown) =>
        ServiceTypeError.fromError(error, 'Failed to get offers for service type')
    }).pipe(E.map((records: unknown) => records as Record[])),

  getServiceTypesForEntity: (input: {
    entity_hash: ActionHash;
    entity_type: 'request' | 'offer';
  }) =>
    E.tryPromise({
      try: () =>
        mockHolochainClient.callZome('service_types', 'get_service_types_for_entity', input),
      catch: (error: unknown) =>
        ServiceTypeError.fromError(error, 'Failed to get service types for entity')
    }).pipe(E.map((hashes: unknown) => hashes as ActionHash[])),

  linkToServiceType: (input: {
    entity_hash: ActionHash;
    entity_type: 'request' | 'offer';
    service_type_hash: ActionHash;
  }) =>
    E.tryPromise({
      try: () => mockHolochainClient.callZome('service_types', 'link_to_service_type', input),
      catch: (error: unknown) => ServiceTypeError.fromError(error, 'Failed to link to service type')
    }).pipe(E.map(() => void 0)),

  unlinkFromServiceType: (input: {
    entity_hash: ActionHash;
    entity_type: 'request' | 'offer';
    service_type_hash: ActionHash;
  }) =>
    E.tryPromise({
      try: () => mockHolochainClient.callZome('service_types', 'unlink_from_service_type', input),
      catch: (error: unknown) =>
        ServiceTypeError.fromError(error, 'Failed to unlink from service type')
    }).pipe(E.map(() => void 0)),

  updateServiceTypeLinks: (input: {
    entity_hash: ActionHash;
    entity_type: 'request' | 'offer';
    service_type_hashes: ActionHash[];
  }) =>
    E.tryPromise({
      try: () => mockHolochainClient.callZome('service_types', 'update_service_type_links', input),
      catch: (error: unknown) =>
        ServiceTypeError.fromError(error, 'Failed to update service type links')
    }).pipe(E.map(() => void 0)),

  deleteAllServiceTypeLinksForEntity: (input: {
    entity_hash: ActionHash;
    entity_type: 'request' | 'offer';
  }) =>
    E.tryPromise({
      try: () =>
        mockHolochainClient.callZome(
          'service_types',
          'delete_all_service_type_links_for_entity',
          input
        ),
      catch: (error: unknown) =>
        ServiceTypeError.fromError(error, 'Failed to delete all service type links for entity')
    }).pipe(E.map(() => void 0))
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
    const mockService = createMockServiceTypesService(mockHolochainClient);

    const storeEffect = createServiceTypesStore().pipe(
      E.provideService(ServiceTypesServiceTag, mockService)
    );

    store = await E.runPromise(storeEffect);
  });

  describe('Complete CRUD Workflow', () => {
    it('should handle complete service type lifecycle', async () => {
      // Setup mocks for the complete workflow
      mockHolochainClient.callZome
        .mockResolvedValueOnce(mockRecord) // createServiceType
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

      // 2. Get all service types (should use cache since we just created one)
      const getAllEffect = store.getAllServiceTypes();
      const getAllResult = await runEffect(E.provide(getAllEffect, StoreEventBusLive));

      expect(getAllResult).toEqual(expect.any(Array));
      expect(getAllResult.length).toBe(1);
      // Should not call the service again since cache is populated
      expect(mockHolochainClient.callZome).toHaveBeenCalledTimes(1);

      // 3. Delete the service type
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
      // Loading should remain true after error because the effect fails before the final tap()
      expect(store.loading).toBe(true);
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
      // Loading should remain true after error because the effect fails before the final tap()
      expect(store.loading).toBe(true);
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
        .mockResolvedValueOnce(mockActionHash) // update serviceType2 returns action hash
        .mockResolvedValueOnce(mockRecord2) // get updated serviceType2 record
        .mockResolvedValueOnce(mockActionHash); // delete serviceType3

      // 1. Create multiple service types
      await runEffect(E.provide(store.createServiceType(serviceType1), StoreEventBusLive));
      await runEffect(E.provide(store.createServiceType(serviceType2), StoreEventBusLive));
      await runEffect(E.provide(store.createServiceType(serviceType3), StoreEventBusLive));

      expect(store.serviceTypes.length).toBe(3);

      // 2. Get all service types (uses cache, so no service call needed)

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
      expect(mockHolochainClient.callZome).toHaveBeenCalledTimes(6);
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
