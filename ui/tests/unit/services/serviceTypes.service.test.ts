import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E, Layer, Schema } from 'effect';
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
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { createMockRecord, createTestServiceType, actionHashToString } from '../test-helpers';
import { VoidResponseSchema, StringArraySchema } from '$lib/schemas/service-types.schemas';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a mock HolochainClientService with Effect-based methods
 */
const createMockHolochainClientService = () => ({
  appId: 'test-app',
  connectClientEffect: vi.fn(),
  getAppInfoEffect: vi.fn(),
  callZomeEffect: vi.fn(),
  callZomeRawEffect: vi.fn(),
  isConnectedEffect: vi.fn(() => E.succeed(true)),
  getClientEffect: vi.fn(() => E.succeed(null))
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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.createServiceType(testServiceType);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'create_service_type',
        { service_type: testServiceType }
      );
      expect(result).toEqual(mockRecord);
    });

    it('should handle creation errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZomeRawEffect.mockReturnValue(
        E.fail(new Error('Failed to create service type'))
      );

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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'get_service_type',
        mockActionHash
      );
      expect(result).toEqual(mockRecord);
    });

    it('should return null when service type not found', async () => {
      // Arrange
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(null));

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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(new Error('Network error')));

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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getLatestServiceTypeRecord(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
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

      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockActionHash));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.updateServiceType(originalHash, previousHash, updatedServiceType);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
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

    it('should handle update errors gracefully', async () => {
      // Arrange
      const originalHash = await fakeActionHash();
      const previousHash = await fakeActionHash();
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(new Error('Update failed')));

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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockActionHash));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.deleteServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'delete_service_type',
        mockActionHash
      );
      expect(result).toEqual(mockActionHash);
    });

    it('should handle delete errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(new Error('Delete failed')));

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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRecords));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getAllServiceTypes();
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'get_pending_service_types',
        null
      );
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'get_approved_service_types',
        null
      );
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(new Error('Network error')));

      // Act & Assert
      await expect(
        runServiceEffect(
          E.gen(function* () {
            const service = yield* ServiceTypesServiceTag;
            return yield* service.getAllServiceTypes();
          })
        )
      ).rejects.toThrow('Failed to get pending service types');
    });
  });

  // ==========================================================================
  // ENTITY RELATIONSHIPS
  // ==========================================================================

  describe('getRequestsForServiceType', () => {
    it('should get requests for service type successfully', async () => {
      // Arrange
      const mockRecords = [mockRecord];
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRecords));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getRequestsForServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRecords));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getOffersForServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockHashes));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getServiceTypesForEntity(input);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
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
      mockHolochainClient.callZomeEffect.mockReturnValue(E.succeed(undefined));

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.linkToServiceType(input);
        })
      );

      // Assert - Test with exact schema instead of expect.any()
      expect(mockHolochainClient.callZomeEffect).toHaveBeenCalledWith(
        'service_types',
        'link_to_service_type',
        input,
        VoidResponseSchema
      );
    });

    it('should handle link errors gracefully', async () => {
      // Arrange
      const input: ServiceTypeLinkInput = {
        action_hash: convertToSchemaActionHash(mockActionHash),
        entity: 'request',
        service_type_hash: convertToSchemaActionHash(await fakeActionHash())
      };
      mockHolochainClient.callZomeEffect.mockReturnValue(E.fail(new Error('Link failed')));

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
      mockHolochainClient.callZomeEffect.mockReturnValue(E.succeed(undefined));

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.unlinkFromServiceType(input);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeEffect).toHaveBeenCalledWith(
        'service_types',
        'unlink_from_service_type',
        input,
        VoidResponseSchema
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
      mockHolochainClient.callZomeEffect.mockReturnValue(E.succeed(undefined));

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.updateServiceTypeLinks(input);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeEffect).toHaveBeenCalledWith(
        'service_types',
        'update_service_type_links',
        input,
        VoidResponseSchema
      );
    });

    it('should handle update links errors gracefully', async () => {
      // Arrange
      const input: UpdateServiceTypeLinksInput = {
        action_hash: convertToSchemaActionHash(mockActionHash),
        entity: 'request',
        new_service_type_hashes: [convertToSchemaActionHash(await fakeActionHash())]
      };
      mockHolochainClient.callZomeEffect.mockReturnValue(E.fail(new Error('Update links failed')));

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
      mockHolochainClient.callZomeEffect.mockReturnValue(E.succeed(undefined));

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.deleteAllServiceTypeLinksForEntity(input);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeEffect).toHaveBeenCalledWith(
        'service_types',
        'delete_all_service_type_links_for_entity',
        input,
        VoidResponseSchema
      );
    });

    it('should handle delete all links errors gracefully', async () => {
      // Arrange
      const input: GetServiceTypeForEntityInput = {
        original_action_hash: convertToSchemaActionHash(mockActionHash),
        entity: 'offer'
      };
      mockHolochainClient.callZomeEffect.mockReturnValue(
        E.fail(new Error('Delete all links failed'))
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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.suggestServiceType(testServiceType);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'suggest_service_type',
        { service_type: testServiceType }
      );
      expect(result).toEqual(mockRecord);
    });

    it('should handle suggestion errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(new Error('Suggestion failed')));

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
      mockHolochainClient.callZomeEffect.mockReturnValue(E.succeed(undefined));

      // Act
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.approveServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeEffect).toHaveBeenCalledWith(
        'service_types',
        'approve_service_type',
        mockActionHash,
        VoidResponseSchema
      );
    });

    it('should handle approval errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZomeEffect.mockReturnValue(E.fail(new Error('Approval failed')));

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
      mockHolochainClient.callZomeEffect.mockReturnValue(E.succeed(undefined));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.rejectServiceType(mockActionHash);
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeEffect).toHaveBeenCalledWith(
        'service_types',
        'reject_service_type',
        mockActionHash,
        VoidResponseSchema
      );
    });

    it('should handle rejection errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZomeEffect.mockReturnValue(E.fail(new Error('Rejection failed')));

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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockPendingRecords));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getPendingServiceTypes();
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'get_pending_service_types',
        null
      );
      expect(result).toEqual(mockPendingRecords);
    });

    it('should handle get pending errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(new Error('Network error')));

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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockApprovedRecords));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getApprovedServiceTypes();
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'get_approved_service_types',
        null
      );
      expect(result).toEqual(mockApprovedRecords);
    });

    it('should handle get approved errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(new Error('Network error')));

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
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.succeed(mockRejectedRecords));

      // Act
      const result = await runServiceEffect(
        E.gen(function* () {
          const service = yield* ServiceTypesServiceTag;
          return yield* service.getRejectedServiceTypes();
        })
      );

      // Assert
      expect(mockHolochainClient.callZomeRawEffect).toHaveBeenCalledWith(
        'service_types',
        'get_rejected_service_types',
        null
      );
      expect(result).toEqual(mockRejectedRecords);
    });

    it('should handle get rejected errors gracefully', async () => {
      // Arrange
      mockHolochainClient.callZomeRawEffect.mockReturnValue(E.fail(new Error('Network error')));

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
