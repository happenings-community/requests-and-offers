import type { ActionHash } from '@holochain/client';
import { Effect as E, Layer, Schema } from 'effect';
import type { Record } from '@holochain/client';
import type { ServiceTypesService } from '$lib/services/zomes/serviceTypes.service';
import { ServiceTypesServiceTag, ServiceTypeError } from '$lib/services/zomes/serviceTypes.service';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import {
  type ServiceTypeLinkInput,
  type UpdateServiceTypeLinksInput,
  type GetServiceTypeForEntityInput
} from '$lib/schemas/service-types.schemas';
import { ActionHashSchema } from '$lib/schemas/holochain.schemas';
import {
  createMockRecord,
  createActionHash,
  createMockServiceTypeRecord
} from '../unit/test-helpers';

/**
 * Helper to convert ActionHash (Uint8Array) to string for key storage
 */
const actionHashToKey = (hash: ActionHash): string => {
  return Buffer.from(hash).toString('base64');
};

/**
 * Helper to convert string key back to ActionHash (Uint8Array)
 */
const keyToActionHash = (key: string): ActionHash => {
  return new Uint8Array(Buffer.from(key, 'base64')) as ActionHash;
};

/**
 * Convert branded string ActionHash back to HoloHash (Uint8Array)
 */
function stringToActionHash(hashString: Schema.Schema.Type<typeof ActionHashSchema>): ActionHash {
  // Convert base64 string back to Uint8Array
  return new Uint8Array(Buffer.from(hashString as unknown as string, 'base64'));
}

/**
 * Convert HoloHash (Uint8Array) to branded string ActionHash for schema compatibility
 */
function actionHashToString(hash: ActionHash): Schema.Schema.Type<typeof ActionHashSchema> {
  // Convert Uint8Array to base64 string and return as branded string
  return Buffer.from(hash).toString('base64') as unknown as Schema.Schema.Type<
    typeof ActionHashSchema
  >;
}

/**
 * Mock implementation of the ServiceTypesService for testing
 */
export const createMockServiceTypesServiceLayer = (): Layer.Layer<ServiceTypesServiceTag> => {
  // Mock data for service types
  const mockServiceTypes: Map<string, Record | null> = new Map();

  // Mock links between entities and service types (using string keys)
  const entityServiceTypeLinks: Map<string, string[]> = new Map();

  // Helper to get entity key
  const getEntityKey = (
    entityHash: ActionHash,
    entityType: 'request' | 'offer' | 'user'
  ): string => {
    return `${entityType}:${actionHashToKey(entityHash)}`;
  };

  // Create mock service
  const mockService: ServiceTypesService = {
    createServiceType: (serviceType: ServiceTypeInDHT) =>
      E.gen(function* () {
        const hash = yield* E.promise(createActionHash);
        const record = yield* E.promise(() => createMockServiceTypeRecord(serviceType));
        mockServiceTypes.set(actionHashToKey(hash), record);
        return record;
      }),

    getServiceType: (serviceTypeHash: ActionHash) => {
      const record = mockServiceTypes.get(actionHashToKey(serviceTypeHash));
      return E.succeed(record || null);
    },

    getLatestServiceTypeRecord: (originalActionHash: ActionHash) => {
      const record = mockServiceTypes.get(actionHashToKey(originalActionHash));
      return E.succeed(record || null);
    },

    updateServiceType: (
      originalServiceTypeHash: ActionHash,
      previousServiceTypeHash: ActionHash,
      updatedServiceType: ServiceTypeInDHT
    ) =>
      E.gen(function* () {
        const newHash = yield* E.promise(createActionHash);
        const record = yield* E.promise(() => createMockServiceTypeRecord(updatedServiceType));
        mockServiceTypes.set(actionHashToKey(originalServiceTypeHash), record);
        return newHash;
      }),

    deleteServiceType: (serviceTypeHash: ActionHash) => {
      mockServiceTypes.delete(actionHashToKey(serviceTypeHash));
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
      const entityHash = stringToActionHash(input.original_action_hash);
      const key = getEntityKey(entityHash, input.entity);
      const hashKeys = entityServiceTypeLinks.get(key) || [];
      const hashes = hashKeys.map(keyToActionHash);
      return E.succeed(hashes);
    },

    linkToServiceType: (input: ServiceTypeLinkInput) => {
      const entityHash = stringToActionHash(input.action_hash);
      const serviceTypeHash = stringToActionHash(input.service_type_hash);
      const key = getEntityKey(entityHash, input.entity);
      const existingLinks = entityServiceTypeLinks.get(key) || [];
      const serviceTypeKey = actionHashToKey(serviceTypeHash);

      // Only add if not already linked
      if (!existingLinks.includes(serviceTypeKey)) {
        existingLinks.push(serviceTypeKey);
        entityServiceTypeLinks.set(key, existingLinks);
      }

      return E.succeed(undefined);
    },

    unlinkFromServiceType: (input: ServiceTypeLinkInput) => {
      const entityHash = stringToActionHash(input.action_hash);
      const serviceTypeHash = stringToActionHash(input.service_type_hash);
      const key = getEntityKey(entityHash, input.entity);
      const existingLinks = entityServiceTypeLinks.get(key) || [];
      const serviceTypeKey = actionHashToKey(serviceTypeHash);

      const updatedLinks = existingLinks.filter((hashKey) => hashKey !== serviceTypeKey);

      entityServiceTypeLinks.set(key, updatedLinks);
      return E.succeed(undefined);
    },

    updateServiceTypeLinks: (input: UpdateServiceTypeLinksInput) => {
      const entityHash = stringToActionHash(input.action_hash);
      const key = getEntityKey(entityHash, input.entity);
      const hashKeys = input.new_service_type_hashes.map((hash) =>
        actionHashToKey(stringToActionHash(hash))
      );
      entityServiceTypeLinks.set(key, hashKeys);
      return E.succeed(undefined);
    },

    deleteAllServiceTypeLinksForEntity: (input: GetServiceTypeForEntityInput) => {
      const entityHash = stringToActionHash(input.original_action_hash);
      const key = getEntityKey(entityHash, input.entity);
      entityServiceTypeLinks.delete(key);
      return E.succeed(undefined);
    },

    // Status management methods
    suggestServiceType: (serviceType: ServiceTypeInDHT) =>
      E.tryPromise({
        try: () =>
          createMockServiceTypeRecord(serviceType).then((record) => {
            const hash = record.signed_action.hashed.hash;
            mockServiceTypes.set(actionHashToKey(hash), record);
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

    getServiceTypeStatus: (serviceTypeHash: ActionHash) => E.succeed('approved')
  };

  return Layer.succeed(ServiceTypesServiceTag, mockService);
};

