import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E, Layer } from 'effect';
import type { ActionHash, Record } from '@holochain/client';
import {
  ServiceTypesServiceLive,
  ServiceTypesServiceTag,
  ServiceTypeError,
  type ServiceTypeLinkInput,
  type UpdateServiceTypeLinksInput,
  type GetServiceTypeForEntityInput
} from '$lib/services/zomes/serviceTypes.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { createMockRecord } from '../test-helpers';
import { fakeActionHash } from '@holochain/client';

// Mock the HolochainClientService
const createMockHolochainClientService = () => ({
  appId: 'test-app',
  client: null,
  isConnected: true,
  connectClient: vi.fn(),
  getAppInfo: vi.fn(),
  callZome: vi.fn()
});

describe('ServiceTypesService', () => {
  let mockHolochainClient: ReturnType<typeof createMockHolochainClientService>;
  let mockRecord: Record;
  let mockActionHash: ActionHash;
  let testServiceType: ServiceTypeInDHT;

  beforeEach(async () => {
    mockHolochainClient = createMockHolochainClientService();
    mockRecord = await createMockRecord();
    mockActionHash = await fakeActionHash();

    testServiceType = {
      name: 'Web Development',
      description: 'Frontend and backend web development services',
      tags: ['javascript', 'react', 'nodejs']
    };
  });

  const createTestLayer = () => Layer.succeed(HolochainClientServiceTag, mockHolochainClient);

  const runServiceEffect = <T, E>(effect: E.Effect<T, E, ServiceTypesServiceTag>) =>
    E.runPromise(effect.pipe(E.provide(ServiceTypesServiceLive), E.provide(createTestLayer())));

  describe('createServiceType', () => {
    it('should create a service type successfully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockResolvedValue(mockRecord);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.createServiceType(testServiceType);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'create_service_type',
        { service_type: testServiceType }
      );
      expect(result).toEqual(mockRecord);
    });

    it('should handle creation errors', async () => {
      // Arrange
      const errorMessage = 'Failed to create service type';
      mockHolochainClient.callZome.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.createServiceType(testServiceType);
          })
        )
      ).rejects.toThrow('Failed to create service type');
    });
  });

  describe('getServiceType', () => {
    it('should get a service type successfully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockResolvedValue(mockRecord);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_service_type',
        mockActionHash
      );
      expect(result).toEqual(mockRecord);
    });

    it('should return null when service type not found', async () => {
      // Arrange
      mockHolochainClient.callZome.mockResolvedValue(null);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getServiceType(mockActionHash);
        })
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should handle get errors', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.getServiceType(mockActionHash);
          })
        )
      ).rejects.toThrow('Failed to get service type');
    });
  });

  describe('getLatestServiceTypeRecord', () => {
    it('should get latest service type record successfully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockResolvedValue(mockRecord);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getLatestServiceTypeRecord(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_latest_service_type_record',
        mockActionHash
      );
      expect(result).toEqual(mockRecord);
    });
  });

  describe('updateServiceType', () => {
    it('should update a service type successfully', async () => {
      // Arrange
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      const updatedServiceType = { ...testServiceType, name: 'Updated Web Development' };

      mockHolochainClient.callZome.mockResolvedValue(mockActionHash);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.updateServiceType(originalHash, previousHash, updatedServiceType);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'update_service_type',
        {
          original_service_type_hash: originalHash,
          previous_service_type_hash: previousHash,
          updated_service_type: updatedServiceType
        }
      );
      expect(result).toEqual(mockActionHash);
    });

    it('should handle update errors', async () => {
      // Arrange
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      mockHolochainClient.callZome.mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.updateServiceType(originalHash, previousHash, testServiceType);
          })
        )
      ).rejects.toThrow('Failed to update service type');
    });
  });

  describe('deleteServiceType', () => {
    it('should delete a service type successfully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockResolvedValue(mockActionHash);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.deleteServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'delete_service_type',
        mockActionHash
      );
      expect(result).toEqual(mockActionHash);
    });

    it('should handle delete errors', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(new Error('Delete failed'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.deleteServiceType(mockActionHash);
          })
        )
      ).rejects.toThrow('Failed to delete service type');
    });
  });

  describe('getAllServiceTypes', () => {
    it('should get all service types successfully', async () => {
      // Arrange
      const mockRecords = [mockRecord, await createMockRecord()];
      mockHolochainClient.callZome.mockResolvedValue(mockRecords);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getAllServiceTypes();
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_all_service_types',
        null
      );
      expect(result).toEqual(mockRecords);
    });

    it('should handle get all errors', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.getAllServiceTypes();
          })
        )
      ).rejects.toThrow('Failed to get all service types');
    });
  });

  describe('getRequestsForServiceType', () => {
    it('should get requests for service type successfully', async () => {
      // Arrange
      const mockRecords = [mockRecord];
      mockHolochainClient.callZome.mockResolvedValue(mockRecords);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getRequestsForServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_requests_for_service_type',
        mockActionHash
      );
      expect(result).toEqual(mockRecords);
    });
  });

  describe('getOffersForServiceType', () => {
    it('should get offers for service type successfully', async () => {
      // Arrange
      const mockRecords = [mockRecord];
      mockHolochainClient.callZome.mockResolvedValue(mockRecords);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getOffersForServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_offers_for_service_type',
        mockActionHash
      );
      expect(result).toEqual(mockRecords);
    });
  });

  describe('getServiceTypesForEntity', () => {
    it('should get service types for entity successfully', async () => {
      // Arrange
      const input: GetServiceTypeForEntityInput = {
        original_action_hash: mockActionHash,
        entity: 'request'
      };
      const mockHashes = [mockActionHash, await fakeActionHash()];
      mockHolochainClient.callZome.mockResolvedValue(mockHashes);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getServiceTypesForEntity(input);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_service_types_for_entity',
        input
      );
      expect(result).toEqual(mockHashes);
    });
  });

  describe('linkToServiceType', () => {
    it('should link to service type successfully', async () => {
      // Arrange
      const input: ServiceTypeLinkInput = {
        action_hash: mockActionHash,
        entity: 'request',
        service_type_hash: await fakeActionHash()
      };
      mockHolochainClient.callZome.mockResolvedValue(undefined);

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.linkToServiceType(input);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'link_to_service_type',
        input
      );
    });

    it('should handle link errors', async () => {
      // Arrange
      const input: ServiceTypeLinkInput = {
        action_hash: mockActionHash,
        entity: 'request',
        service_type_hash: await fakeActionHash()
      };
      mockHolochainClient.callZome.mockRejectedValue(new Error('Link failed'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.linkToServiceType(input);
          })
        )
      ).rejects.toThrow('Failed to link to service type');
    });
  });

  describe('unlinkFromServiceType', () => {
    it('should unlink from service type successfully', async () => {
      // Arrange
      const input: ServiceTypeLinkInput = {
        action_hash: mockActionHash,
        entity: 'offer',
        service_type_hash: await fakeActionHash()
      };
      mockHolochainClient.callZome.mockResolvedValue(undefined);

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.unlinkFromServiceType(input);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'unlink_from_service_type',
        input
      );
    });
  });

  describe('updateServiceTypeLinks', () => {
    it('should update service type links successfully', async () => {
      // Arrange
      const input: UpdateServiceTypeLinksInput = {
        action_hash: mockActionHash,
        entity: 'request',
        new_service_type_hashes: [await fakeActionHash(), await fakeActionHash()]
      };
      mockHolochainClient.callZome.mockResolvedValue(undefined);

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.updateServiceTypeLinks(input);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'update_service_type_links',
        input
      );
    });

    it('should handle update links errors', async () => {
      // Arrange
      const input: UpdateServiceTypeLinksInput = {
        action_hash: mockActionHash,
        entity: 'request',
        new_service_type_hashes: [await fakeActionHash()]
      };
      mockHolochainClient.callZome.mockRejectedValue(new Error('Update links failed'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.updateServiceTypeLinks(input);
          })
        )
      ).rejects.toThrow('Failed to update service type links');
    });
  });

  describe('deleteAllServiceTypeLinksForEntity', () => {
    it('should delete all service type links for entity successfully', async () => {
      // Arrange
      const input: GetServiceTypeForEntityInput = {
        original_action_hash: mockActionHash,
        entity: 'request'
      };
      mockHolochainClient.callZome.mockResolvedValue(undefined);

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.deleteAllServiceTypeLinksForEntity(input);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'delete_all_service_type_links_for_entity',
        input
      );
    });

    it('should handle delete all links errors', async () => {
      // Arrange
      const input: GetServiceTypeForEntityInput = {
        original_action_hash: mockActionHash,
        entity: 'offer'
      };
      mockHolochainClient.callZome.mockRejectedValue(new Error('Delete all links failed'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.deleteAllServiceTypeLinksForEntity(input);
          })
        )
      ).rejects.toThrow('Failed to delete all service type links for entity');
    });
  });

  describe('ServiceTypeError', () => {
    it('should create error from Error instance', () => {
      const originalError = new Error('Original error message');
      const serviceTypeError = ServiceTypeError.fromError(originalError, 'Test context');

      expect(serviceTypeError.message).toBe('Test context: Original error message');
      expect(serviceTypeError.cause).toBe(originalError);
    });

    it('should create error from non-Error value', () => {
      const originalError = 'String error';
      const serviceTypeError = ServiceTypeError.fromError(originalError, 'Test context');

      expect(serviceTypeError.message).toBe('Test context: String error');
      expect(serviceTypeError.cause).toBe(originalError);
    });
  });
});
