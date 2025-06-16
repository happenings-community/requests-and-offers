import type { ActionHash } from '@holochain/client';
import { Effect as E, Layer } from 'effect';
import type { Record } from '@holochain/client';
import type {
  ServiceTypesService,
  GetServiceTypeForEntityInput,
  ServiceTypeLinkInput,
  UpdateServiceTypeLinksInput
} from '$lib/services/zomes/serviceTypes.service';
import { ServiceTypesServiceTag, ServiceTypeError } from '$lib/services/zomes/serviceTypes.service';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { createMockRecord, createActionHash } from '../unit/test-helpers';

/**
 * Mock implementation of the ServiceTypesService for testing
 */
export const createMockServiceTypesServiceLayer = (): Layer.Layer<ServiceTypesServiceTag> => {
  // Mock data for service types
  const mockServiceTypes: Map<string, Record | null> = new Map();

  // Mock links between entities and service types
  const entityServiceTypeLinks: Map<string, ActionHash[]> = new Map();

  // Helper to get entity key
  const getEntityKey = (
    entityHash: ActionHash,
    entityType: 'request' | 'offer' | 'user'
  ): string => {
    return `${entityType}:${entityHash.toString()}`;
  };

  // Create mock service
  const mockService: ServiceTypesService = {
    createServiceType: (serviceType: ServiceTypeInDHT) =>
      E.gen(function* () {
        const hash = yield* E.promise(createActionHash);
        const record = yield* E.promise(() => createMockRecord(serviceType));
        mockServiceTypes.set(hash.toString(), record);
        return record;
      }),

    getServiceType: (serviceTypeHash: ActionHash) => {
      const record = mockServiceTypes.get(serviceTypeHash.toString());
      return E.succeed(record || null);
    },

    getLatestServiceTypeRecord: (originalActionHash: ActionHash) => {
      const record = mockServiceTypes.get(originalActionHash.toString());
      return E.succeed(record || null);
    },

    updateServiceType: (
      originalServiceTypeHash: ActionHash,
      previousServiceTypeHash: ActionHash,
      updatedServiceType: ServiceTypeInDHT
    ) =>
      E.gen(function* () {
        const newHash = yield* E.promise(createActionHash);
        const record = yield* E.promise(() => createMockRecord(updatedServiceType));
        mockServiceTypes.set(originalServiceTypeHash.toString(), record);
        return newHash;
      }),

    deleteServiceType: (serviceTypeHash: ActionHash) => {
      mockServiceTypes.delete(serviceTypeHash.toString());
      return E.succeed(serviceTypeHash);
    },

    getAllServiceTypes: () => {
      const records = Array.from(mockServiceTypes.values()).filter((r): r is Record => r !== null);
      return E.succeed({ pending: [], approved: records, rejected: [] });
    },

    getRequestsForServiceType: (
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      _serviceTypeHash: ActionHash
    ) => {
      // In a real implementation, this would return requests linked to this service type
      return E.succeed([]);
    },

    getOffersForServiceType: (
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      _serviceTypeHash: ActionHash
    ) => {
      // In a real implementation, this would return offers linked to this service type
      return E.succeed([]);
    },

    getUsersForServiceType: () => E.succeed([]),

    getServiceTypesForEntity: (input: GetServiceTypeForEntityInput) => {
      const key = getEntityKey(input.original_action_hash, input.entity);
      const hashes = entityServiceTypeLinks.get(key) || [];
      return E.succeed(hashes);
    },

    linkToServiceType: (input: ServiceTypeLinkInput) => {
      const key = getEntityKey(input.action_hash, input.entity);
      const existingLinks = entityServiceTypeLinks.get(key) || [];

      // Only add if not already linked
      if (!existingLinks.some((hash) => hash.toString() === input.service_type_hash.toString())) {
        existingLinks.push(input.service_type_hash);
        entityServiceTypeLinks.set(key, existingLinks);
      }

      return E.succeed(undefined);
    },

    unlinkFromServiceType: (input: ServiceTypeLinkInput) => {
      const key = getEntityKey(input.action_hash, input.entity);
      const existingLinks = entityServiceTypeLinks.get(key) || [];

      const updatedLinks = existingLinks.filter(
        (hash) => hash.toString() !== input.service_type_hash.toString()
      );

      entityServiceTypeLinks.set(key, updatedLinks);
      return E.succeed(undefined);
    },

    updateServiceTypeLinks: (input: UpdateServiceTypeLinksInput) => {
      const key = getEntityKey(input.action_hash, input.entity);
      entityServiceTypeLinks.set(key, [...input.new_service_type_hashes]);
      return E.succeed(undefined);
    },

    deleteAllServiceTypeLinksForEntity: (input: GetServiceTypeForEntityInput) => {
      const key = getEntityKey(input.original_action_hash, input.entity);
      entityServiceTypeLinks.delete(key);
      return E.succeed(undefined);
    },

    // Status management methods
    suggestServiceType: (serviceType: ServiceTypeInDHT) =>
      E.tryPromise({
        try: () =>
          createMockRecord(serviceType).then((record) => {
            const hash = record.signed_action.hashed.hash;
            mockServiceTypes.set(hash.toString(), record);
            return record;
          }),
        catch: () => ServiceTypeError.fromError('Mock error', 'Failed to suggest service type')
      }),

    approveServiceType: () => E.succeed(new Uint8Array()),

    rejectServiceType: () => E.succeed(new Uint8Array()),

    getPendingServiceTypes: () => E.succeed([]),

    getApprovedServiceTypes: () => {
      const records = Array.from(mockServiceTypes.values()).filter((r): r is Record => r !== null);
      return E.succeed(records);
    },

    getRejectedServiceTypes: () => E.succeed([]),

    // Tag-related methods
    getServiceTypesByTag: (tag: string) => E.succeed([] as Record[]),

    getServiceTypesByTags: (tags: string[]) => E.succeed([] as Record[]),

    getAllServiceTypeTags: () => E.succeed([] as string[]),

    searchServiceTypesByTagPrefix: (prefix: string) => E.succeed([] as Record[]),

    getTagStatistics: () => E.succeed([] as Array<[string, number]>)
  };

  return Layer.succeed(ServiceTypesServiceTag, mockService);
};

/**
 * Helper to get the mock ServiceTypesService from a layer for testing
 */
export const getMockServiceTypesService = async (): Promise<ServiceTypesService> => {
  const layer = createMockServiceTypesServiceLayer();
  return await E.runPromise(E.provide(ServiceTypesServiceTag, layer));
};
