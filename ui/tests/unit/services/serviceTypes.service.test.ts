import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E, Layer } from 'effect';
import type { Record, ActionHash } from '@holochain/client';
import { fakeActionHash } from '@holochain/client';
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
import { createMockRecord, createTestServiceType } from '../test-helpers';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a mock HolochainClientService with Effect-based methods
 */
const createMockHolochainClientService = () => ({
  appId: 'test-app',
  client: null,
  isConnected: true,
  isConnecting: false,
  weaveClient: null,
  profilesClient: null,
  isWeaveContext: false,
  connectClient: vi.fn(),
  waitForConnection: vi.fn(() => Promise.resolve()),
  getAppInfo: vi.fn(),
  getPeerMetaInfo: vi.fn(() => Promise.resolve({})),
  callZome: vi.fn(),
  verifyConnection: vi.fn(),
  getNetworkSeed: vi.fn(() => Promise.resolve('test-network-seed')),
  getNetworkInfo: vi.fn(() =>
    Promise.resolve({
      networkSeed: 'test-network-seed',
      dnaHash: 'test-dna-hash',
      roleName: 'requests_and_offers'
    })
  ),
  getNetworkPeers: vi.fn(() => Promise.resolve(['peer1', 'peer2', 'peer3'])),
  isGroupProgenitor: vi.fn(() => Promise.resolve(false))
});

/**
 * Helper to encode hash to base64 for testing
 */
const encodeHashToBase64 = (hash: ActionHash): string => Buffer.from(hash).toString('base64');

/**
 * Helper to convert ActionHash (Uint8Array) to branded schema ActionHash (string)
 * This follows Effect Schema patterns for type conversion in tests
 */
const convertToSchemaActionHash = (
  hash: ActionHash
): import('$lib/schemas/holochain.schemas').ActionHash =>
  encodeHashToBase64(hash) as unknown as import('$lib/schemas/holochain.schemas').ActionHash;

/**
 * Helper to run service effects with proper layer setup
 */
const createServiceTestRunner = (
  mockClient: ReturnType<typeof createMockHolochainClientService>
) => {
  const testLayer = Layer.succeed(HolochainClientServiceTag, mockClient);

  return <T, E>(effect: E.Effect<T, E, ServiceTypesServiceTag>) =>
    E.runPromise(effect.pipe(E.provide(ServiceTypesServiceLive), E.provide(testLayer)));
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('ServiceTypesService', () => {
  let mockHolochainClient: ReturnType<typeof createMockHolochainClientService>;
  let mockRecord: Record;
  let mockActionHash: ActionHash;
  let testServiceType: ServiceTypeInDHT;
  let runServiceEffect: ReturnType<typeof createServiceTestRunner>;

  beforeEach(async () => {
    mockHolochainClient = createMockHolochainClientService();
    mockRecord = await createMockRecord();
    mockActionHash = await fakeActionHash();
    testServiceType = createTestServiceType();
    runServiceEffect = createServiceTestRunner(mockHolochainClient);
  });

  // ==========================================================================
  // CORE CRUD OPERATIONS
  // ==========================================================================

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

    it('should handle creation errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(new Error('Failed to create service type'));

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

    it('should handle get errors gracefully', async () => {
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
          original_action_hash: originalHash,
          previous_action_hash: previousHash,
          updated_service_type: updatedServiceType
        }
      );
      expect(result).toEqual(mockActionHash);
    });

    it('should handle update errors gracefully', async () => {
      // Arrange
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      mockHolochainClient.callZome.mockRejectedValue(new Error('Failed to update service type'));

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

    it('should handle delete errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(new Error('Failed to delete service type'));

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

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

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
        'get_pending_service_types',
        null
      );
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_approved_service_types',
        null
      );
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_rejected_service_types',
        null
      );
      expect(result).toEqual({
        pending: mockRecords,
        approved: mockRecords,
        rejected: mockRecords
      });
    });

    it('should handle get all errors gracefully', async () => {
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
      ).rejects.toThrow('Network error');
    });
  });

  // ==========================================================================
  // ENTITY RELATIONSHIPS
  // ==========================================================================

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
        original_action_hash: convertToSchemaActionHash(mockActionHash),
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

  // ==========================================================================
  // SERVICE TYPE LINKING - Using Schema Type Conversion
  // ==========================================================================

  describe('linkToServiceType', () => {
    it('should link to service type successfully', async () => {
      // Arrange - Convert Holochain ActionHash to Schema ActionHash
      const input: ServiceTypeLinkInput = {
        action_hash: convertToSchemaActionHash(mockActionHash),
        entity: 'request',
        service_type_hash: convertToSchemaActionHash(await fakeActionHash())
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

    it('should handle link errors gracefully', async () => {
      // Arrange
      const input: ServiceTypeLinkInput = {
        action_hash: convertToSchemaActionHash(mockActionHash),
        entity: 'request',
        service_type_hash: convertToSchemaActionHash(await fakeActionHash())
      };
      mockHolochainClient.callZome.mockRejectedValue(new Error('Failed to link to service type'));

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
        action_hash: convertToSchemaActionHash(mockActionHash),
        entity: 'offer',
        service_type_hash: convertToSchemaActionHash(await fakeActionHash())
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
        action_hash: convertToSchemaActionHash(mockActionHash),
        entity: 'request',
        new_service_type_hashes: [
          convertToSchemaActionHash(await fakeActionHash()),
          convertToSchemaActionHash(await fakeActionHash())
        ]
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

    it('should handle update links errors gracefully', async () => {
      // Arrange
      const input: UpdateServiceTypeLinksInput = {
        action_hash: convertToSchemaActionHash(mockActionHash),
        entity: 'request',
        new_service_type_hashes: [convertToSchemaActionHash(await fakeActionHash())]
      };
      mockHolochainClient.callZome.mockRejectedValue(
        new Error('Failed to update service type links')
      );

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
        original_action_hash: convertToSchemaActionHash(mockActionHash),
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

    it('should handle delete all links errors gracefully', async () => {
      // Arrange
      const input: GetServiceTypeForEntityInput = {
        original_action_hash: convertToSchemaActionHash(mockActionHash),
        entity: 'offer'
      };
      mockHolochainClient.callZome.mockRejectedValue(
        new Error('Failed to delete all service type links for entity')
      );

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

  // ==========================================================================
  // STATUS MANAGEMENT
  // ==========================================================================

  describe('suggestServiceType', () => {
    it('should suggest a service type successfully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockResolvedValue(mockRecord);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.suggestServiceType(testServiceType);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'suggest_service_type',
        { service_type: testServiceType }
      );
      expect(result).toEqual(mockRecord);
    });

    it('should handle suggestion errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(new Error('Failed to suggest service type'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.suggestServiceType(testServiceType);
          })
        )
      ).rejects.toThrow('Failed to suggest service type');
    });
  });

  describe('approveServiceType', () => {
    it('should approve a service type successfully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockResolvedValue(undefined);

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.approveServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'approve_service_type',
        mockActionHash
      );
    });

    it('should handle approval errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(new Error('Failed to approve service type'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.approveServiceType(mockActionHash);
          })
        )
      ).rejects.toThrow('Failed to approve service type');
    });
  });

  describe('rejectServiceType', () => {
    it('should reject a service type successfully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockResolvedValue(undefined);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.rejectServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'reject_service_type',
        mockActionHash
      );
    });

    it('should handle rejection errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(new Error('Failed to reject service type'));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.rejectServiceType(mockActionHash);
          })
        )
      ).rejects.toThrow('Failed to reject service type');
    });
  });

  // ==========================================================================
  // STATUS FETCHING
  // ==========================================================================

  describe('getPendingServiceTypes', () => {
    it('should get pending service types successfully', async () => {
      // Arrange
      const mockPendingRecords = [mockRecord, await createMockRecord()];
      mockHolochainClient.callZome.mockResolvedValue(mockPendingRecords);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getPendingServiceTypes();
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_pending_service_types',
        null
      );
      expect(result).toEqual(mockPendingRecords);
    });

    it('should handle get pending errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(
        new Error('Failed to get pending service types')
      );

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.getPendingServiceTypes();
          })
        )
      ).rejects.toThrow('Failed to get pending service types');
    });
  });

  describe('getApprovedServiceTypes', () => {
    it('should get approved service types successfully', async () => {
      // Arrange
      const mockApprovedRecords = [mockRecord, await createMockRecord()];
      mockHolochainClient.callZome.mockResolvedValue(mockApprovedRecords);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getApprovedServiceTypes();
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_approved_service_types',
        null
      );
      expect(result).toEqual(mockApprovedRecords);
    });

    it('should handle get approved errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(
        new Error('Failed to get approved service types')
      );

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.getApprovedServiceTypes();
          })
        )
      ).rejects.toThrow('Failed to get approved service types');
    });
  });

  describe('getRejectedServiceTypes', () => {
    it('should get rejected service types successfully', async () => {
      // Arrange
      const mockRejectedRecords = [mockRecord, await createMockRecord()];
      mockHolochainClient.callZome.mockResolvedValue(mockRejectedRecords);

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getRejectedServiceTypes();
        })
      );

      // Assert
      expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
        'service_types',
        'get_rejected_service_types',
        null
      );
      expect(result).toEqual(mockRejectedRecords);
    });

    it('should handle get rejected errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZome.mockRejectedValue(
        new Error('Failed to get rejected service types')
      );

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.getRejectedServiceTypes();
          })
        )
      ).rejects.toThrow('Failed to get rejected service types');
    });
  });

  // ==========================================================================
  // ERROR HANDLING - Testing Effect Schema Tagged Errors
  // ==========================================================================

  describe('ServiceTypeError', () => {
    it('should create error from Error instance with proper context', () => {
      // Arrange
      const originalError = new Error('Original error message');
      const context = 'Test context';

      // Act
      const serviceTypeError = ServiceTypeError.fromError(originalError, context);

      // Assert
      expect(serviceTypeError.message).toBe('Test context: Original error message');
      expect(serviceTypeError.cause).toBe(originalError);
    });

    it('should create error from non-Error value with proper context', () => {
      // Arrange
      const originalError = 'String error';
      const context = 'Test context';

      // Act
      const serviceTypeError = ServiceTypeError.fromError(originalError, context);

      // Assert
      expect(serviceTypeError.message).toBe('Test context: String error');
      expect(serviceTypeError.cause).toBe(originalError);
    });

    it('should handle undefined/null errors gracefully', () => {
      // Arrange
      const context = 'Test context';

      // Act
      const serviceTypeError = ServiceTypeError.fromError(null, context);

      // Assert
      expect(serviceTypeError.message).toBe('Test context: null');
      expect(serviceTypeError.cause).toBe(null);
    });
  });
});
